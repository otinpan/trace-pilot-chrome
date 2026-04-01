const OFFSCREEN_WRITE_KIND = "TRACE_PILOT_OFFSCREEN_WRITE_CLIPBOARD";

type OffscreenClipboardRequest = {
  kind: typeof OFFSCREEN_WRITE_KIND;
  text: string;
};

function isOffscreenClipboardRequest(
  value: unknown
): value is OffscreenClipboardRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    (value as { kind?: unknown }).kind === OFFSCREEN_WRITE_KIND &&
    "text" in value &&
    typeof (value as { text?: unknown }).text === "string"
  );
}

function writeClipboardWithExecCommand(text: string): void {
  const textarea = document.createElement("textarea");
  let copied = false;

  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";

  const handleCopy = (event: ClipboardEvent) => {
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
    } catch (error: unknown) {
      try {
        writeClipboardWithExecCommand(message.text);
        sendResponse({
          ok: true,
          method: "execCommand",
          clipboardApiError: String(error instanceof Error ? error.message : error),
        });
      } catch (fallbackError: unknown) {
        sendResponse({
          ok: false,
          error: String(
            fallbackError instanceof Error ? fallbackError.message : fallbackError
          ),
          clipboardApiError: String(error instanceof Error ? error.message : error),
        });
      }
    }
  })();

  return true;
});
