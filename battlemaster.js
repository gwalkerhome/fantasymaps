// v1.3 battlemaster.js
import { CARTOGRAPHER_PROMPTS } from './prompts.js';

const VERSION = "v1.3";
const log = (msg) => { document.getElementById('battlelog').innerText = msg; };

function cleanResponse(text) {
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
    const raw = data.choices?.[0]?.message?.content || JSON.stringify(data);
    return cleanResponse(raw);
}

async function runTrial(imagefiles) {
    const gKey = localStorage.getItem('gemini_key');
    const oKey = localStorage.getItem('openai_key');

    if (!gKey || !oKey) return alert("Missing API keys!");

    // STRESS TEST DATA v1.3
    // Testing logic across different book sections
    const complexSpine = ["htp01", "ch01", "pt02", "ch45", "ch80", "bm01"]; 
    
    // Crucial: Manually inject sp.jpg if not found (for testing Sanderson context)
    let foundImages = imagefiles.map(f => ({name: f.split('/').pop()}));
    if (!foundImages.find(img => img.name === 'sp.jpg')) {
        foundImages.push({name: 'sp.jpg'});
        log("Context Inject: sp.jpg added for Sanderson trial.");
    }

    const prompt = CARTOGRAPHER_PROMPTS.buildBindingPrompt(complexSpine, foundImages);

    // Populate Station 1: Prompt Debug
    document.getElementById('g_prompt').value = prompt;
    document.getElementById('o_prompt').value = prompt;
    document.getElementById('g_status_1').innerText = "Constructed";
    document.getElementById('o_status_1').innerText = "Constructed";

    // Start Station 2: Raw Analysis
    document.getElementById('g_status_2').innerText = "Analyzing...";
    document.getElementById('o_status_2').innerText = "Analyzing...";

    Promise.all([
        callGemini(prompt, gKey),
        callOpenAI(prompt, oKey)
    ]).then(([gRes, oRes]) => {
        // station 2 outputs
        document.getElementById('g_output').value = gRes;
        document.getElementById('o_output').value = oRes;
        document.getElementById('g_status_2').innerText = "Complete";
        document.getElementById('o_status_2').innerText = "Complete";

        // station 3: Parsed Preview (Simulates what the Scribe will save)
        try {
            const gData = JSON.parse(gRes);
            const oData = JSON.parse(oRes);
            document.getElementById('g_parsed').value = JSON.stringify(gData.ledger, null, 2);
            document.getElementById('o_parsed').value = JSON.stringify(oData.ledger, null, 2);
            document.getElementById('g_status_3').innerText = "Parsed OK";
            document.getElementById('o_status_3').innerText = "Parsed OK";
        } catch (err) {
            document.getElementById('g_status_3').innerText = "Parse Error";
            document.getElementById('o_status_3').innerText = "Parse Error";
            log("Crucial Error: One model returned invalid JSON.");
        }

        log("Tome analysis finalized in the factory line.");
    });
}

// Memory & Clear logic (same as v1.2)
document.getElementById('startbattle').onclick = async () => {
    const file = document.getElementById('battleupload').files[0];
    if (!file) return alert("Select a tome first.");
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
