/* background.js — minimal service worker: set sane defaults on install. */
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["enabled"], (d) => {
    if (d.enabled === undefined) chrome.storage.local.set({ enabled: true });
  });
});
