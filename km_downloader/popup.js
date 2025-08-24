document.getElementById("start").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const selectBestQuality = document.getElementById("selectBestQuality").checked;
  const frameRate = parseFloat(document.getElementById("frameRate").value) || 1;
  const differenceThreshold = parseFloat(document.getElementById("differenceThreshold").value) / 100 || 0.2;

  // Step 1: Inject pdf-lib.min.js into the page
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["libs/pdf-lib.min.js"]
  });

  // Step 2: Inject and run extractAndDownload
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: extractAndDownload,
    args: [selectBestQuality, frameRate, differenceThreshold]
  });
});

async function extractAndDownload(selectBestQuality, frameRate, differenceThreshold) {

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
    console.log("Video div:", videoDiv);

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
    const duration = video.duration;
    const saveSizeConst = 1;

    canvas.width = video.videoWidth * saveSizeConst;
    canvas.height = video.videoHeight * saveSizeConst;
    const colorDiffThreshold = 30; // hyperparameter

    // Function to calculate frame difference
    function calculateFrameDifference(imageData1, imageData2) {
      if (!imageData1 || !imageData2) return 1; // Consider as 100% different if one is missing
      
      const data1 = imageData1.data;
      const data2 = imageData2.data;
      let diffPixels = 0;
      const totalPixels = data1.length / 4; // Each pixel has 4 values (RGBA)
      
      // Compare every pixel (skip alpha channel for performance)
      for (let i = 0; i < data1.length; i += 4) {
        const r1 = data1[i], g1 = data1[i + 1], b1 = data1[i + 2];
        const r2 = data2[i], g2 = data2[i + 1], b2 = data2[i + 2];
        
        // Calculate color difference using Euclidean distance
        const colorDiff = Math.sqrt((r1-r2)*(r1-r2) + (g1-g2)*(g1-g2) + (b1-b2)*(b1-b2));

        // If color difference is significant (> colorDiffThreshold in RGB space), count as different
        if (colorDiff > colorDiffThreshold) { diffPixels++;}
      }
      
      return diffPixels / totalPixels;
    }

    let previousFrameData = null;

    for (let time = 0; time < duration; time += frameRate) {
      video.currentTime = time;
      
      await new Promise(resolve => {
        video.onseeked = () => {
          try {
            // Draw current frame
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Get current frame data
            const currentFrameData = context.getImageData(0, 0, canvas.width, canvas.height);
            context.getImage
            
            // Calculate difference with previous frame
            const difference = calculateFrameDifference(previousFrameData, currentFrameData);
            
            // Only save frame if it's different enough or it's the first frame
            if (previousFrameData === null || difference > differenceThreshold) {
              canvas.toBlob(blob => {
                if (blob) {
                  imageBlobs.push(blob);
                  console.log(`Frame at ${time}s: ${(difference * 100).toFixed(1)}% different`);
                  console.log(`Saved frame at ${time}s (${imageBlobs.length} frames total)`);
                }
                resolve();
              }, "image/jpeg", 1.0);
              
              // Update previous frame data
              previousFrameData = currentFrameData;
            } else {
              // console.log(`Skipped frame at ${time}s (too similar)`);
              resolve();
            }
          } catch (err) {
            console.error("Failed to process frame:", err);
            resolve();
          }
        };
      });
    }
      
      
    if (imageBlobs.length === 0) {
      alert("Fail to extract any frame.");
      return;
    }
    
    // Instead of creating PDF directly, open frame manager
    await openFrameManager(imageBlobs, title);
  }

  async function openFrameManager(imageBlobs, title) {
    // Convert blobs to data URLs for messaging
    const frameData = [];
    for (let i = 0; i < imageBlobs.length; i++) {
      const blob = imageBlobs[i];
      
      // Convert blob to data URL so it can be accessed from extension pages
      const dataURL = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
      
      frameData.push({
        url: dataURL, // Use data URL instead of blob URL
        time: (i * frameRate).toFixed(1)
      });
    }
    
    // Send frame data to background script for storage
    chrome.runtime.sendMessage({
      action: "storeFrameData",
      frameData: frameData,
      videoTitle: title
    });
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
    if (selectBestQuality) {
      const resolutionSelect = document.querySelector('div.cog-resolution select');
      if (resolutionSelect) {
        // Find the highest resolution option
        const options = Array.from(resolutionSelect.options);
        let bestOption = null;
        let maxResolution = 0;
        
        options.forEach(option => {
          const resolution = option.getAttribute('resolution');
          if (resolution) {
            // Extract width from resolution like "1920 x 1080"
            const width = parseInt(resolution.split(' x ')[0]);
            if (width > maxResolution) {
              maxResolution = width;
              bestOption = option;
            }
          }
        });
        
        if (bestOption && maxResolution >= 1280) {
          console.log(`Selecting highest resolution: ${bestOption.getAttribute('resolution')}`);
          resolutionSelect.value = bestOption.value;
          
          // Trigger change event to apply the resolution
          resolutionSelect.dispatchEvent(new Event('change', { bubbles: true }));
          
          // Wait for the video to reload with new resolution
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    const videoDiv_new = document.querySelector('#fsPlayer .fs-videoWrap');
    downloadSlidesFromVideo(videoDiv_new, title);
  } else {
    // Download slides from video
    alert("Media container not found.");
    return;
  }

}
