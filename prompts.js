// prompts.js - The Scribe's Instructions v1.4

export const CARTOGRAPHER_PROMPTS = {
    buildBindingPrompt: (chapters, imageList) => {
        const chapterContext = chapters.map(c => `ID: ${c.id}\nCONTENT: ${c.snippet}...`).join("\n\n---\n\n");
        
        return `
            You are a Master Cartographer. 
            I need to bind book chapters to the correct map images based on their content.
            
            CHAPTER DATA:
            ${chapterContext}
            
            AVAILABLE MAP IMAGES:
            ${imageList.map(img => img.name).join(", ")}
            
            TASK:
            1. Read the chapter snippets to understand the geography or location mentioned.
            2. Match each chapter ID to the map filename that best represents that location.
            3. If no specific map is mentioned in the content, use the general world map or 'chart.jpg'.
            
            FORMAT:
            {
              "ledger": [
                {"chapter": "Chapter ID", "map_file": "filename.jpg"}
              ]
            }
        `;
    }
};
