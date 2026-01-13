// content/content.ts
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
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.kind !== "TRACE_PILOT_WRITE_CLIPBOARD") return;
  (async () => {
    try {
      await navigator.clipboard.writeText(msg.text);
      sendResponse({ ok: true });
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  })();
  return true;
});
