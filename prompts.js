// v1.2 prompts.js
export const CARTOGRAPHER_PROMPTS = {
  buildBindingPrompt: (spineIds, imageFiles) => {
    // Convert spine list to a cleaner comma-separated string
    const chapterList = spineIds.join(', ');
    // Convert image list to a cleaner comma-separated string
    const imageList = imageFiles.map(img => img.name).join(', ');

    return `
You are a Master Cartographer for a High Fantasy library.
A book has been analyzed, revealing the following structure:

CHAPTERS FOUND:
${chapterList}

IMAGES EXTRACTED:
${imageList}

YOUR TASK:
1.  Analyze the CHAPTERS FOUND and the IMAGES EXTRACTED.
2.  Bind each chapter (by ID) to the most relevant map file.
3.  If a chapter's context is unknown, use the most logical map from the list (often the first one or a "world map").
4.  Do NOT invent filenames. You must ONLY choose from the provided IMAGES EXTRACTED list.

IMPORTANT KEYS:
- Look for common abbreviations like 'ch' for chapter or 'pt' for part.
- Assume 'sp.jpg' refers to the 'Shattered Plains' if relevant to the book's context.

SPOILER RULE:
Do not include plot summaries or details. Only output the mapping.

You must output ONLY a valid JSON object in this format:
{
  "ledger": [
    { "chapter": "tp01", "map_file": "chart.jpg" },
    { "chapter": "ch45", "map_file": "sp.jpg" }
  ]
}
`;
  }
};
