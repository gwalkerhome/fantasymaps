// v2.4 | battlemaster.js
import { CARTOGRAPHER_PROMPTS } from './prompts.js';

const VERSION = "v2.4";

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
    
    // Clean image list
    const imgList = imagefiles.map(f => ({ name: f.split('/').pop() }));
    
    // Build the prompt with the new content context
    const prompt = CARTOGRAPHER_PROMPTS.buildBindingPrompt(chapterData, imgList);
    
    if (document.getElementById('g_prompt')) document.getElementById('g_prompt').value = prompt;
    if (document.getElementById('o_prompt')) document.getElementById('o_prompt').value = prompt;

    const runStation = async (engine, key, outId, parseId, statusId) => {
        try {
            const res = await (engine === 'gemini' ? callGemini(prompt, key) : callOpenAI(prompt, key));
            document.getElementById(outId).value = res;
            const parsed = JSON.parse(res);
            document.getElementById(parseId).value = JSON.stringify(parsed.ledger, null, 2);
        } catch (err) {
            console.error(err);
        }
    };

    runStation('gemini', gKey, 'g_output', 'g_parsed', 'g_status_2');
    runStation('openai', oKey, 'o_output', 'o_parsed', 'o_status_2');
}

document.getElementById('startbattle').onclick = async () => {
    const file = document.getElementById('battleupload').files[0];
    if (!file) return;
    
    const zip = await JSZip.loadAsync(file);
    const imagefiles = Object.keys(zip.files).filter(f => f.match(/\.(jpg|jpeg|png)$/i));
    
    // Grab first 5 chapters for analysis
    const chapterFiles = Object.keys(zip.files).filter(f => f.match(/\.(xhtml|html)$/i)).slice(0, 5);
    const chapterData = await Promise.all(chapterFiles.map(async (name) => {
        const content = await zip.file(name).async("string");
        // Simple HTML strip and take first 800 chars
        const text = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 800);
        return { name: name.split('/').pop(), text: text };
    }));

    runTrial(imagefiles, chapterData);
};
