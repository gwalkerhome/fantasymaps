// cartographer.js - The Silent Mapping Engine v1.0
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

async function processbook() {
    const fileinput = document.getElementById('bookupload');
    const apikey = localStorage.getItem('gemini_api_key');

    if (!fileinput.files[0]) return alert("Please select a tome (.epub).");
    if (!apikey) return alert("The Arcane Engine requires an API Key. Check Settings.");

    const file = fileinput.files[0];
    const btn = document.getElementById('processbutton');
    
    btn.disabled = true;
    log(`Initializing Cartographer for: ${file.name}`);

    try {
        const zip = await JSZip.loadAsync(file);
        
        // 1. Extract Spine and TOC
        log("Unfolding the map of the book (Metadata)...");
        const containerxml = await zip.file("META-INF/container.xml").async("string");
        const parser = new DOMParser();
        const rootPath = parser.parseFromString(containerxml, "text/xml").getElementsByTagName("rootfile")[0].getAttribute("full-path");
        const contentxml = await zip.file(rootPath).async("string");
        const contentdoc = parser.parseFromString(contentxml, "text/xml");

        const title = contentdoc.getElementsByTagName("dc:title")[0]?.textContent || file.name;
        const bookid = title.toLowerCase().replace(/[^a-z0-9]/g, '_');
        
        // Get Chapters (manifest items referenced in the spine)
        const spine = Array.from(contentdoc.getElementsByTagName("itemref"))
            .map(ref => ref.getAttribute("idref"));
        log(`Identified ${spine.length} segments to analyze.`);

        // 2. Harvest Images
        log("Gathering illustrations and scrolls...");
        const imagefiles = Object.keys(zip.files).filter(f => f.match(/\.(jpg|jpeg|png)$/i));
        const artifactledger = [];

        // 3. Silent Upload & Preparation
        // We upload the first few as a proof of concept for the ledger
        for (const path of imagefiles.slice(0, 15)) {
            const imgfile = zip.file(path);
            const blob = await imgfile.async("blob");
            const filename = path.split('/').pop();
            
            log(`Securing artifact: ${filename}`);
            const url = await uploadartifact(`library/${bookid}/artifacts/${filename}`, blob);
            
            artifactledger.push({
                name: filename,
                url: url,
                type: "unknown" // This will be updated by Gemini in the next pass
            });
        }

        // 4. Update the Vault
        await savetolibrary(bookid, {
            title: title,
            bookid: bookid,
            status: "analyzed",
            segments: spine,
            artifacts: artifactledger,
            last_processed: new Date().toISOString()
        });

        log("Cartography complete. The ledger is synced to the vault.");
        alert("The tome is ready for the Map Room.");
        btn.disabled = false;

    } catch (error) {
        log(`Cartography Error: ${error.message}`);
        btn.disabled = false;
    }
}

// Attach to the button
document.getElementById('processbutton').addEventListener('click', processbook);
