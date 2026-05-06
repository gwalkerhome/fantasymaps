// v1.0 battlemaster.js
import { CARTOGRAPHER_PROMPTS } from './prompts.js';

const log = (msg) => { document.getElementById('battlelog').innerText = msg; };

async function callGemini(prompt, key) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(data, null, 2);
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
            messages: [{ role: "user", content: prompt }]
        })
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || JSON.stringify(data, null, 2);
}

document.getElementById('startbattle').onclick = async () => {
    const file = document.getElementById('battleupload').files[0];
    const gKey = localStorage.getItem('gemini_key');
    const oKey = localStorage.getItem('openai_key');

    if (!file || !gKey || !oKey) return alert("Missing file or API keys!");

    log("Unzipping parchment for both scholars...");
    const zip = await JSZip.loadAsync(file);
    
    // Extract metadata (simplified for comparison)
    const imagefiles = Object.keys(zip.files).filter(f => f.match(/\.(jpg|jpeg|png)$/i));
    const prompt = CARTOGRAPHER_PROMPTS.buildBindingPrompt(["ch01", "ch02", "ch03"], imagefiles.map(f => ({name: f})));

    // Run Both Simultaneously
    document.getElementById('g_status').innerText = "Processing...";
    document.getElementById('o_status').innerText = "Processing...";

    callGemini(prompt, gKey).then(res => {
        document.getElementById('g_output').innerText = res;
        document.getElementById('g_status').innerText = "Complete";
    });

    callOpenAI(prompt, oKey).then(res => {
        document.getElementById('o_output').innerText = res;
        document.getElementById('o_status').innerText = "Complete";
    });

    log("The scholars are debating...");
};
