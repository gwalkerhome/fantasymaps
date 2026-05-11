// v4.0 | extraction.js — full book intake: maps, character list, chapters, Pass 1
import { savetolibrary, uploadartifact, db } from './firebase.js';
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { CARTOGRAPHER_PROMPTS } from './prompts.js';

const VERSION = 'v4.0';
const USERID  = 'default-user';
const parser  = new DOMParser();

// ── DOM refs ────────────────────────────────────────────────────────────────
const statusLog     = document.getElementById('statuslog');
const processButton = document.getElementById('processbutton');
const fileInput     = document.getElementById('bookupload');
const uploadZone    = document.getElementById('upload-zone');
const fileChosen    = document.getElementById('file-chosen');
const progressPanel = document.getElementById('progress-panel');
const resultsPanel  = document.getElementById('results-panel');

// ── Logging ──────────────────────────────────────────────────────────────────
function log(msg, isError = false) {
    const entry = document.createElement('div');
    entry.textContent = `> ${msg}`;
    if (isError) entry.classList.add('err');
    statusLog.appendChild(entry);
    statusLog.scrollTop = statusLog.scrollHeight;
    console.log(`[scribe ${VERSION}] ${msg}`);
}

// ── Stage UI control ─────────────────────────────────────────────────────────
function setStage(id, status, detail = null) {
    const row = document.getElementById('stage-' + id);
    if (!row) return;
    row.className = 'stage-row ' + status;
    const orb = row.querySelector('.stage-orb');
    orb.className = 'stage-orb ' + status;
    orb.textContent = status === 'done'    ? '✓'
                    : status === 'error'   ? '✗'
                    : status === 'skipped' ? '—'
                    : '';
    if (detail !== null) {
        const el = row.querySelector('.stage-detail');
        if (el) el.textContent = detail;
    }
}

// ── Upload zone wiring ───────────────────────────────────────────────────────
uploadZone.addEventListener('click', () => fileInput.click());

uploadZone.addEventListener('dragover', e => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
});
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', e => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.epub')) {
        // Manually assign to the input so existing logic still works
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        showFileChosen(file);
    }
});

fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) showFileChosen(file);
});

function showFileChosen(file) {
    fileChosen.textContent = `${file.name}  (${(file.size / 1024).toFixed(0)} KB)`;
    fileChosen.style.display = 'block';
    processButton.disabled = false;
}

// ── Utility: file → base64 ───────────────────────────────────────────────────
function getBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// ── Utility: slug ────────────────────────────────────────────────────────────
const slug = s => (s || '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

// ── AI callers ────────────────────────────────────────────────────────────────
async function callOpenAI(systemPrompt, userContent, key) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user',   content: userContent }
            ]
        })
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `OpenAI error ${res.status}`);
    }
    const data = await res.json();
    return data.choices[0].message.content;
}

async function callGemini(systemPrompt, userContent, key) {
    const fullPrompt = systemPrompt + '\n\n' + userContent;
    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: fullPrompt }] }],
                generationConfig: {
                    responseMimeType: 'application/json',
                    maxOutputTokens: 65536
                }
            })
        }
    );
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Gemini error ${res.status}`);
    }
    const data = await res.json();
    return data.candidates[0].content.parts[0].text;
}

async function callAI(systemPrompt, userContent, aiModel, keys) {
    if (aiModel === 'gemini' && keys.gemini) {
        return callGemini(systemPrompt, userContent, keys.gemini);
    }
    if (keys.openai) {
        return callOpenAI(systemPrompt, userContent, keys.openai);
    }
    throw new Error('No API key available. Visit API Settings first.');
}

// ── Image orientation check and rotation (unchanged from v3) ─────────────────
async function checkOrientation(base64Data, mimeType, key) {
    const url = 'https://api.openai.com/v1/chat/completions';
    const body = {
        model: 'gpt-4o-mini',
        messages: [{
            role: 'user',
            content: [
                { type: 'text', text: `This is a fantasy book map. Is it correctly oriented so that any text labels are readable and the map looks right-way-up?\n\nReply with ONLY one of these four words — nothing else:\nCORRECT\nROTATE_90\nROTATE_180\nROTATE_270\n\nROTATE_90 = rotate clockwise 90 degrees to fix it.\nROTATE_180 = rotate 180 degrees to fix it.\nROTATE_270 = rotate clockwise 270 degrees (anti-clockwise 90 degrees) to fix it.` },
                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } }
            ]
        }],
        max_tokens: 15
    };
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.error) return 'CORRECT';
        const reply = (data.choices?.[0]?.message?.content || 'CORRECT').trim().toUpperCase();
        for (const kw of ['ROTATE_90', 'ROTATE_180', 'ROTATE_270', 'CORRECT']) {
            if (reply.includes(kw)) return kw;
        }
        return 'CORRECT';
    } catch { return 'CORRECT'; }
}

function rotateBlob(blob, degrees) {
    return new Promise(resolve => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(blob);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const swapped = (degrees === 90 || degrees === 270);
            canvas.width  = swapped ? img.height : img.width;
            canvas.height = swapped ? img.width  : img.height;
            const ctx = canvas.getContext('2d');
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(degrees * Math.PI / 180);
            ctx.drawImage(img, -img.width / 2, -img.height / 2);
            URL.revokeObjectURL(objectUrl);
            canvas.toBlob(b => resolve(b || blob), blob.type || 'image/jpeg', 0.92);
        };
        img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(blob); };
        img.src = objectUrl;
    });
}

// ── Section classifier ────────────────────────────────────────────────────────
function classifySection(title) {
    const t = (title || '').toLowerCase().trim();

    const patterns = {
        character_list: [
            'characters', 'dramatis personae', 'cast of characters',
            "who's who", 'principal characters', 'people in this book',
            'a note on names', 'the characters', 'character list',
            'persons of the story', 'the cast'
        ],
        back_matter: [
            'acknowledgement', 'acknowledgment', 'about the author', 'about the book',
            'also by', 'by the same author', 'other books by', 'coming soon',
            'excerpt from', 'preview of', 'praise for', 'afterword',
            'bibliography', 'further reading', 'appendix', "author's note",
            'a note from the author', 'note to reader', 'permissions',
            'discover more', 'more from', 'want more'
        ],
        front_matter: [
            'dedication', 'epigraph', 'foreword', 'preface',
            'copyright', 'table of contents', 'contents'
        ],
        glossary: [
            'glossary', 'pronunciation guide', 'place names', 'glossary of terms',
            'notes on', 'a guide to'
        ],
        map_section: ['map of', 'maps']
    };

    for (const [type, pats] of Object.entries(patterns)) {
        for (const p of pats) {
            if (t.includes(p)) return type;
        }
    }

    return 'chapter';
}

// ── Extract all sections from epub spine ──────────────────────────────────────
async function extractSections(zip, opfPath) {
    const opfDir = opfPath.includes('/')
        ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1)
        : '';

    const opfFile = zip.file(opfPath);
    const opfXml  = await opfFile.async('string');
    const opfDoc  = parser.parseFromString(opfXml, 'text/xml');

    // Build manifest: id → href
    const manifest = {};
    opfDoc.querySelectorAll('manifest item').forEach(item => {
        const mt = item.getAttribute('media-type') || '';
        if (mt.includes('html') || mt.includes('xhtml')) {
            manifest[item.getAttribute('id')] = opfDir + item.getAttribute('href');
        }
    });

    // Get ordered spine
    const spineIds = [];
    opfDoc.querySelectorAll('spine itemref').forEach(ref => {
        spineIds.push(ref.getAttribute('idref'));
    });

    const sections = [];
    for (const id of spineIds) {
        const href = manifest[id];
        if (!href) continue;

        const file = zip.file(href);
        if (!file) continue;

        const html = await file.async('string');
        const htmlDoc = parser.parseFromString(html, 'text/html');

        // Remove scripts and style blocks
        htmlDoc.querySelectorAll('script, style, nav').forEach(el => el.remove());

        // Get section title — prefer h1/h2, fall back to <title>
        const headingEl = htmlDoc.querySelector('h1, h2, h3');
        const titleEl   = htmlDoc.querySelector('title');
        const title = (headingEl?.textContent || titleEl?.textContent || id).trim();

        // Extract clean text
        const text = (htmlDoc.body?.textContent || '')
            .replace(/\s+/g, ' ')
            .trim();

        if (text.length < 80) continue; // skip near-empty sections

        const classification = classifySection(title);
        sections.push({ id, href, title, text, classification });
    }

    return sections;
}

// ── Parse character list with AI ──────────────────────────────────────────────
async function parseCharacterList(text, aiModel, keys) {
    const sysPrompt = `You are parsing a character list from a fantasy novel.
Extract all character names and any known aliases, epithets or alternative names.

Return ONLY valid JSON — no other text:
{
  "characters": [
    {
      "name": "<canonical name>",
      "aliases": ["<alias or epithet>"],
      "description": "<one-line description, or empty string>"
    }
  ]
}`;
    const userContent = 'Character list text:\n\n' + text.substring(0, 8000);
    const raw = await callAI(sysPrompt, userContent, aiModel, keys);
    const parsed = JSON.parse(raw);
    return parsed.characters || [];
}

// ── Build Pass 1 system prompt ────────────────────────────────────────────────
function buildPass1Prompt(registerText) {
    return `You are a character extraction assistant for a fantasy novel reader application.

Your task: read a complete novel provided as numbered chapters and for EACH chapter, identify every character who is PHYSICALLY PRESENT, reporting their location at the END of that chapter.

CHARACTER REGISTER (canonical names and known aliases):
${registerText}

INSTRUCTIONS:
1. Process EVERY chapter. Return a characters array for each (it may be empty if no named characters have a clear location).
2. Only include characters physically present in the scene. Exclude characters mentioned in dialogue, memory, or flashback.
3. Report each character's location at the END of the chapter. If they move, report their final position.
4. For group travel ("they rode north"), give each named member their own entry with status "group_implied" and the same location.
5. Resolve aliases and epithets to canonical names from the register where possible.
6. Assign a status to each character:
   placed | vague | no_location | off_map | wrong_map | referenced_only | group_implied | new_character | ambiguous
7. Assign confidence: high | medium | low
8. CRITICAL — location_description must name the SETTLEMENT, FORTRESS, REGION or NAMED GEOGRAPHIC FEATURE where the character is.
   Do NOT describe their position within a building (room, chamber, doorway, tower, hall).
   If a character is inside a building, name the settlement that building belongs to.
   Example: write "Murias" not "in the great hall of Murias".

Return ONLY valid JSON — no markdown, no explanation:
{
  "chapters": [
    {
      "chapter_num": 1,
      "title": "<chapter title>",
      "characters": [
        {
          "name": "<canonical name>",
          "aliases_used": [],
          "location_description": "<settlement, fortress, or region name>",
          "status": "<see above>",
          "confidence": "<high|medium|low>",
          "map_hint": null,
          "notes": ""
        }
      ]
    }
  ]
}`;
}

// ── Run Pass 1 on all story chapters (chunked at 10 chapters per call) ────────
const CHAPTERS_PER_CHUNK = 10;

function updatePass1Bar(current, total) {
    const bar   = document.getElementById('pass1-progress');
    const fill  = document.getElementById('pass1-fill');
    const label = document.getElementById('pass1-label');
    if (!bar) return;
    bar.style.display = 'block';
    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
    if (fill)  fill.style.width  = pct + '%';
    if (label) label.textContent = `chunk ${current} of ${total} complete · ${pct}%`;
}

async function runPass1(storyChapters, register, aiModel, keys) {
    const registerText = register.length > 0
        ? register.map(r =>
            `  - ${r.name}` + (r.aliases.length ? ` (also known as: ${r.aliases.join(', ')})` : '')
          ).join('\n')
        : '  (none — identify all characters from the text)';

    // Split into fixed-size chunks of CHAPTERS_PER_CHUNK
    const chunks = [];
    for (let i = 0; i < storyChapters.length; i += CHAPTERS_PER_CHUNK) {
        chunks.push(storyChapters.slice(i, i + CHAPTERS_PER_CHUNK));
    }

    const totalChunks = chunks.length;
    log(`${storyChapters.length} chapter(s) split into ${totalChunks} chunk(s) of up to ${CHAPTERS_PER_CHUNK}.`);

    // Show progress bar at 0%
    setStage('pass1', 'active', `0 of ${totalChunks} chunks complete…`);
    updatePass1Bar(0, totalChunks);

    const allResults  = [];
    let chapterOffset = 0;

    for (let i = 0; i < totalChunks; i++) {
        const chunk = chunks[i];
        const chunkNum = i + 1;

        setStage('pass1', 'active', `Reading chunk ${chunkNum} of ${totalChunks}…`);
        log(`chunk ${chunkNum} of ${totalChunks}: chapters ${chapterOffset + 1}–${chapterOffset + chunk.length}`);

        const chapterBlocks = chunk.map((ch, j) =>
            `=== CHAPTER ${chapterOffset + j + 1}: ${ch.title} ===\n${ch.text}`
        ).join('\n\n');

        const roughTokens = Math.round(chapterBlocks.length / 4);
        log(`  estimated tokens: ~${roughTokens.toLocaleString()}`);

        const sysPrompt   = buildPass1Prompt(registerText);
        const userContent = 'Novel text:\n\n' + chapterBlocks;

        let raw;
        try {
            raw = await callAI(sysPrompt, userContent, aiModel, keys);
        } catch (aiErr) {
            log(`  chunk ${chunkNum} AI error: ${aiErr.message} — skipping`, true);
            chapterOffset += chunk.length;
            updatePass1Bar(chunkNum, totalChunks);
            continue;
        }

        let chapterResults = [];
        try {
            const parsed = JSON.parse(raw);
            chapterResults = parsed.chapters || [];
        } catch (jsonErr) {
            log(`  chunk ${chunkNum} JSON parse error: ${jsonErr.message} — skipping`, true);
            chapterOffset += chunk.length;
            updatePass1Bar(chunkNum, totalChunks);
            continue;
        }

        // Ensure chapter numbers are sequential across chunks
        chapterResults.forEach((ch, j) => {
            ch.chapter_num = chapterOffset + j + 1;
        });

        allResults.push(...chapterResults);
        chapterOffset += chunk.length;
        updatePass1Bar(chunkNum, totalChunks);
        log(`  chunk ${chunkNum} complete — ${chapterResults.length} chapter(s) processed.`);
    }

    return allResults;
}

// ── Save chapter character data to Firestore ──────────────────────────────────
async function saveChapterData(userId, authorId, seriesId, bookId, register, chapterResults) {
    // Save character register on the book document
    const bookRef = doc(db, 'users', userId, 'authors', authorId, 'series', seriesId, 'books', bookId);
    await setDoc(bookRef, { characterRegister: register }, { merge: true });

    // Save each chapter as a subcollection document
    for (const ch of chapterResults) {
        const chapterRef = doc(
            db,
            'users', userId,
            'authors', authorId,
            'series', seriesId,
            'books', bookId,
            'chapters', String(ch.chapter_num)
        );
        await setDoc(chapterRef, {
            num:        ch.chapter_num,
            title:      ch.title,
            characters: ch.characters || [],
            processed:  new Date().toISOString()
        });
    }
}

// ── Main process ──────────────────────────────────────────────────────────────
processButton.onclick = async () => {
    processButton.disabled = true;
    progressPanel.style.display = 'block';
    resultsPanel.style.display  = 'none';
    statusLog.innerHTML = '';

    // Reset all stages to pending
    ['parse','images','charlist','chapters','pass1','vault'].forEach(id => {
        setStage(id, 'pending', 'awaiting…');
    });

    log(`scribe ${VERSION} starting...`);

    const aiModel = document.querySelector('input[name="ai-model"]:checked').value;
    const keys = {
        openai: localStorage.getItem('openai_key'),
        gemini: localStorage.getItem('gemini_key')
    };

    // Tally for results panel
    let statMaps = 0, statRegister = 0, statChapters = 0, statAppearances = 0;
    let finalTitle = '', finalAuthor = '', bookIds = null;

    try {

        // ── STAGE 1: Unseal the tome ───────────────────────────────────────
        setStage('parse', 'active', 'Reading epub…');

        const file = fileInput.files[0];
        if (!file) throw new Error('No epub file selected.');

        const openaiKey = keys.openai;
        if (!openaiKey && aiModel === 'openai') throw new Error('No OpenAI key found. Visit API Settings.');
        if (!keys.gemini && aiModel === 'gemini') throw new Error('No Gemini key found. Visit API Settings.');
        if (!openaiKey) throw new Error('OpenAI key is required for image classification (cover / map detection). Visit API Settings.');

        if (typeof JSZip === 'undefined') throw new Error('JSZip not loaded — please reload the page.');

        log('unzipping epub…');
        const zip = await JSZip.loadAsync(file);
        log('epub unzipped.');

        // Read metadata
        const containerFile = zip.file('META-INF/container.xml');
        if (!containerFile) throw new Error('epub has no META-INF/container.xml');

        const containerXml = await containerFile.async('string');
        const containerDoc = parser.parseFromString(containerXml, 'text/xml');
        const rootFile = containerDoc.querySelector('rootfile');
        if (!rootFile) throw new Error('epub container.xml has no rootfile element.');
        const opfPath = rootFile.getAttribute('full-path');
        log(`opf path: ${opfPath}`);

        const opfFile = zip.file(opfPath);
        if (!opfFile) throw new Error(`opf file not found at ${opfPath}`);
        const opfXml = await opfFile.async('string');
        const opfDoc = parser.parseFromString(opfXml, 'text/xml');

        const title  = opfDoc.querySelector('title')?.textContent?.trim()   || 'unknown title';
        const author = opfDoc.querySelector('creator')?.textContent?.trim() || 'unknown author';
        let series   = 'standalone';
        opfDoc.querySelectorAll('meta').forEach(meta => {
            const nameAttr = meta.getAttribute('name');
            const propAttr = meta.getAttribute('property');
            if (nameAttr === 'calibre:series')
                series = (meta.getAttribute('content') || series).trim();
            else if (propAttr === 'belongs-to-collection')
                series = (meta.textContent || series).trim();
        });

        finalTitle  = title;
        finalAuthor = author;
        log(`title: ${title}`);
        log(`author: ${author}`);
        log(`series: ${series}`);

        const userId   = USERID;
        const authorId = slug(author) || 'unknown-author';
        const seriesId = slug(series) || 'standalone';
        const bookId   = slug(title)  || 'unknown-title';
        bookIds = { userId, authorId, seriesId, bookId };

        const storagePath = `users/${userId}/${authorId}/${seriesId}/${bookId}`;

        let bookData = { title, author, series, maps: [], cover: null, created: Date.now() };
        await savetolibrary({ userid: userId, author: authorId, series: seriesId, bookid: bookId }, bookData);
        log('initial book record saved.');

        setStage('parse', 'done', `${title} by ${author}`);

        // ── STAGE 2: Catalogue images ──────────────────────────────────────
        setStage('images', 'active', 'Scanning for maps and cover…');

        const imageFiles = Object.keys(zip.files).filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f));
        log(`${imageFiles.length} image(s) found.`);

        for (const path of imageFiles) {
            const filename = path.split('/').pop();
            log(`analysing: ${filename}`);
            try {
                const imgBlob    = await zip.file(path).async('blob');
                const base64Data = await getBase64(imgBlob);
                const mimeType   = imgBlob.type || 'image/jpeg';

                const prompt      = CARTOGRAPHER_PROMPTS.describeImagePrompt();
                const description = await (async () => {
                    const res = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
                        body: JSON.stringify({
                            model: 'gpt-4o-mini',
                            messages: [{
                                role: 'user',
                                content: [
                                    { type: 'text', text: prompt },
                                    { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } }
                                ]
                            }],
                            max_tokens: 800
                        })
                    });
                    const d = await res.json();
                    if (d.error) throw new Error(d.error.message);
                    return d.choices[0].message.content || '';
                })();

                const upper    = description.toUpperCase();
                let   category = 'OTHER';
                if (upper.includes('COVER'))        category = 'COVER';
                else if (upper.includes('MAP'))      category = 'MAP';
                else if (upper.includes('ILLUSTR'))  category = 'ILLUSTRATION';
                else if (upper.includes('ICON'))     category = 'ICON';
                log(`  ${filename} → ${category}`);

                if (category === 'COVER' && !bookData.cover) {
                    const coverUrl = await uploadartifact(`${storagePath}/cover.jpg`, imgBlob);
                    if (coverUrl) { bookData.cover = coverUrl; log('  cover stored.'); }

                } else if (category === 'MAP') {
                    log('  checking map orientation…');
                    const orientation = await checkOrientation(base64Data, mimeType, openaiKey);
                    log(`  orientation: ${orientation}`);
                    let uploadBlob = imgBlob;
                    if (orientation !== 'CORRECT') {
                        const degrees = parseInt(orientation.split('_')[1]);
                        uploadBlob = await rotateBlob(imgBlob, degrees);
                        log(`  rotated ${degrees}°.`);
                    }
                    const mapUrl = await uploadartifact(`${storagePath}/maps/${filename}`, uploadBlob);
                    if (mapUrl) {
                        bookData.maps.push({ name: filename, url: mapUrl, source: 'epub', alternates: [], preferred: 'original' });
                        statMaps++;
                        log('  map stored.');
                    }
                }

                await savetolibrary({ userid: userId, author: authorId, series: seriesId, bookid: bookId }, bookData);

            } catch (imgErr) {
                log(`  ERROR on ${filename}: ${imgErr.message}`, true);
            }
        }

        setStage('images', 'done', `${statMaps} map(s) · cover: ${bookData.cover ? 'yes' : 'no'}`);

        // ── STAGE 3: Find character list ────────────────────────────────────
        setStage('charlist', 'active', 'Searching for dramatis personae…');
        log('extracting all epub sections…');

        const allSections = await extractSections(zip, opfPath);
        log(`${allSections.length} section(s) extracted from spine.`);

        // Log classifications
        const classCount = {};
        allSections.forEach(s => { classCount[s.classification] = (classCount[s.classification] || 0) + 1; });
        Object.entries(classCount).forEach(([k, v]) => log(`  ${k}: ${v}`));

        let characterRegister = [];
        const charListSection = allSections.find(s => s.classification === 'character_list');

        if (charListSection) {
            log(`character list found: "${charListSection.title}"`);
            setStage('charlist', 'active', `Parsing "${charListSection.title}"…`);
            try {
                const chars = await parseCharacterList(charListSection.text, aiModel, keys);
                // Assign colours deterministically by index
                const COLOURS = ['#ff7800','#2266cc','#22aa44','#cc2222','#aa44cc','#cc8800','#006688','#884400'];
                characterRegister = chars.map((c, i) => ({
                    name:    c.name,
                    aliases: c.aliases || [],
                    colour:  COLOURS[i % COLOURS.length]
                }));
                statRegister = characterRegister.length;
                log(`${statRegister} characters parsed from register.`);
                setStage('charlist', 'done', `${statRegister} characters found`);
            } catch (e) {
                log(`could not parse character list: ${e.message}`, true);
                setStage('charlist', 'skipped', 'found but could not be parsed');
            }
        } else {
            log('no character list section found.');
            setStage('charlist', 'skipped', 'not found in this book');
        }

        // ── STAGE 4: Gather story chapters ─────────────────────────────────
        setStage('chapters', 'active', 'Identifying story chapters…');

        const storyChapters = allSections.filter(s => s.classification === 'chapter');
        statChapters = storyChapters.length;
        log(`${statChapters} story chapter(s) identified.`);

        if (statChapters === 0) {
            setStage('chapters', 'error', 'No chapters found — check epub structure');
            throw new Error('No story chapters could be identified in this epub.');
        }

        setStage('chapters', 'done', `${statChapters} chapter(s) ready`);

        // ── STAGE 5: The Scribe Reads (Pass 1) ─────────────────────────────
        setStage('pass1', 'active', `Sending to ${aiModel === 'gemini' ? 'Gemini' : 'OpenAI'}…`);
        log('running Pass 1 character extraction…');

        let chapterResults = [];
        try {
            chapterResults = await runPass1(storyChapters, characterRegister, aiModel, keys);
            statAppearances = chapterResults.reduce(
                (sum, ch) => sum + (ch.characters?.filter(c =>
                    ['placed','vague','group_implied'].includes(c.status)
                ).length || 0),
                0
            );
            log(`Pass 1 complete. ${chapterResults.length} chapter(s) processed.`);
            setStage('pass1', 'done', `${chapterResults.length} chapter(s) · ${statAppearances} placeable character positions`);
        } catch (passErr) {
            log(`Pass 1 failed: ${passErr.message}`, true);
            setStage('pass1', 'error', `Failed — ${passErr.message}`);
            // Don't throw — continue to save what we have
        }

        // ── STAGE 6: Inscribe the vault ─────────────────────────────────────
        setStage('vault', 'active', 'Writing to Firestore…');
        log('saving character data…');

        try {
            await saveChapterData(userId, authorId, seriesId, bookId, characterRegister, chapterResults);
            log('character data saved.');
            setStage('vault', 'done', 'All data written to the vault');
        } catch (vaultErr) {
            log(`vault save failed: ${vaultErr.message}`, true);
            setStage('vault', 'error', vaultErr.message);
        }

        // ── Results ─────────────────────────────────────────────────────────
        const bookUrl = `mybook.html?u=${userId}&a=${authorId}&s=${seriesId}&b=${bookId}`;
        resultsPanel.style.display = 'block';
        resultsPanel.innerHTML = `
            <div class="results-panel">
                <div class="results-title">✓ The tome has been added to the vault</div>
                <div class="results-stats">
                    <div class="stat-item">
                        <span class="stat-number">${statMaps}</span>
                        <span class="stat-label">maps</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-number">${statRegister}</span>
                        <span class="stat-label">characters in register</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-number">${statChapters}</span>
                        <span class="stat-label">chapters</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-number">${statAppearances}</span>
                        <span class="stat-label">character positions</span>
                    </div>
                </div>
                <a href="${bookUrl}" class="btn" style="display:inline-block; margin-top:4px;">
                    View in Library →
                </a>
                <p style="font-family:'Spectral',serif; font-size:0.82em; font-style:italic; color:var(--earth-brown); margin-top:14px; margin-bottom:0;">
                    Next: open the book, draw the map overlay in mapgen, then resolve character coordinates.
                </p>
            </div>
        `;

        log('done. ready for map overlay and Pass 2 coordinate resolution.');

    } catch (err) {
        log(`FATAL ERROR: ${err.message}`, true);
        console.error(err);
    } finally {
        processButton.disabled = false;
    }
};
