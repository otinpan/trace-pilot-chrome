"use strict";
(() => {
  // src/content.ts
  chrome.runtime.sendMessage(
    { type: "PING" },
    (response) => {
      console.log("response from background:", response);
    }
  );
  chrome.runtime.onMessage.addListener(
    (request, sender, sendResponse) => {
      if (typeof request !== "object" || request === null || !("type" in request) || request.type !== "trace-pilot") {
        return;
      }
      (async () => {
        try {
          const st = await navigator.clipboard.readText();
          sendResponse({ selectionText: st });
        } catch (e) {
          sendResponse({ error: String(e) });
        }
      })();
      return true;
    }
  );
})();
