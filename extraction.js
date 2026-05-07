// v1.5 | extraction.js
import { savetolibrary, uploadartifact } from './firebase.js';
import { CARTOGRAPHER_PROMPTS } from './prompts.js';

const getBase64 = (blob) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

document.getElementById('processbutton').onclick = async () => {
    const file = document.getElementById('bookupload').files[0];
    if (!file) return;
    
    const oKey = localStorage.getItem('openai_key');
    const zip = await JSZip.loadAsync(file);
    
    const statusLog = document.getElementById('statuslog');
    const promptMirror = document.getElementById('promptmirror');
    const aiMirror = document.getElementById('aimirror');

    const log = (msg) => {
        const entry = document.createElement('div');
        entry.textContent = `> ${msg}`;
        statusLog.appendChild(entry);
        statusLog.scrollTop = statusLog.scrollHeight;
    };

    log("Reading tome metadata...");
    
    // Metadata Extraction Logic
    const containerXml = await zip.file("META-INF/container.xml").async("string");
    const parser = new DOMParser();
    const containerDoc = parser.parseFromString(containerXml, "text/xml");
    const opfPath = containerDoc.querySelector("rootfile").getAttribute("full-path");
    const opfXml = await zip.file(opfPath).async("string");
    const opfDoc = parser.parseFromString(opfXml, "text/xml");

    const title = opfDoc.querySelector("title")?.textContent || "Unknown Title";
    const author = opfDoc.querySelector("creator")?.textContent || "Unknown Author";
    let series = "Standalone";
    opfDoc.querySelectorAll("meta").forEach(meta => {
        if (meta.getAttribute("name") === "calibre:series" || meta.getAttribute("property") === "belongs-to-collection") {
            series = meta.getAttribute("content") || meta.textContent;
        }
    });

    log(`Identified: ${title} by ${author}`);

    const authorId = author.toLowerCase().replace(/\s+/g, '-');
    const seriesId = series.toLowerCase().replace(/\s+/g, '-');
    const bookId = title.toLowerCase().replace(/\s+/g, '-');
    const userId = "default-user";

    let bookData = { title, author, series, maps: [], cover: null, created: Date.now() };

    const imageFiles = Object.keys(zip.files).filter(f => f.match(/\.(jpg|jpeg|png)$/i));
    
    for (const path of imageFiles) {
        const filename = path.split('/').pop();
        log(`Analyzing: ${filename}...`);

        try {
            const imgBlob = await zip.file(path).async("blob");
            const base64Data = await getBase64(imgBlob);
            const mimeType = imgBlob.type || "image/jpeg";
            
            const prompt = CARTOGRAPHER_PROMPTS.describeImagePrompt();
            promptMirror.value = prompt;

            const res = await fetch("https://api.openai.com/v1/chat/completions", {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${oKey}`
                },
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: [
                        {
                            role: "user",
                            content: [
                                { type: "text", text: prompt },
                                { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Data}` } }
                            ]
                        }
                    ]
                })
            });
            
            const data = await res.json();
            const analysis = data.choices[0].message.content;
            aiMirror.value = analysis;

            const storagePath = `users/${userId}/${authorId}/${seriesId}/${bookId}`;
            
            if (analysis.toUpperCase().includes("COVER") && !bookData.cover) {
                log(`Uploading Cover...`);
                bookData.cover = await uploadartifact(`${storagePath}/cover.jpg`, imgBlob);
            } else if (analysis.toUpperCase().includes("MAP")) {
                log(`Uploading Map: ${filename}`);
                const url = await uploadartifact(`${storagePath}/maps/${filename}`, imgBlob);
                bookData.maps.push({ name: filename, url: url, analysis });
            }

            await savetolibrary({ userid: userId, author: authorId, series: seriesId, bookid: bookId }, bookData);

        } catch (err) {
            log(`ERROR on ${filename}: ${err.message}`);
        }
    }
    
    log("Inventory Complete.");
};
