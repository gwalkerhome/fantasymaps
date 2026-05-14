// v4.3 | extraction.js — full book intake: maps, character list, chapters, Pass 1
import { savetolibrary, uploadartifact, db } from './firebase.js';
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { CARTOGRAPHER_PROMPTS } from './prompts.js';

const VERSION  = 'v4.3';
const RESUME_KEY = 'scribe_resume';
let resumeData = null;  // populated when user clicks "Resume"
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

// Thematic in-world commentary shown alongside the technical log
function commentLog(msg) {
    const entry = document.createElement('div');
    entry.textContent = `✦ ${msg}`;
    entry.style.color      = 'var(--earth-brown, #6a4f4b)';
    entry.style.fontStyle  = 'italic';
    entry.style.marginTop  = '4px';
    entry.style.marginBottom = '2px';
    statusLog.appendChild(entry);
    statusLog.scrollTop = statusLog.scrollHeight;
}

const PASS1_QUIPS = [
    'eyeballing rogues and scoundrels…',
    'identifying suspicious characters…',
    'sticking pins on the map…',
    'marking the wanderers and the lost…',
    'noting who lurks in the shadows…',
    'cross-referencing the fellowship…',
    'tracking the brave and the fallen…',
    'consulting the oracle on distant characters…',
    'tracing footprints across the realm…',
    'noting allegiances and enmities…',
    'logging the deeds of heroes and villains alike…',
    'squinting at the small print…',
];

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
    resumeData = null; // reset on new file selection
    checkForResume(file);
}

// Wire up resume panel buttons (safe even if elements don't exist)
document.getElementById('resume-btn')?.addEventListener('click', () => {
    const saved = localStorage.getItem(RESUME_KEY);
    if (saved) {
        resumeData = JSON.parse(saved);
        log(`resume loaded — will skip chunks 1–${resumeData.chunksDone}, starting from chunk ${resumeData.chunksDone + 1}.`);
    }
    document.getElementById('resume-panel').style.display = 'none';
});

document.getElementById('resume-discard-btn')?.addEventListener('click', () => {
    clearProgress();
    resumeData = null;
    document.getElementById('resume-panel').style.display = 'none';
    log('saved progress discarded — will run from the beginning.');
});

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

// ── AI call with automatic retry on transient errors ─────────────────────────
async function callAIWithRetry(systemPrompt, userContent, aiModel, keys, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
            return await callAI(systemPrompt, userContent, aiModel, keys);
        } catch (err) {
            if (attempt > maxRetries) throw err;
            const delaySec = attempt * 12; // 12s, 24s, 36s
            log(`  attempt ${attempt} failed: "${err.message.substring(0, 80)}" — retrying in ${delaySec}s…`);
            await new Promise(r => setTimeout(r, delaySec * 1000));
        }
    }
}

// ── Resume progress helpers ───────────────────────────────────────────────────
function saveProgress(filename, fileSize, bookIds, bookData, register, chunksDone, totalChunks, allResults) {
    try {
        localStorage.setItem(RESUME_KEY, JSON.stringify({
            filename, fileSize, bookIds, bookData, register,
            chunksDone, totalChunks, allResults,
            timestamp: Date.now()
        }));
    } catch (e) {
        log('  (could not save progress to localStorage — storage may be full)');
    }
}

function clearProgress() {
    localStorage.removeItem(RESUME_KEY);
}

function checkForResume(file) {
    const resumePanel = document.getElementById('resume-panel');
    if (!resumePanel) return;
    const saved = localStorage.getItem(RESUME_KEY);
    if (!saved) { resumePanel.style.display = 'none'; return; }
    try {
        const data = JSON.parse(saved);
        if (data.filename === file.name && data.fileSize === file.size) {
            const ageMin = Math.round((Date.now() - data.timestamp) / 60000);
            const ageStr = ageMin < 60 ? `${ageMin} minute${ageMin !== 1 ? 's' : ''}` : `${Math.round(ageMin / 60)} hours`;
            document.getElementById('resume-message').innerHTML =
                `<strong>${data.chunksDone} of ${data.totalChunks} chunks already processed</strong> — saved ${ageStr} ago.` +
                `<br><span style="font-size:0.88em;opacity:0.8;">${data.allResults.length} chapter(s) in the vault so far.</span>`;
            resumePanel.style.display = 'block';
        } else {
            resumePanel.style.display = 'none';
        }
    } catch (e) {
        resumePanel.style.display = 'none';
    }
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
function buildPass1Prompt(registerText, bookTitle = '', bookAuthor = '') {
    const bookCtx = bookTitle
        ? `BOOK: "${bookTitle}"${bookAuthor ? ` by ${bookAuthor}` : ''}.
You have knowledge of this book's world from your training data. Use that knowledge to correctly resolve location names, geographic relationships, and character identities. However, process the text objectively — do not add characters or events that are not in the chapters provided.

`
        : '';

    return `You are a character extraction assistant for a fantasy novel reader application.

${bookCtx}Your task: read the novel chapters provided and for EACH chapter, identify every character who is PHYSICALLY PRESENT, reporting their location at the END of that chapter.

CHARACTER REGISTER (canonical names and known aliases):
${registerText}

═══ LOCATION RULES (read carefully — these are the most important instructions) ═══

RULE 1 — USE SETTLEMENT OR REGION LEVEL ONLY.
location_description must name a SETTLEMENT, FORTRESS, CITY, REGION, or NAMED GEOGRAPHIC FEATURE.
NEVER use room names, corridor descriptions, building interiors, or sub-features.
❌ WRONG: "a corridor in Urithiru", "the throne room", "a crevice on the plateau", "a tavern in the city"
✓ RIGHT:  "Urithiru", "the Shattered Plains", "Kholinar", "the Frostlands"

RULE 2 — CLIMB THE GEOGRAPHIC HIERARCHY.
If the exact place is not itself a named location, use its containing settlement, then its containing region.
e.g. "the great hall of Kharbranth" → "Kharbranth"
e.g. "a street near the market in Luthadel" → "Luthadel"
Use your world knowledge to resolve this hierarchy for known fantasy settings.

RULE 3 — SHARED SCENES MEAN SHARED LOCATIONS.
If two or more characters are shown in direct interaction (conversation, combat, shared meal, joint activity) within the same scene, they are at the SAME location.
Assign them identical location_description values. Do not invent separate micro-locations for characters who are clearly together.

RULE 4 — TRAVELLING STATUS.
Use "travelling" (not "vague" or "placed") when a character is clearly in transit between two named places.
Populate journey_from and journey_to. If you know the world, you can infer the route and departure/destination even if the text is not explicit.
If a character was at place A at the end of the previous chapter and is moving toward place B, they are travelling.

RULE 5 — CONSISTENCY WITHIN A CHAPTER.
All characters in the same scene share a scene location. If most characters in a chapter are at "the Shattered Plains", a character in that same scene should not be placed in "Kholinar" unless the text explicitly says they are elsewhere.

═══ OTHER INSTRUCTIONS ═══

- Process EVERY chapter. Return a characters array for each (may be empty).
- Only include characters physically present in the scene. Exclude those mentioned in dialogue, memory, or flashback.
- Report each character's location at the END of the chapter. If they move, report their final position.
- Resolve aliases and epithets to canonical names from the register where possible.

STATUS VALUES:
- "placed"           — a specific named settlement or region can be identified
- "travelling"       — in transit between two named places; populate journey_from and journey_to
- "vague"            — only vague directional clue, no named origin or destination
- "no_location"      — present but no location can be determined
- "off_map"          — at a location not on any available map
- "wrong_map"        — on a different map from the one currently active
- "referenced_only"  — mentioned in speech/memory, not physically present
- "new_character"    — not in the register; flag for review
- "ambiguous"        — location genuinely cannot be reliably determined

GROUP NAMES: Only assign when characters are explicitly operating as a cohesive named unit (company, fellowship, army, war band). Merely sharing a scene does not make a group. Set null for solo characters.

JOURNEY FIELDS: Populate only when status is "travelling". Both journey_from and journey_to must be named places. Set null otherwise.

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
          "group_name": "<operating group name, or null>",
          "location_description": "<settlement, fortress, or region — never a room or interior>",
          "status": "<see above>",
          "journey_from": "<named departure point, or null>",
          "journey_to": "<named destination, or null>",
          "confidence": "<high|medium|low>",
          "map_hint": null,
          "notes": "<brief note on anything unusual or ambiguous — empty string if none>"
        }
      ]
    }
  ]
}`;
}

// ── Run Pass 1 on all story chapters (chunked at 5 chapters per call) ────────
const CHAPTERS_PER_CHUNK = 5;

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

async function runPass1(storyChapters, register, aiModel, keys, bookIds, bookData, filename, fileSize) {
    const registerText = register.length > 0
        ? register.map(r =>
            `  - ${r.name}` + (r.aliases.length ? ` (also known as: ${r.aliases.join(', ')})` : '')
          ).join('\n')
        : '  (none — identify all characters from the text)';
    const bTitle  = bookData?.title  || '';
    const bAuthor = bookData?.author || '';

    // Split into fixed-size chunks of CHAPTERS_PER_CHUNK
    const chunks = [];
    for (let i = 0; i < storyChapters.length; i += CHAPTERS_PER_CHUNK) {
        chunks.push(storyChapters.slice(i, i + CHAPTERS_PER_CHUNK));
    }

    const totalChunks = chunks.length;
    log(`${storyChapters.length} chapter(s) split into ${totalChunks} chunk(s) of up to ${CHAPTERS_PER_CHUNK}.`);

    // ── Resume: load previously saved results if resuming ─────────────────────
    let startChunk    = 0;
    const allResults  = [];

    if (resumeData && resumeData.filename === filename && resumeData.fileSize === fileSize) {
        startChunk = resumeData.chunksDone;
        allResults.push(...resumeData.allResults);
        log(`resuming: skipping chunks 1–${startChunk}, loading ${allResults.length} already-saved chapter(s).`);
        updatePass1Bar(startChunk, totalChunks);
        setStage('pass1', 'active', `Resuming from chunk ${startChunk + 1} of ${totalChunks}…`);
    } else {
        setStage('pass1', 'active', `0 of ${totalChunks} chunks complete…`);
        updatePass1Bar(0, totalChunks);
    }

    let chapterOffset = startChunk * CHAPTERS_PER_CHUNK;

    for (let i = startChunk; i < totalChunks; i++) {
        const chunk    = chunks[i];
        const chunkNum = i + 1;

        setStage('pass1', 'active', `Reading chunk ${chunkNum} of ${totalChunks}…`);
        commentLog(PASS1_QUIPS[(chunkNum - 1) % PASS1_QUIPS.length]);
        log(`chunk ${chunkNum} of ${totalChunks}: chapters ${chapterOffset + 1}–${chapterOffset + chunk.length}`);

        const chapterBlocks = chunk.map((ch, j) =>
            `=== CHAPTER ${chapterOffset + j + 1}: ${ch.title} ===\n${ch.text}`
        ).join('\n\n');

        const roughTokens = Math.round(chapterBlocks.length / 4);
        log(`  estimated tokens: ~${roughTokens.toLocaleString()}`);

        const sysPrompt   = buildPass1Prompt(registerText, bTitle, bAuthor);
        const userContent = 'Novel text:\n\n' + chapterBlocks;

        let raw;
        try {
            raw = await callAIWithRetry(sysPrompt, userContent, aiModel, keys);
        } catch (aiErr) {
            // Save progress before stopping so the user can resume
            saveProgress(filename, fileSize, bookIds, bookData, register, i, totalChunks, allResults);
            setStage('pass1', 'error', `Chunk ${chunkNum} failed after retries — progress saved. Reload and resume.`);
            log(`  chunk ${chunkNum} failed after retries: ${aiErr.message}`, true);
            log(`  progress saved — reload the page, re-select the same file, and click Resume.`, true);
            chapterOffset += chunk.length;
            updatePass1Bar(chunkNum, totalChunks);
            // Return what we have so far — the vault stage will save partial results
            return { results: allResults, complete: false };
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

        // Save this chunk's chapters to Firestore immediately — don't wait for the end
        try {
            const { userId, authorId, seriesId, bookId } = bookIds;
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
            log(`  chunk ${chunkNum} committed to vault.`);
        } catch (saveErr) {
            log(`  WARNING: could not save chunk ${chunkNum} to Firestore: ${saveErr.message}`, true);
        }

        // Save resume progress to localStorage after every successful chunk
        saveProgress(filename, fileSize, bookIds, bookData, register, chunkNum, totalChunks, allResults);
    }

    return { results: allResults, complete: true };
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
    commentLog('The scribe takes up the quill… let us begin.');

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
        commentLog('Cracking the spine of the ancient text…');
        setStage('parse', 'active', 'Reading epub…');

        const file = fileInput.files[0];
        if (!file) throw new Error('No epub file selected.');

        const openaiKey = keys.openai;
        if (!openaiKey && aiModel === 'openai') throw new Error('No OpenAI key found. Visit API Settings.');
        if (!keys.gemini && aiModel === 'gemini') throw new Error('No Gemini key found. Visit API Settings.');

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

        let bookData = { title, author, series, created: Date.now() };
        // Do NOT include maps or cover here — merge would overwrite existing values with empty ones.
        // Maps and cover are managed separately via mybook / mapgen and must be preserved.
        await savetolibrary({ userid: userId, author: authorId, series: seriesId, bookid: bookId }, bookData);
        bookData.maps  = [];   // local only — used by image stage if re-enabled
        bookData.cover = null; // local only
        log('initial book record saved.');

        setStage('parse', 'done', `${title} by ${author}`);

        // ── STAGE 2: Catalogue images (skipped — maps added manually via mybook) ──
        log('image stage skipped — maps are managed manually via My Book.');
        setStage('images', 'skipped', 'maps managed manually');

        // ── STAGE 3: Find character list ────────────────────────────────────
        commentLog('Consulting the dramatis personae… cataloguing the cast of characters…');
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
        commentLog('Turning the pages… separating the chapters from the fore-matter…');
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
        commentLog('The scribe leans forward, quill at the ready… reading the tale from the beginning…');
        setStage('pass1', 'active', `Sending to ${aiModel === 'gemini' ? 'Gemini' : 'OpenAI'}…`);
        log('running Pass 1 character extraction…');

        let chapterResults = [];
        let pass1Complete  = false;
        try {
            const pass1 = await runPass1(
                storyChapters, characterRegister, aiModel, keys,
                bookIds, bookData, file.name, file.size
            );
            chapterResults = pass1.results;
            pass1Complete  = pass1.complete;
            statAppearances = chapterResults.reduce(
                (sum, ch) => sum + (ch.characters?.filter(c =>
                    ['placed','travelling','vague'].includes(c.status)
                ).length || 0),
                0
            );
            if (pass1Complete) {
                log(`Pass 1 complete. ${chapterResults.length} chapter(s) processed.`);
                commentLog('The scribe sets down the quill. All deeds have been noted.');
                setStage('pass1', 'done', `${chapterResults.length} chapter(s) · ${statAppearances} placeable character positions`);
            } else {
                log(`Pass 1 stopped early. ${chapterResults.length} chapter(s) saved so far — resume to continue.`);
                commentLog('The scribe pauses… progress has been saved. Reload and resume when ready.');
                setStage('pass1', 'error', `Stopped at chunk — ${chapterResults.length} chapter(s) saved. Reload and resume.`);
            }
        } catch (passErr) {
            log(`Pass 1 failed: ${passErr.message}`, true);
            setStage('pass1', 'error', `Failed — ${passErr.message}`);
            // Don't throw — continue to save what we have
        }

        // ── STAGE 6: Inscribe the vault ─────────────────────────────────────
        commentLog('Committing all deeds and whereabouts to the great vault…');
        setStage('vault', 'active', 'Writing to Firestore…');
        log('saving character data…');

        try {
            await saveChapterData(userId, authorId, seriesId, bookId, characterRegister, chapterResults);
            log('character data saved.');
            if (pass1Complete) {
                clearProgress();  // full run complete — discard resume data
                resumeData = null;
            } else {
                log('partial run — resume data kept so you can continue.');
            }
            setStage('vault', 'done', pass1Complete ? 'All data written to the vault' : `${chapterResults.length} chapter(s) written — resume to complete`);
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
