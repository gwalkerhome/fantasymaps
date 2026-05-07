// v2.7 | battlemaster.js
import { CARTOGRAPHER_PROMPTS } from './prompts.js';

const VERSION = "v2.7";

const updateBadge = () => {
    const badge = document.getElementById('version-badge');
    if (badge) badge.innerText = VERSION;
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateBadge);
} else {
    updateBadge();
}

// Helper to convert file to Base64 for Vision tasks
const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
});

async function describeImage(base64Data, filename, key) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
    const prompt = CARTOGRAPHER_PROMPTS.buildImageDescriptionPrompt(filename);
    
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [
                    { text: prompt },
                    { inline_data: { mime_type: "image/jpeg", data: base64Data } }
                ]
            }]
        })
    });
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "No description generated.";
}

document.getElementById('startbattle').onclick = async () => {
    const file = document.getElementById('battleupload').files[0];
    if (!file) return;
    
    const zip = await JSZip.loadAsync(file);
    const imagePaths = Object.keys(zip.files).filter(f => f.match(/\.(jpg|jpeg|png)$/i));
    const gKey = localStorage.getItem('gemini_key');
    
    const inventory = [];
    const logEl = document.getElementById('g_output');
    if (logEl) logEl.value = "Starting Image Inventory...\n";

    for (const path of imagePaths) {
        const filename = path.split('/').pop();
        if (logEl) logEl.value += `Analyzing: ${filename}...\n`;
        
        const imgBlob = await zip.file(path).async("blob");
        const b64 = await toBase64(imgBlob);
        
        const descriptionRaw = await describeImage(b64, filename, gKey);
        
        // We will parse the AI's response into our Inventory
        inventory.push({
            file: filename,
            path: path,
            analysis: descriptionRaw
        });
    }

    // Display the final inventory for review
    document.getElementById('g_parsed').value = JSON.stringify(inventory, null, 2);
    if (logEl) logEl.value += "\nInventory Complete.";
};
