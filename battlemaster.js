// v3.1 | battlemaster.js
import { CARTOGRAPHER_PROMPTS } from './prompts.js';

const VERSION = "v3.1";

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

async function callOpenAIVision(base64Data, mimeType, key, isDeepScan = false) {
    const url = "https://api.openai.com/v1/chat/completions";
    // Choose prompt based on scan type
    const prompt = isDeepScan ? CARTOGRAPHER_PROMPTS.spatialMappingPrompt() : CARTOGRAPHER_PROMPTS.describeImagePrompt();

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
        max_tokens: 1500 // Increased for detailed coordinate JSON
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
    return data.choices[0].message.content || "No data returned.";
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

    const logEl = document.getElementById('o_output');
    const statusEl = document.getElementById('o_status_2');
    const parsedEl = document.getElementById('o_parsed');
    const debugBox = document.getElementById('o_prompt');
    
    if (logEl) logEl.value = "Starting OpenAI Image Inventory...\n";
    let inventory = [];

    for (const path of imageFiles) {
        const filename = path.split('/').pop();
        if (statusEl) statusEl.innerText = `Analyzing: ${filename}...`;

        try {
            const imgBlob = await zip.file(path).async("blob");
            const base64Data = await getBase64(imgBlob);
            const mimeType = imgBlob.type || "image/jpeg";
            
            // Phase 1: Basic Description
            const description = await callOpenAIVision(base64Data, mimeType, oKey, false);
            
            inventory.push({
                file: filename,
                description: description,
                path: path // Keep path for retrieval
            });

            if (logEl) logEl.value += `DONE: ${filename}\n`;
            
            // Phase 2: If it's a map, trigger Deep Spatial Scan immediately
            if (description.toUpperCase().includes("MAP")) {
                if (logEl) logEl.value += `TARGET ACQUIRED: Deep scanning ${filename} for coordinates...\n`;
                const spatialData = await callOpenAIVision(base64Data, mimeType, oKey, true);
                
                // Save spatial data and the image base64 for the maptest.html page
                localStorage.setItem('active_map_data', spatialData);
                localStorage.setItem('active_map_image', `data:${mimeType};base64,${base64Data}`);
                
                if (logEl) logEl.value += `SPATIAL LEDGER STORED for ${filename}.\n`;
            }

            if (parsedEl) parsedEl.value = JSON.stringify(inventory, null, 2);

        } catch (err) {
            if (logEl) logEl.value += `ERROR on ${filename}: ${err.message}\n`;
        }
    }
    
    if (statusEl) statusEl.innerText = "Inventory Complete.";
};
