// v2.9 | battlemaster.js
import { CARTOGRAPHER_PROMPTS } from './prompts.js';

const VERSION = "v2.9";

const updateBadge = () => {
    const badge = document.getElementById('version-badge');
    if (badge) badge.innerText = VERSION;
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateBadge);
} else {
    updateBadge();
}

// Helper to convert blob to base64
const getBase64 = (blob) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

async function callGeminiVision(base64Data, mimeType, key) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    const prompt = CARTOGRAPHER_PROMPTS.describeImagePrompt();

    const body = {
        contents: [{
            parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType, data: base64Data } }
            ]
        }]
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "No description returned.";
}

document.getElementById('startbattle').onclick = async () => {
    const file = document.getElementById('battleupload').files[0];
    if (!file) return;
    
    const gKey = localStorage.getItem('gemini_key');
    const zip = await JSZip.loadAsync(file);
    
    const imageFiles = Object.keys(zip.files).filter(f => f.match(/\.(jpg|jpeg|png)$/i));
    
    if (imageFiles.length === 0) {
        document.getElementById('battlelog').innerText = "No images found.";
        return;
    }

    const logEl = document.getElementById('g_output');
    const statusEl = document.getElementById('g_status_2');
    const parsedEl = document.getElementById('g_parsed');
    const debugBox = document.getElementById('g_prompt');
    
    if (logEl) logEl.value = "Starting Full Inventory...\n";
    let inventory = [];

    for (const path of imageFiles) {
        const filename = path.split('/').pop();
        if (statusEl) statusEl.innerText = `Analyzing: ${filename}...`;
        if (debugBox) debugBox.value = `[Vision Request: ${path}]`;

        try {
            const imgBlob = await zip.file(path).async("blob");
            const base64Data = await getBase64(imgBlob);
            const mimeType = imgBlob.type || "image/jpeg";
            
            const description = await callGeminiVision(base64Data, mimeType, gKey);
            
            inventory.push({
                file: filename,
                description: description
            });

            // Update display real-time
            if (logEl) logEl.value += `DONE: ${filename}\n`;
            if (parsedEl) parsedEl.value = JSON.stringify(inventory, null, 2);

        } catch (err) {
            if (logEl) logEl.value += `ERROR on ${filename}: ${err.message}\n`;
        }
    }
    
    if (statusEl) statusEl.innerText = "Inventory Complete.";
};
