// prompts.js - The Scribe's Instructions v1.1

export const CARTOGRAPHER_PROMPTS = {
    buildBindingPrompt: (chapters, imageList) => {
        return `
            You are a Master Cartographer and Librarian. 
            Your goal is to match book chapters to the most specific map available.
            
            CHAPTER LIST:
            ${chapters.join(", ")}
            
            AVAILABLE IMAGES:
            ${imageList.map(img => img.name).join(", ")}
            
            LOGIC RULES:
            1. IDENTIFY MAPS: Look for files containing 'map', 'chart', 'plate', or 'area'.
            2. PRIMARY MATCH: If a map filename contains a chapter name or number (e.g., 'map_ch01.jpg' for 'ch01'), it is a MANDATORY match.
            3. SECONDARY MATCH: If no specific map exists for a chapter, use the general world map or 'chart.jpg'.
            4. FORMAT: You must return ONLY valid JSON.
            
            SPOILER RULE: No plot summaries.
            
            REQUIRED JSON FORMAT:
            {
              "ledger": [
                {
                  "chapter": "Chapter ID", 
                  "map_file": "filename.jpg",
                  "reasoning": "Briefly why this map was chosen"
                }
              ]
            }
        `;
    }
};
