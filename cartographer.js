// cartographer.js - v1.1
import { savetolibrary, uploadartifact } from './firebase.js';
import { CARTOGRAPHER_PROMPTS } from './prompts.js';

const log = (msg) => {
    const el = document.getElementById('statuslog');
    if (el) {
        el.style.display = "block";
        el.innerHTML += `> ${msg}<br>`;
        el.scrollTop = el.scrollHeight;
    }
};

const mirror = (content) => {
    document.getElementById('aimirror').value = content;
};

async function callgemini(prompt, apikey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apikey}`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { response_mime_type: "application/json" }
        })
    });

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

async function processbook() {
    const fileinput = document.getElementById('bookupload');
    const apikey = localStorage.getItem('gemini_api_key');

    if (!fileinput.files[0]) return alert("Select a tome first.");
    if (!apikey) return alert("API Key missing in Settings.");

    const file = fileinput.files[0];
    const btn = document.getElementById('processbutton');
    btn.disabled = true;

    try {
        const zip = await JSZip.loadAsync(file);
        log("Unzipping parchment...");

        // 1. Extract Info
        const containerxml = await zip.file("META-INF/container.xml").async("string");
        const parser = new DOMParser();
        const rootPath = parser.parseFromString(containerxml, "text/xml").getElementsByTagName("rootfile")[0].getAttribute("full-path");
        const contentxml = await zip.file(rootPath).async("string");
        const contentdoc = parser.parseFromString(contentxml, "text/xml");

        const title = contentdoc.getElementsByTagName("dc:title")[0]?.textContent || file.name;
        const bookid = title.toLowerCase().replace(/[^a-z0-9]/g, '_');
        
        const spine = Array.from(contentdoc.getElementsByTagName("itemref")).map(ref => ref.getAttribute("idref"));
        const imagefiles = Object.keys(zip.files).filter(f => f.match(/\.(jpg|jpeg|png)$/i));

        // 2. Prepare AI Binding
        log("Consulting the Cartographer's prompt...");
        const imgList = imagefiles.map(f => ({ name: f.split('/').pop() }));
        const prompt = CARTOGRAPHER_PROMPTS.buildBindingPrompt(spine, imgList);

        log("Sending request to Gemini...");
        const aiResponse = await callgemini(prompt, apikey);
        mirror(aiResponse); // Show the raw result in the Mirror!

        // 3. Parse and Save
        const ledgerData = JSON.parse(aiResponse);
        
        await savetolibrary(bookid, {
            title: title,
            status: "ready",
            ledger: ledgerData.ledger,
            segments: spine,
            last_updated: new Date().toISOString()
        });

        log("Ledger sealed. The tome is ready.");
        btn.disabled = false;

    } catch (error) {
        log(`Error: ${error.message}`);
        btn.disabled = false;
    }
}

document.getElementById('processbutton').addEventListener('click', processbook);
