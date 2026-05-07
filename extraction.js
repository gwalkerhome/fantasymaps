// v1.1 | extraction.js
import { savetolibrary, uploadartifact } from './firebase.js';
import { CARTOGRAPHER_PROMPTS } from './prompts.js';

const statusLog = document.getElementById('statuslog');
const promptMirror = document.getElementById('promptmirror');
const aiMirror = document.getElementById('aimirror');
const bookUpload = document.getElementById('bookupload');
const processButton = document.getElementById('processbutton');

const log = (msg) => {
    const entry = document.createElement('div');
    entry.textContent = `> ${msg}`;
    statusLog.appendChild(entry);
    statusLog.scrollTop = statusLog.scrollHeight;
};

const getBase64 = (blob) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

async function consultOracle(base64Data, mimeType) {
    const apiKey = localStorage.getItem('openai_key');
    if (!apiKey) throw new Error("Missing OpenAI Key in settings.");

    const prompt = CARTOGRAPHER_PROMPTS.describeImagePrompt();
    promptMirror.value = prompt;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
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
    if (data.error) throw new Error(data.error.message);
    
    const answer = data.choices[0].message.content;
    aiMirror.value = answer;
    return answer;
}

processButton.onclick = async () => {
    const file = bookUpload.files[0];
    if (!file) return alert("Please select an EPUB file.");

    log(`Beginning extraction of ${file.name}...`);
    const zip = await JSZip.loadAsync(file);
    const imageFiles = Object.keys(zip.files).filter(f => f.match(/\.(jpg|jpeg|png)$/i));
    
    log(`Found ${imageFiles.length} images. Analyzing...`);

    let bookData = {
        title: file.name.replace('.epub', ''),
        maps: [],
        cover: null,
        created: Date.now()
    };

    const bookId = bookData.title.toLowerCase().replace(/\s+/g, '-');

    for (const path of imageFiles) {
        const filename = path.split('/').pop();
        log(`Scanning: ${filename}`);

        try {
            const imgBlob = await zip.file(path).async("blob");
            const base64Data = await getBase64(imgBlob);
            const mimeType = imgBlob.type || "image/jpeg";

            const analysis = await consultOracle(base64Data, mimeType);

            if (analysis.toUpperCase().includes("COVER") && !bookData.cover) {
                log(`Cover found: ${filename}. Syncing to vault...`);
                bookData.cover = await uploadartifact(`covers/${bookId}/${filename}`, imgBlob);
            } else if (analysis.toUpperCase().includes("MAP")) {
                log(`Map found: ${filename}. Syncing to vault...`);
                const mapUrl = await uploadartifact(`maps/${bookId}/${filename}`, imgBlob);
                bookData.maps.push({ 
                    name: filename, 
                    url: mapUrl, 
                    analysis: analysis,
                    id: crypto.randomUUID().substring(0, 8) 
                });
            }

            await savetolibrary(bookId, bookData);

        } catch (err) {
            log(`Error at ${filename}: ${err.message}`);
        }
    }

    log("Extraction complete. Vault is updated.");
};
