// v1.3 | prompts.js
export const CARTOGRAPHER_PROMPTS = {
  // Goal A: Pure visual description of a provided image
  describeImagePrompt: () => {
    return `
      Analyze the provided image file. 
      Provide a literal, objective description of what is depicted. 
      If it is a map, describe the geographical features, labels, and icons present. 
      Do not use outside knowledge of any specific book series; describe only what is visually confirmed in the image.
    `;
  }
};
