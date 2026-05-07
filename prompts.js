// v1.11 | prompts.js

export const CARTOGRAPHER_PROMPTS = {
    // Stage 1: Initial Discovery
    describeImagePrompt: () => {
        return `
            You are a Master Cartographer. 
            Analyze this image extracted from a fantasy book.
            
            TASK:
            1. Describe the visual content in detail.
            2. Categorize the image: Is it a [MAP, COVER, ILLUSTRATION, or ICON]?
            3. Identify any text or labels visible in the image.
            
            OUTPUT:
            Provide a clear, concise description and the category.
        `.trim();
    },

    // Stage 2: Precision Spatial Extraction
    spatialMappingPrompt: () => {
        return `
            ACT AS A MASTER CARTOGRAPHER.
            You are analyzing a map image to build a coordinate ledger.
            
            COORDINATE SYSTEM:
            - The image is a 100x100 grid.
            - (0,0) is the TOP-LEFT corner.
            - (100,100) is the BOTTOM-RIGHT corner.
            
            TASK:
            1. Identify every named town, city, or keep as a POINT {x, y}.
            2. Identify every major region (Forest, Mountain Range, Kingdom) as a POLYGON. 
               - Provide a list of 4 to 8 coordinates that outline the area.
            3. Identify major Roads or Rivers as a PATH.
               - Provide a series of connected coordinates.
            
            OUTPUT FORMAT (STRICT JSON ONLY):
            {
              "map_name": "Name of the land",
              "points": [
                {"name": "Location Name", "x": 0, "y": 0, "type": "city/keep/ruin"}
              ],
              "polygons": [
                {"name": "Region Name", "coords": [[x,y], [x,y], [x,y], [x,y]], "type": "forest/mountains/sea"}
              ],
              "paths": [
                {"name": "Feature Name", "coords": [[x,y], [x,y], [x,y]], "type": "road/river"}
              ]
            }
        `.trim();
    }
};
