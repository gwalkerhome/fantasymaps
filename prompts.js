// v1.1 prompts.js - The Scribe's Instructions
export const CARTOGRAPHER_PROMPTS = {
    buildBindingPrompt: (chapters, imageList) => {
        return `
            You are a Master Cartographer for a High Fantasy library. 
            I have a book called "The Way of Kings".
            
            CHAPTERS FOUND:
            ${chapters.join(", ")}
            
            IMAGES EXTRACTED:
            ${imageList.map(img => img.name).join(", ")}
            
            TASK:
            1. Analyze the chapter titles and the image filenames.
            2. Identify which images are MAPS. 
            3. CRITICAL: Do NOT bind chapters to images that are obviously not maps (e.g., 'cover.jpg', 'logo.jpg', 'portrait.jpg', 'icon.png').
            4. Bind each chapter to the most relevant map.
            5. If no specific map is relevant, bind it to the most general map provided (like 'chart.jpg').
            
            SPOILER RULE: Do not include plot summaries. Only output a JSON mapping.
            
            FORMAT:
            {
              "ledger": [
                {"chapter": "Chapter ID", "map_file": "filename.jpg"}
              ]
            }
        `;
    }
};
