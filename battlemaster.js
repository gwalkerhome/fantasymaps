// v1.1 battlemaster.js
import { CARTOGRAPHER_PROMPTS } from './prompts.js';

const log = (msg) => { document.getElementById('battlelog').innerText = msg; };

// The "Bulletproof" Cleaner
function cleanResponse(text) {
    return text.replace(/```json/g, "").replace(/```/g, "").trim();
}

async function callGemini(prompt, key) {
    // Using the 2.5-flash model from your list
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            contents: [{ parts: [{ text: prompt + "\n\nResponse must be valid JSON." }] }],
            generationConfig: { temperature: 0.1 }
        })
    });
    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(data);
    return cleanResponse(raw);
}

async function callOpenAI(prompt, key) {
    const url = `https://api.openai.com/v1/chat/completions`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt + "\n\nResponse must be valid JSON." }],
            temperature: 0.1
        })
    });
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || JSON.stringify(data);
    return cleanResponse(raw);
}

document.getElementById('startbattle').onclick = async () => {
    const fileInput = document.getElementById('battleupload');
    const gKey = localStorage.getItem('gemini_key');
    const oKey = localStorage.getItem('openai_key');

    if (!fileInput.files[0] || !gKey || !oKey) return alert("Missing file or API keys!");

    log("Analyzing the Tome's structure...");
    const zip = await JSZip.loadAsync(fileInput.files[0]);
    
    // Extraction Logic
    const imagefiles = Object.keys(zip.files).filter(f => f.match(/\.(jpg|jpeg|png)$/i));
    
    // STRESS TEST DATA
    // We are simulating the "Way of Kings" complex chapter list here
    const complexSpine = ["ch01", "ch02", "ch45", "ch80", "bm01"]; 
    const imgList = imagefiles.map(f => ({name: f.split('/').pop()}));

    const prompt = CARTOGRAPHER_PROMPTS.buildBindingPrompt(complexSpine, imgList);

    document.getElementById('g_status').innerText = "Gemini is thinking...";
    document.getElementById('o_status').innerText = "OpenAI is thinking...";

    // Execute Duel
    Promise.all([
        callGemini(prompt, gKey),
        callOpenAI(prompt, oKey)
    ]).then(([gRes, oRes]) => {
        document.getElementById('g_output').innerText = gRes;
        document.getElementById('o_output').innerText = oRes;
        document.getElementById('g_status').innerText = "Complete";
        document.getElementById('o_status').innerText = "Complete";
        log("The Trial is concluded. Compare the bindings below.");
    }).catch(err => {
        log("Error in the Arena: " + err.message);
    });
};
