// v1.5 battlemaster.js
import { CARTOGRAPHER_PROMPTS } from './prompts.js';

const VERSION = "v1.5";
const log = (msg) => { 
    const el = document.getElementById('battlelog');
    if (el) el.innerText = msg;
    console.log(msg); 
};

// Update badge immediately
const badge = document.getElementById('version-badge');
if (badge) badge.innerText = VERSION;

function cleanResponse(text) {
    if (typeof text !== 'string') return JSON.stringify(text);
    return text.replace(/```json/g, "").replace(/```/g, "").trim();
}

async function callGemini(prompt, key) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1 }
        })
    });
    const data = await res.json();
    if (data.error) throw new Error(`Gemini: ${data.error.message}`);
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
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1
        })
    });
    const data = await res.json();
    if (data.error) throw new Error(`OpenAI: ${data.error.message}`);
    const raw = data.choices?.[0]?.message?.content || JSON.stringify(data);
    return cleanResponse(raw);
}

async function runTrial(imagefiles) {
    const gKey = localStorage.getItem('gemini_key');
    const oKey = localStorage.getItem('openai_key');

    if (!gKey || !oKey) {
        log("Error: API keys missing in settings.");
        return;
    }

    // Logic setup using your v1.0 prompt style
    const testChapters = ["htp01", "ch01", "ch45", "ch80", "bm01"];
    const imgObjects = imagefiles.map(f => ({ name: f.split('/').pop() }));
    
    const prompt = CARTOGRAPHER_PROMPTS.buildBindingPrompt(testChapters, imgObjects);

    // Station 1: Prompt
    document.getElementById('g_prompt').value = prompt;
    document.getElementById('o_prompt').value = prompt;
    document.getElementById('g_status_1').innerText = "READY";
    document.getElementById('o_status_1').innerText = "READY";

    // Station 2: Analysis
    document.getElementById('g_status_2').innerText = "THINKING...";
    document.getElementById('o_status_2').innerText = "THINKING...";

    try {
        const [gRes, oRes] = await Promise.all([
            callGemini(prompt, gKey),
            callOpenAI(prompt, oKey)
        ]);

        document.getElementById('g_output').value = gRes;
        document.getElementById('o_output').value = oRes;
        document.getElementById('g_status_2').innerText = "COMPLETE";
        document.getElementById('o_status_2').innerText = "COMPLETE";

        // Station 3: Final Ledger
        try {
            const gP = JSON.parse(gRes);
            const oP = JSON.parse(oRes);
            document.getElementById('g_parsed').value = JSON.stringify(gP.ledger, null, 2);
            document.getElementById('o_parsed').value = JSON.stringify(oP.ledger, null, 2);
            document.getElementById('g_status_3').innerText = "PARSED";
            document.getElementById('o_status_3').innerText = "PARSED";
        } catch (e) {
            document.getElementById('g_status_3').innerText = "PARSE ERROR";
            document.getElementById('o_status_3').innerText = "PARSE ERROR";
        }
        
        log("The scholars have finished their debate.");

    } catch (err) {
        log(`Trial Failed: ${err.message}`);
    }
}

document.getElementById('startbattle').onclick = async () => {
    const file = document.getElementById('battleupload').files[0];
    if (!file) return alert("Select a tome first.");
    
    log("Processing file...");
    const zip = await JSZip.loadAsync(file);
    const imagefiles = Object.keys(zip.files).filter(f => f.match(/\.(jpg|jpeg|png)$/i));
    
    sessionStorage.setItem('last_book_images', JSON.stringify(imagefiles));
    document.getElementById('clearbook').style.display = "inline-block";
    
    runTrial(imagefiles);
};

window.onload = () => {
    const remembered = sessionStorage.getItem('last_book_images');
    if (remembered) {
        document.getElementById('clearbook').style.display = "inline-block";
        runTrial(JSON.parse(remembered));
    }
};

document.getElementById('clearbook').onclick = () => {
    sessionStorage.removeItem('last_book_images');
    location.reload();
};
