// v3.0 | battlemaster.js
import { CARTOGRAPHER_PROMPTS } from './prompts.js';

const VERSION = "v3.0";

const updateBadge = () => {
    const badge = document.getElementById('version-badge');
    if (badge) badge.innerText = VERSION;
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateBadge);
} else {
    updateBadge();
}

const getBase64 = (blob) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

async function callOpenAIVision(base64Data, mimeType, key) {
    const url = "https://api.openai.com/v1/chat/completions";
    const prompt = CARTOGRAPHER_PROMPTS.describeImagePrompt();

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
        max_tokens: 500
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
    if (data.error) throw new Error(data.error.message);
    return data.choices[0].message.content || "No description returned.";
}

document.getElementById('startbattle').onclick = async () => {
    const file = document.getElementById('battleupload').files[0];
    if (!file) return;
    
    const oKey = localStorage.getItem('openai_key');
    const zip = await JSZip.loadAsync(file);
    
    const imageFiles = Object.keys(zip.files).filter(f => f.match(/\.(jpg|jpeg|png)$/i));
    
    if (imageFiles.length === 0) {
        document.getElementById('battlelog').innerText = "No images found.";
        return;
    }

    const logEl = document.getElementById('o_output'); // Right side output
    const statusEl = document.getElementById('o_status_2'); // Right side status
    const parsedEl = document.getElementById('o_parsed'); // Right side parsed
    const debugBox = document.getElementById('o_prompt'); // Right side prompt
    
    if (logEl) logEl.value = "Starting OpenAI Image Inventory...\n";
    let inventory = [];

    for (const path of imageFiles) {
        const filename = path.split('/').pop();
        if (statusEl) statusEl.innerText = `Analyzing: ${filename}...`;
        if (debugBox) debugBox.value = `[Vision Request: ${path}]`;

        try {
            const imgBlob = await zip.file(path).async("blob");
            const base64Data = await getBase64(imgBlob);
            const mimeType = imgBlob.type || "image/jpeg";
            
            const description = await callOpenAIVision(base64Data, mimeType, oKey);
            
            inventory.push({
                file: filename,
                description: description
            });

            // Update right-hand display
            if (logEl) logEl.value += `DONE: ${filename}\n`;
            if (parsedEl) parsedEl.value = JSON.stringify(inventory, null, 2);

        } catch (err) {
            if (logEl) logEl.value += `ERROR on ${filename}: ${err.message}\n`;
        }
    }
    
    if (statusEl) statusEl.innerText = "Inventory Complete.";
};
