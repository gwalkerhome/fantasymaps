// v1.3 | extraction.js
// ... [previous imports and utility functions remain the same] ...

async function getEpubMetadata(zip) {
    log("Reading tome metadata...");
    try {
        const containerXml = await zip.file("META-INF/container.xml").async("string");
        const parser = new DOMParser();
        const containerDoc = parser.parseFromString(containerXml, "text/xml");
        const opfPath = containerDoc.querySelector("rootfile").getAttribute("full-path");

        const opfXml = await zip.file(opfPath).async("string");
        const opfDoc = parser.parseFromString(opfXml, "text/xml");

        // Core Metadata
        const title = opfDoc.querySelector("title")?.textContent || "Unknown Title";
        const author = opfDoc.querySelector("creator")?.textContent || "Unknown Author";
        const description = opfDoc.querySelector("description")?.textContent || "No description available.";
        const publisher = opfDoc.querySelector("publisher")?.textContent || "Unknown Publisher";
        const date = opfDoc.querySelector("date")?.textContent || "Unknown Date";

        // Series Logic
        let series = "Standalone";
        const metaTags = opfDoc.querySelectorAll("meta");
        metaTags.forEach(meta => {
            if (meta.getAttribute("name") === "calibre:series" || meta.getAttribute("property") === "belongs-to-collection") {
                series = meta.getAttribute("content") || meta.textContent;
            }
        });

        return { title, author, series, description, publisher, date };
    } catch (e) {
        log("Metadata extraction failed. Using defaults.");
        return { title: "Unknown", author: "Unknown", series: "Unknown", description: "", publisher: "", date: "" };
    }
}

processButton.onclick = async () => {
    // ... [setup logic] ...
    
    const meta = await getEpubMetadata(zip);
    
    let bookData = {
        title: meta.title,
        author: meta.author,
        series: meta.series,
        description: meta.description, // The blurb for your Info Page
        details: {
            publisher: meta.publisher,
            published: meta.date
        },
        maps: [],
        cover: null,
        created: Date.now()
    };

    // ... [rest of the extraction and Firebase upload logic] ...
};
