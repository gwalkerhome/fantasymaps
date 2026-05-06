// v1.8 battlemaster.js
import { CARTOGRAPHER_PROMPTS } from './prompts.js';

const MASTER_VERSION = "v1.8";

// Update version badges in the UI
const mV = document.getElementById('master-v');
const pV = document.getElementById('prompt-v');
if (mV) mV.innerText = MASTER_VERSION;
if (pV) pV.innerText = CARTOGRAPHER_PROMPTS.version || "unknown";

const log = (msg) => { document.getElementById('battlelog').innerText = msg; };

function cleanResponse(text) {
    if (typeof text !== 'string') return JSON.stringify(text);
    return text.replace(/```json/g, "").replace(/```/g, "").trim();
}

async function callGemini(prompt, key) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1 } })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return cleanResponse(data.candidates?.[0]?.content?.parts?.[0]?.text || "");
}

async function callOpenAI(prompt, key) {
    const url = `https://api.openai.com/v1/chat/completions`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }], temperature: 0.1 })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return cleanResponse(data.choices?.[0]?.message?.content || "");
}

async function runGeminiStation(prompt, key) {
    const s2 = document.getElementById('g_status_2');
    const s3 = document.getElementById('g_status_3');
    s2.innerText = "THINKING...";
    try {
        const res = await callGemini(prompt, key);
        document.getElementById('g_output').value = res;
        s2.innerText = "COMPLETE";
        const parsed = JSON.parse(res);
        document.getElementById('g_parsed').value = JSON.stringify(parsed.ledger, null, 2);
        s3.innerText = "PARSED";
    } catch (err) {
        s2.innerText = "FAILED: " + err.message;
        s3.innerText = "STALLED";
    }
}

async function runOpenAIStation(prompt, key) {
    const s2 = document.getElementById('o_status_2');
    const s3 = document.getElementById('o_status_3');
    s2.innerText = "THINKING...";
    try {
        const res = await callOpenAI(prompt, key);
        document.getElementById('o_output').value = res;
        s2.innerText = "COMPLETE";
        const parsed = JSON.parse(res);
        document.getElementById('o_parsed').value = JSON.stringify(parsed.ledger, null, 2);
        s3.innerText = "PARSED";
    } catch (err) {
        s2.innerText = "FAILED: " + err.message;
        s3.innerText = "STALLED";
    }
}

document.getElementById('startbattle').onclick = async () => {
    const file = document.getElementById('battleupload').files[0];
    if (!file) return;

    const gKey = localStorage.getItem('gemini_key');
    const oKey = localStorage.getItem('openai_key');
    
    log("Unzipping parchment...");
    const zip = await JSZip.loadAsync(file);
    const imagefiles = Object.keys(zip.files).filter(f => f.match(/\.(jpg|jpeg|png)$/i));
    const imgObjects = imagefiles.map(f => ({ name: f.split('/').pop() }));

    const testChapters = ["htp01", "ch01", "ch45", "ch80", "bm01"];
    const prompt = CARTOGRAPHER_PROMPTS.buildBindingPrompt(testChapters, imgObjects);

    document.getElementById('g_prompt').value = prompt;
    document.getElementById('o_prompt').value = prompt;
    document.getElementById('g_status_1').innerText = "READY";
    document.getElementById('o_status_1').innerText = "READY";

    log("The scholars are reviewing the maps...");
    runGeminiStation(prompt, gKey);
    runOpenAIStation(prompt, oKey);
};
