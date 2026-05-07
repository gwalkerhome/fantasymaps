// v1.9 | prompts.js

export const CARTOGRAPHER_PROMPTS = {
    buildImageDescriptionPrompt: (filename) => {
        return `
            Analyze this image from a book (Filename: ${filename}).
            
            TASK:
            1. Describe the visual content in detail. 
            2. If it is a map, describe the landmarks, terrain, and labels visible.
            3. Categorize the image into one of these types: [MAP, COVER, ILLUSTRATION, ICON, TEXT_BOX].
            
            OUTPUT FORMAT (JSON ONLY):
            {
              "category": "TYPE",
              "description": "Detailed visual summary",
              "labels_found": ["List", "of", "visible", "text", "on", "image"]
            }
        `.trim();
    }
};
