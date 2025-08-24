let frameManagerCache = {};

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
    frameManagerCache = {
      frameData: message.frameData,
      videoTitle: message.videoTitle
    };
    chrome.tabs.create({
      url: chrome.runtime.getURL("frame_manager.html")
    });
  }

  if (message.action === "getFrameData") {
    sendResponse(frameManagerCache);
  }
  
  if (message.action === "openFrameManager") {
    chrome.tabs.create({
      url: chrome.runtime.getURL("frame_manager.html")
    });
  }
});