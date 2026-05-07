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

async function callGeminiVision(base64Data, mimeType, key) {
    // Switching back to 2.5-flash to utilize your higher quota
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

    // Still sticking to Goal A: Extracting the first image for visual description
    const targetPath = imageFiles[0];
    const imgBlob = await zip.file(targetPath).async("blob");
    const reader = new FileReader();
    
    reader.onloadend = async () => {
        const base64Data = reader.result.split(',')[1];
        const mimeType = imgBlob.type || "image/jpeg";
        
        document.getElementById('g_prompt').value = `[Vision Request: ${targetPath}]`;
        document.getElementById('g_status_2').innerText = "Analyzing image with 2.5-Flash...";

        try {
            const description = await callGeminiVision(base64Data, mimeType, gKey);
            document.getElementById('g_output').value = description;
            document.getElementById('g_status_2').innerText = "Analysis Complete.";
        } catch (err) {
            document.getElementById('g_output').value = "Error: " + err.message;
            document.getElementById('g_status_2').innerText = "Quota/Connection Error.";
        }
    };
    
    reader.readAsDataURL(imgBlob);
};
