document.getElementById("start").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Step 1: Inject pdf-lib.min.js into the page
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["libs/pdf-lib.min.js"]
  });

  // Step 2: Inject and run extractAndDownload
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: extractAndDownload
  });
});

async function extractAndDownload() {
  const titleDiv = document.querySelector("div.title.pull-left");
  const mediaDiv = document.querySelector("div.module.app-media.app-media-xbox_doc");
  const imgs = mediaDiv?.querySelectorAll("img");

  if (!titleDiv || !imgs || imgs.length === 0) {
    alert("Required elements not found on this page.");
    return;
  }

  const title = titleDiv.innerText.trim();
  const links = Array.from(imgs).map(img => img.src);
  // const imageBlobs = await Promise.all(links.map(fetchBlob));
  const imageBlobs = [];

  async function fetchBlob(url) {
    const res = await fetch(url);
    return await res.blob();
  }

  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    // console.log(`Fetching image ${i + 1}/${links.length}: ${link}`);
    try {
      const blob = await fetchBlob(link);
      imageBlobs.push(blob);
    } catch (err) {
      console.error(`Failed to fetch image ${i + 1}: ${link}`, err);
    }
  }
  // console.log(imageBlobs);
  // console.log("Image blobs collected:", imageBlobs.length);
  // imageBlobs.forEach((b, i) => {
  //   console.log(`Blob ${i}:`, b && b.size, b && b.type);
  // });

  async function createPdf(imageBlobs) {
    const pdfDoc = await PDFLib.PDFDocument.create();
    let successCount = 0;

    for (let i = 0; i < imageBlobs.length; i++) {
      const blob = imageBlobs[i];
      if (!blob || blob.size === 0) {
        console.warn(`Image ${i + 1} is empty or invalid, skipping...`);
        continue;
      }

      try {
        const bytes = await blob.arrayBuffer();
        const img = await pdfDoc.embedJpg(bytes); // or embedPng if using PNGs
        const page = pdfDoc.addPage([img.width, img.height]);
        page.drawImage(img, {
          x: 0,
          y: 0,
          width: img.width,
          height: img.height,
        });
        successCount++;
      } catch (err) {
        console.error(`Error embedding image ${i + 1}:`, err);
      }
    }

    if (successCount === 0) {
      throw new Error("No valid images to include in the PDF.");
    }

    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes], { type: "application/pdf" });
  }


  try {
    const pdf = await createPdf(imageBlobs);
    const blobUrl = URL.createObjectURL(pdf);

    chrome.runtime.sendMessage({
      action: "downloadPDF",
      url: blobUrl,
      filename: title + ".pdf"
    });
  } catch (err) {
    console.error("PDF creation failed:", err);
    alert("PDF creation failed. Check console for details.");
  }
}
