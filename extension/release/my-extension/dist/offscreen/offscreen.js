"use strict";
(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // offscreen/offscreen.ts
  var require_offscreen = __commonJS({
    "offscreen/offscreen.ts"() {
      var OFFSCREEN_WRITE_KIND = "TRACE_PILOT_OFFSCREEN_WRITE_CLIPBOARD";
      function isOffscreenClipboardRequest(value) {
        return typeof value === "object" && value !== null && "kind" in value && value.kind === OFFSCREEN_WRITE_KIND && "text" in value && typeof value.text === "string";
      }
      function writeClipboardWithExecCommand(text) {
        const textarea = document.createElement("textarea");
        let copied = false;
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.top = "0";
        textarea.style.left = "0";
        textarea.style.opacity = "0";
        textarea.style.pointerEvents = "none";
        const handleCopy = (event) => {
          event.preventDefault();
          event.clipboardData?.setData("text/plain", text);
          copied = true;
        };
        document.addEventListener("copy", handleCopy, true);
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length);
        const ok = document.execCommand("copy");
        document.removeEventListener("copy", handleCopy, true);
        textarea.remove();
        if (!ok || !copied) {
          throw new Error("execCommand copy failed in offscreen document");
        }
      }
      chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (!isOffscreenClipboardRequest(message)) {
          return;
        }
        (async () => {
          try {
            await navigator.clipboard.writeText(message.text);
            sendResponse({ ok: true });
          } catch (error) {
            try {
              writeClipboardWithExecCommand(message.text);
              sendResponse({
                ok: true,
                method: "execCommand",
                clipboardApiError: String(error instanceof Error ? error.message : error)
              });
            } catch (fallbackError) {
              sendResponse({
                ok: false,
                error: String(
                  fallbackError instanceof Error ? fallbackError.message : fallbackError
                ),
                clipboardApiError: String(error instanceof Error ? error.message : error)
              });
            }
          }
        })();
        return true;
      });
    }
  });
  require_offscreen();
})();
