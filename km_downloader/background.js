let cachedFrames = [];
let cachedTitle = "";
let frameManagerTabId = null; // Track if frame manager is already open

// Helper function to send frame data in batches
async function sendFrameDataInBatches(tabId, frameData, videoTitle) {
  console.log("Send frame data in batches");
  const BATCH_SIZE = 10; // Send 10 frames at a time
  const totalFrames = frameData.length;
  
  for (let i = 0; i < totalFrames; i += BATCH_SIZE) {
    const batch = frameData.slice(i, i + BATCH_SIZE);
    const isFirst = i === 0;
    const isFinal = i + BATCH_SIZE >= totalFrames;
    
    try {
      console.log("Sending batch:", batch);

      await chrome.tabs.sendMessage(tabId, {
        action: "loadFrameBatch",
        frameData: batch,
        videoTitle: isFirst ? videoTitle : undefined,
        isFirst: isFirst,
        isFinal: isFinal
      });
      console.log(`Batch ${i / BATCH_SIZE + 1} sent successfully.`);
      
      // Small delay between batches to prevent overwhelming the UI
      if (!isFinal) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`Failed to send batch ${i / BATCH_SIZE + 1}:`, error);
      break;
    }
  }
}

// Helper function to create frame manager tab
function createFrameManagerTab(frameData, videoTitle) {
  chrome.tabs.create({
    url: chrome.runtime.getURL("frame_manager.html")
  }, (tab) => {
    frameManagerTabId = tab.id;
    // Wait for tab to load, then send the frame data in batches
    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
      if (tabId === tab.id && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        sendFrameDataInBatches(tabId, frameData, videoTitle);
      }
    });
  });
}

// Clean up frame manager tab ID when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === frameManagerTabId) {
    frameManagerTabId = null;
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "downloadPDF") {
    chrome.downloads.download({
      url: message.url,
      filename: message.filename,
      saveAs: true
    });
  }
  if (message.action === "downloadVideo") {
    chrome.downloads.download({
      url: message.url,
      filename: message.filename,
      saveAs: true
    });
  }
  
  if (message.action === "storeFrameData") {
    // Check if frame manager is already open
    if (frameManagerTabId) {
      try {
        // Try to use existing tab
        chrome.tabs.get(frameManagerTabId, (tab) => {
          if (chrome.runtime.lastError || !tab) {
            // Tab doesn't exist, create new one
            frameManagerTabId = null;
            createFrameManagerTab(message.frameData, message.videoTitle);
          } else {
            // Use existing tab
            sendFrameDataInBatches(frameManagerTabId, message.frameData, message.videoTitle);
          }
        });
      } catch (error) {
        // Create new tab if there's an error
        createFrameManagerTab(message.frameData, message.videoTitle);
      }
    } else {
      createFrameManagerTab(message.frameData, message.videoTitle);
    }
    sendResponse({ success: true });
  }
  
  if (message.action === "storeFrameDataChunk") {
    if (message.videoTitle) cachedTitle = message.videoTitle;
    cachedFrames.push(...message.chunk);

    if (message.isFinal) {
      // Check if frame manager is already open
      if (frameManagerTabId) {
        try {
          chrome.tabs.get(frameManagerTabId, (tab) => {
            if (chrome.runtime.lastError || !tab) {
              // Tab doesn't exist, create new one
              frameManagerTabId = null;
              createFrameManagerTab(cachedFrames, cachedTitle);
              cachedFrames = [];
              cachedTitle = "";
            } else {
              // Use existing tab
              sendFrameDataInBatches(frameManagerTabId, cachedFrames, cachedTitle);
              cachedFrames = [];
              cachedTitle = "";
            }
          });
        } catch (error) {
          createFrameManagerTab(cachedFrames, cachedTitle);
          cachedFrames = [];
          cachedTitle = "";
        }
      } else {
        createFrameManagerTab(cachedFrames, cachedTitle);
        cachedFrames = [];
        cachedTitle = "";
      }
      sendResponse({ success: true });
    } else {
      sendResponse({ success: true });
    }
  }

  if (message.action === "openFrameManager") {
    // Check if frame manager tab is already open
    if (frameManagerTabId) {
      chrome.tabs.update(frameManagerTabId, { active: true });
    } else {
      chrome.tabs.create({
        url: chrome.runtime.getURL("frame_manager.html")
      }, (tab) => {
        frameManagerTabId = tab.id; // Save the tab ID
      });
    }
  }
});