# Gary — Working Protocols & Personal Context

## About Gary
- Full name: Gary Walker
- DOB: 28 September 1969 (late 50s)
- Early retired headteacher, 40 years in education
- Based in Dénia, Spain — prefers working in English
- Suffered a haemorrhagic stroke in 2022 affecting the left basal ganglia
  — impacts short-term memory, organisation, and processing
- High-performing ADHD — can get distracted and lose the main task
- Started coding on a ZX Spectrum as a child

## Family
- **Ollie** (son) — born 28 May 2012; autistic (high functioning); mainstream Spanish school in Dénia; likes Roblox; uses Mac with mouse and keyboard; classes in Spanish and Valenciano
- **Billy** (son) — born 22 January 2018; ADHD, medicated, highly intelligent; mainstream Spanish school in Dénia; likes VR Meta Quest 3, Xbox, and cooking; stronger in Valenciano than Spanish

## Technical Setup
- Primary machine: 2026 Mac Neo
- Primary devices for apps/sites: iPad and iPhone
- API keys: OpenAI and Gemini
- Firebase (Blaze account), GitHub (desktop app — beginner, learned 3 days ago)
- Firebase: has accounts but needs hand-holding through setup
- Previous projects: Bingo app, Menu Translator
- Happy to learn via tutorials and browser-based tools

## How Gary Works Best
- **One step at a time** — no multi-step instructions without checkpoints
- **Plain English** — no jargon without explanation
- **Re-anchor** when tangents appear — Gary may get distracted, gently redirect
- **Number points and questions** — so Gary can reference them individually in replies
- **Screenshots** to show progress where possible
- If Gary suggests something and a better alternative exists — say so directly
- Leadership style: surround with people who know more, listen, then reach consensus
  — "Tell me what I need to know, not what I'd like to hear"
  — Challenging bad ideas is essential and always welcome

## Coding Preferences
- Claude has direct file access and edits files in place — full page rewrites are no longer needed
- Do not comment or make suggestions between uploads when Gary is uploading multiple files
- Never code or make adjustments without express instruction
- All filenames, page names and variables are **lowercase**
  — Mac autocorrect will capitalise; ignore capitalised versions
- Page titles begin with a **version number** (e.g. v1.5) so GitHub version is obvious
- Begin each feedback message with **"OK"** so Gary can see when protocol reminder needs reposting

## Project: fantasymaps
- Fantasy map reader web app
- Stack: vanilla HTML/CSS/JS, Firebase Firestore, Firebase Storage
- AI: OpenAI (gpt-4o-mini) and Gemini (gemini-2.5-flash) via direct API calls from browser
- Key pages: index, scribe, mybook, mapgen, postest, settings, apisettings
- Character positioning uses a two-pass AI approach:
  - Pass 1: extract characters + locations from chapter text (no map data needed)
  - Pass 2: resolve location descriptions to map coordinates (needs overlay)
- Character data stored in Firestore per book/chapter for instant read-time lookup
