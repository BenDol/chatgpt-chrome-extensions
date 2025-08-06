// background.js (service_worker)
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.cmd === "openOptions") {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      // Fallback for very old Chromium builds
      chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
    }
  }
});
