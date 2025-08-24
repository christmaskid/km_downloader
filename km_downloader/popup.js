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

  async function createPdfWrapper(imageBlobs, title) {
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

  async function downloadSlides(mediaDiv, title) {
    const imgs = mediaDiv?.querySelectorAll("img");
    if (!imgs || imgs.length === 0) {
      alert("Required elements not found on this page.");
      return;
    }
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
    createPdfWrapper(imageBlobs, title);
  }

  async function downloadVideo(videoSrc, title) {
    console.log("Video source:", videoSrc);
    try {
      // Instead of fetching, just send the URL to background for download
      chrome.runtime.sendMessage({
        action: "downloadVideo",
        url: videoSrc,
        filename: title + ".mp4"
      });
    } catch (err) {
      console.error("Failed to send download message:", err);
      alert("Failed to download video. Check console for details.");
      return;
    }
    await new Promise(resolve => {
      const checkVideoReady = setInterval(() => {
        if (video.readyState === 4) { // HAVE_ENOUGH_DATA
          clearInterval(checkVideoReady);
          resolve();
        }
      }, 100);
    });
  }

  async function downloadSlidesFromVideo(videoDiv, title) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const video = videoDiv.querySelector("video");

    if (!video) {
      alert("Video element not found.");
      return;
    }
    const videoSrc = video.src;
    if (!videoSrc) {
      alert("Video source not found.");
      return;
    }
    // Download the video file from video.src
    // downloadVideo(videoSrc, title);
    console.log("Initial readyState:", video.readyState);

    // Force the video to start loading
    video.load();

    // Wait for video metadata to load
    if (video.readyState < 1) { // HAVE_METADATA
      console.log("Waiting for metadata to load...");
      
      const metadataPromise = new Promise(resolve => {
        video.addEventListener('loadedmetadata', resolve, { once: true });
      });
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Video metadata loading timeout")), 10000); // 10 second timeout
      });
      
      try {
        await Promise.race([metadataPromise, timeoutPromise]);
      } catch (err) {
        console.error("Failed to load video metadata:", err);
        alert("Video failed to load. This might be due to CORS restrictions or network issues.");
        return;
      }
    }
    console.log("Video metadata loaded:", video.videoWidth, video.videoHeight, video.duration);

    // Check video dimensions
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      alert("Video is not loaded or has no dimensions.");
      return;
    }

    const imageBlobs = [];
    const frameRate = 10; // Extract 10 frames per second
    const duration = video.duration;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    for (let time = 0; time < duration; time += frameRate) {
      video.currentTime = time;
      await new Promise(resolve => {
      video.onseeked = () => {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
        if (blob) {
          imageBlobs.push(blob);
        }
        resolve();
        }, "image/jpeg");
      };
      });
    }
      
    if (imageBlobs.length === 0) {
      alert("Fail to extract frames.");
      return;
    }
    createPdfWrapper(imageBlobs, title);
  }

  var titleDiv = document.querySelector("div.title.pull-left");
  if (!titleDiv) {
    titleDiv = document.querySelector("#titlePanel .title.text-overflow");
  }
  const title = titleDiv?.innerText.trim() || "Untitled";
  const mediaDiv = document.querySelector("div.module.app-media.app-media-xbox_doc");
  const videoDiv = document.querySelector('#fsPlayer .fs-videoWrap');
  console.log(title);
  // console.log(videoDiv);
  
  
  // Download slides directly
  if (mediaDiv) {
    downloadSlides(mediaDiv, title);
  } else if (videoDiv) {
    downloadSlidesFromVideo(videoDiv, title);
  } else {
    // Download slides from video
    alert("Media container not found.");
    return;
  }

}
