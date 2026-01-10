"use strict";
chrome.runtime.sendMessage({ type: "PING" }, (response) => {
    console.log("response from background:", response);
});
function getSelectedText() {
    const active = document.activeElement;
    // input / textarea の選択範囲
    if (active && (active.tagName === "TEXTAREA" || (active.tagName === "INPUT" && active.type === "text"))) {
        const start = active.selectionStart ?? 0;
        const end = active.selectionEnd ?? 0;
        return active.value.substring(start, end);
    }
    // 通常ページの選択
    return window.getSelection()?.toString() ?? "";
}
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (typeof request !== "object" ||
        request === null ||
        !("type" in request) ||
        request.type !== "trace-pilot") {
        return;
    }
    (async () => {
        try {
            const st = await navigator.clipboard.readText();
            sendResponse({ selectionText: st });
        }
        catch (e) {
            sendResponse({ error: String(e) });
        }
    })();
    return true;
});
