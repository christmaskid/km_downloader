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
});