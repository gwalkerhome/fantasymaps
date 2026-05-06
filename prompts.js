// prompts.js - The Scribe's Instructions v1.3

export const CARTOGRAPHER_PROMPTS = {
    // This function creates the prompt that asks Gemini to match images to chapters
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
            2. Identify which images are MAPS (not character sketches or icons).
            3. Bind each chapter to the most relevant map.
            4. If no specific map is relevant, bind it to the "World Map".
            
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
