// v2.8 | battlemaster.js
import { CARTOGRAPHER_PROMPTS } from './prompts.js';

const VERSION = "v2.8";

const updateBadge = () => {
    const badge = document.getElementById('version-badge');
    if (badge) badge.innerText = VERSION;
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateBadge);
} else {
    updateBadge();
}

const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
});

async function describeImage(base64Data, filename, key) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
    const promptText = CARTOGRAPHER_PROMPTS.buildImageDescriptionPrompt(filename);
    
    // Update the debug box so you can see the prompt
    const debugBox = document.getElementById('g_prompt');
    if (debugBox) debugBox.value = promptText;

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: promptText },
                        { inline_data: { mime_type: "image/jpeg", data: base64Data } }
                    ]
                }],
                generationConfig: { temperature: 0.1 }
            })
        });
        
        const data = await res.json();
        
        if (data.error) {
            return `API ERROR: ${data.error.message}`;
        }
        
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
        return textResponse ? textResponse.replace(/
http://googleusercontent.com/immersive_entry_chip/0

**What to look for now:**
* If the `analysis` still says "FETCH ERROR" or "API ERROR," check the `g_output` box for the specific message. 
* The `g_prompt` box should now show the text instructions I wrote in **prompts.js**.

Please update both files and let's see if we can get the AI to actually describe the images this time.
