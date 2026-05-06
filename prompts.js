// prompts.js - The Scribe's Instructions v1.5

export const CARTOGRAPHER_PROMPTS = {
    buildBindingPrompt: (chapters, imageList) => {
        // Format the chapters with their text snippets for the AI
        const context = chapters.map(c => `[FILE: ${c.name}]\nCONTENT: ${c.text}...`).join("\n\n---\n\n");
        const images = imageList.map(img => img.name).join(", ");
        
        return `
            You are a Master Cartographer for a High Fantasy library.
            
            CHAPTER CONTENT SNIPPETS:
            ${context}
            
            AVAILABLE MAP IMAGES:
            ${images}
            
            TASK:
            1. Analyze the content of each chapter for geographical names, locations, or descriptions.
            2. Match each chapter to the map image that best fits that location.
            3. If a specific match is found (e.g., 'map_coast.jpg' for a coastal chapter), use it.
            4. If no specific map is relevant based on the text, use 'chart.jpg' or a general map.
            
            SPOILER RULE: Do not include plot summaries. 
            
            OUTPUT FORMAT (JSON ONLY):
            {
              "ledger": [
                {"chapter": "filename.xhtml", "map_file": "image.jpg"}
              ]
            }
        `;
    }
};
