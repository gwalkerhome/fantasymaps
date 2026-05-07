// v2.0 | extraction.js — clone of battlemaster pattern + firebase save
import { savetolibrary, uploadartifact } from './firebase.js';
import { CARTOGRAPHER_PROMPTS } from './prompts.js';

const VERSION = "v2.0";

// DOM elements (script is loaded as a module at end of body, so DOM is ready)
const statusLog = document.getElementById('statuslog');
const promptMirror = document.getElementById('promptmirror');
const aiMirror = document.getElementById('aimirror');
const processButton = document.getElementById('processbutton');
const fileInput = document.getElementById('bookupload');

const log = (msg) => {
    const entry = document.createElement('div');
    entry.textContent = `> ${msg}`;
    statusLog.appendChild(entry);
    statusLog.scrollTop = statusLog.scrollHeight;
    console.log(`[scribe ${VERSION}] ${msg}`);
};

const clearLog = () => {
    statusLog.innerHTML = '';
};

const getBase64 = (blob) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

// Slug helper: lowercase, spaces -> hyphens, strip anything else (matches index.html style)
const slug = (s) => (s || "")
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

async function callOpenAIVision(base64Data, mimeType, key) {
    const url = "https://api.openai.com/v1/chat/completions";
    const prompt = CARTOGRAPHER_PROMPTS.describeImagePrompt();
    promptMirror.value = prompt;

    const body = {
        model: "gpt-4o-mini",
        messages: [
            {
                role: "user",
                content: [
                    { type: "text", text: prompt },
                    {
                        type: "image_url",
                        image_url: {
                            url: `data:${mimeType};base64,${base64Data}`
                        }
                    }
                ]
            }
        ],
        max_tokens: 800
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify(body)
    });

    const data = await res.json();
    if (data.error) throw new Error(`openai: ${data.error.message}`);
    if (!data.choices || !data.choices[0]) throw new Error("openai returned no choices");

    const content = data.choices[0].message.content || "";
    aiMirror.value = content;
    return content;
}

processButton.onclick = async () => {
    clearLog();
    log(`scribe ${VERSION} starting...`);

    try {
        // -------- Pre-flight checks --------
        const file = fileInput.files[0];
        if (!file) {
            log("ERROR: no file selected. Choose an .epub first.");
            return;
        }
        log(`file selected: ${file.name} (${(file.size / 1024).toFixed(0)} kb)`);

        const oKey = localStorage.getItem('openai_key');
        if (!oKey) {
            log("ERROR: no openai key found in this browser. Visit apisettings.html and bind your key first.");
            return;
        }
        log("openai key found.");

        if (typeof JSZip === 'undefined') {
            log("ERROR: JSZip library not loaded. Reload the page.");
            return;
        }

        // -------- Read epub --------
        log("unzipping epub...");
        const zip = await JSZip.loadAsync(file);
        log("epub unzipped.");

        // -------- Read metadata --------
        log("reading metadata...");
        const containerFile = zip.file("META-INF/container.xml");
        if (!containerFile) {
            throw new Error("epub has no META-INF/container.xml — file may be corrupt or not a valid epub.");
        }
        const containerXml = await containerFile.async("string");
        const parser = new DOMParser();
        const containerDoc = parser.parseFromString(containerXml, "text/xml");
        const rootFile = containerDoc.querySelector("rootfile");
        if (!rootFile) throw new Error("epub container.xml has no rootfile element.");
        const opfPath = rootFile.getAttribute("full-path");
        log(`opf path: ${opfPath}`);

        const opfFile = zip.file(opfPath);
        if (!opfFile) throw new Error(`opf file not found at ${opfPath}`);
        const opfXml = await opfFile.async("string");
        const opfDoc = parser.parseFromString(opfXml, "text/xml");

        const title = opfDoc.querySelector("title")?.textContent?.trim() || "unknown title";
        const author = opfDoc.querySelector("creator")?.textContent?.trim() || "unknown author";
        let series = "standalone";
        opfDoc.querySelectorAll("meta").forEach(meta => {
            const nameAttr = meta.getAttribute("name");
            const propAttr = meta.getAttribute("property");
            if (nameAttr === "calibre:series") {
                series = (meta.getAttribute("content") || series).trim();
            } else if (propAttr === "belongs-to-collection") {
                series = (meta.textContent || series).trim();
            }
        });
        log(`title: ${title}`);
        log(`author: ${author}`);
        log(`series: ${series}`);

        const userId = "default-user";
        const authorId = slug(author) || "unknown-author";
        const seriesId = slug(series) || "standalone";
        const bookId = slug(title) || "unknown-title";
        const storagePath = `users/${userId}/${authorId}/${seriesId}/${bookId}`;
        log(`storage path: ${storagePath}`);

        // -------- Initial book record (so it appears in library straight away) --------
        let bookData = {
            title,
            author,
            series,
            maps: [],
            cover: null,
            created: Date.now()
        };
        await savetolibrary(
            { userid: userId, author: authorId, series: seriesId, bookid: bookId },
            bookData
        );
        log("initial book record saved to firestore.");

        // -------- Find images in the epub --------
        const imageFiles = Object.keys(zip.files).filter(f => f.match(/\.(jpg|jpeg|png|gif)$/i));
        log(`${imageFiles.length} image(s) found in epub.`);
        if (imageFiles.length === 0) {
            log("no images to analyse. done.");
            return;
        }

        // -------- Process each image --------
        for (const path of imageFiles) {
            const filename = path.split('/').pop();
            log(`-- analysing: ${filename}`);
            try {
                const imgBlob = await zip.file(path).async("blob");
                const base64Data = await getBase64(imgBlob);
                const mimeType = imgBlob.type || "image/jpeg";

                const description = await callOpenAIVision(base64Data, mimeType, oKey);
                const upper = description.toUpperCase();

                let category = "OTHER";
                if (upper.includes("COVER")) category = "COVER";
                else if (upper.includes("MAP")) category = "MAP";
                else if (upper.includes("ILLUSTRATION")) category = "ILLUSTRATION";
                else if (upper.includes("ICON")) category = "ICON";

                log(`   classified as: ${category}`);

                if (category === "COVER" && !bookData.cover) {
                    log(`   uploading cover...`);
                    const coverUrl = await uploadartifact(`${storagePath}/cover.jpg`, imgBlob);
                    if (coverUrl) {
                        bookData.cover = coverUrl;
                        log(`   cover stored.`);
                    } else {
                        log(`   cover upload returned no url.`);
                    }
                } else if (category === "MAP") {
                    log(`   uploading map...`);
                    const mapUrl = await uploadartifact(`${storagePath}/maps/${filename}`, imgBlob);
                    if (mapUrl) {
                        bookData.maps.push({
                            name: filename,
                            url: mapUrl,
                            analysis: description
                        });
                        log(`   map stored.`);
                    } else {
                        log(`   map upload returned no url.`);
                    }
                } else {
                    log(`   skipped (not cover/map).`);
                }

                // Sync progress to firestore after each image so partial work is preserved
                await savetolibrary(
                    { userid: userId, author: authorId, series: seriesId, bookid: bookId },
                    bookData
                );
            } catch (imgErr) {
                log(`   ERROR on ${filename}: ${imgErr.message}`);
            }
        }

        log(`-- done. cover: ${bookData.cover ? "yes" : "no"}. maps: ${bookData.maps.length}.`);
        log("the tome has been added to the vault.");

    } catch (err) {
        log(`FATAL ERROR: ${err.message}`);
        console.error(err);
    }
};
