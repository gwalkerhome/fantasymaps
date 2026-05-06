// v2.3 | battlemaster.js
import { CARTOGRAPHER_PROMPTS } from './prompts.js';

const VERSION = "v2.3";

const updateBadge = () => {
    const badge = document.getElementById('version-badge');
    if (badge) badge.innerText = VERSION;
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateBadge);
} else {
    updateBadge();
}

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

async function runTrial(imagefiles, chapterData) {
    const gKey = localStorage.getItem('gemini_key');
    const oKey = localStorage.getItem('openai_key');
    const imgList = imagefiles.map(f => ({ name: f.split('/').pop() }));
    
    // Pass the rich chapter data (name + snippet) to the prompt builder
    const prompt = CARTOGRAPHER_PROMPTS.buildBindingPrompt(chapterData, imgList);
    
    if (document.getElementById('g_prompt')) document.getElementById('g_prompt').value = prompt;
    if (document.getElementById('o_prompt')) document.getElementById('o_prompt').value = prompt;

    // Run both
    const runG = async () => {
        const res = await callGemini(prompt, gKey);
        document.getElementById('g_output').value = res;
        document.getElementById('g_parsed').value = JSON.stringify(JSON.parse(res).ledger, null, 2);
    };
    const runO = async () => {
        const res = await callOpenAI(prompt, oKey);
        document.getElementById('o_output').value = res;
        document.getElementById('o_parsed').value = JSON.stringify(JSON.parse(res).ledger, null, 2);
    };

    runG();
    runO();
}

document.getElementById('startbattle').onclick = async () => {
    const file = document.getElementById('battleupload').files[0];
    if (!file) return;
    
    const zip = await JSZip.loadAsync(file);
    const imagefiles = Object.keys(zip.files).filter(f => f.match(/\.(jpg|jpeg|png)$/i));
    
    // Find chapter files (xhtml/html) and grab a snippet of text
    const chapterFiles = Object.keys(zip.files).filter(f => f.match(/\.(xhtml|html)$/i)).slice(0, 5);
    const chapterData = await Promise.all(chapterFiles.map(async (name) => {
        const text = await zip.file(name).async("string");
        // Strip HTML tags and grab first 1000 chars
        const cleanText = text.replace(/<[^>]*>/g, ' ').substring(0, 1000);
        return { id: name.split('/').pop(), snippet: cleanText };
    }));

    runTrial(imagefiles, chapterData);
};
