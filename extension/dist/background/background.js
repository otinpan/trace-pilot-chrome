// type.ts
var TRACE_PILOT_MARKER = "// @trace-pilot";

// background/generic-listener.ts
var GenericListener = class {
  constructor(onEvent) {
    this.handlers = /* @__PURE__ */ new Set();
    if (onEvent) this.handlers.add(onEvent);
    this.init();
  }
  init() {
    this.listen();
  }
  addHandler(handler) {
    this.handlers.add(handler);
    return () => this.removeHandler(handler);
  }
  removeHandler(handler) {
    this.handlers.delete(handler);
  }
  emit(ev) {
    for (const h of this.handlers) {
      try {
        h(ev);
      } catch (e) {
        console.error("GenericListener handelr error:", e, "event", ev);
      }
    }
  }
  listen() {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      const url = tab.url;
      if (!url || changeInfo.status !== "complete") return;
      const isPdf = isLikelyPdfUrl(url);
      let command = "otherOpen" /* OTHER_OPEN */;
      if (isPdf) {
        command = "pdfOpen" /* PDF_OPEN */;
      } else if (url.includes("chatgpt.com")) {
        command = "chatOpen" /* GPT_OPEN */;
      } else if (url.startsWith("https://www.google.com/")) {
        command = "googleOpen" /* GOOGLE_OPEN */;
      } else if (url.startsWith("https://stackoverflow.com")) {
        command = "stackoverflowOpen" /* STACKOVERFLOW_OPEN */;
      } else if (url.startsWith("https://github.com")) {
        command = "githubOpen" /* GITHUB_OPEN */;
      }
      this.emit({ command, tabId, url, title: tab.title });
    });
  }
};
function isLikelyPdfUrl(raw) {
  try {
    const u = new URL(raw);
    const path = u.pathname.toLowerCase();
    if (path.endsWith(".pdf")) return true;
    if (path.includes("/epdf/")) return true;
    const file = u.searchParams.get("file");
    if (file && file.toLowerCase().includes(".pdf")) return true;
    return false;
  } catch {
    return false;
  }
}
var generic_listener_default = GenericListener;

// background/handler.ts
var Handler = class {
  constructor(menuId) {
    this.menuId = menuId;
    this.installed = false;
    this.onClick = (info, tab) => {
      if (info.menuItemId !== this.menuId) return;
      if (!tab || typeof tab.id !== "number") {
        this.onClickMissingTab(info, tab);
        return;
      }
      void this.onMenuClick(info, tab);
    };
    this.init();
  }
  init() {
    if (this.installed) return;
    this.installed = true;
    chrome.contextMenus.onClicked.addListener(this.onClick);
  }
  // 拡張機能で作成した右クリックメニューを有効・無効
  setEnabled(enabled) {
    chrome.contextMenus.update(this.menuId, { enabled }, () => void chrome.runtime.lastError);
  }
  onClickMissingTab(info, tab) {
    console.error("Menu clicked but tab is missing:", info);
  }
};

// background/gpt-module/gpt-handler.ts
var MENU_ID = "create_hash_and_store";
var GPTHandler = class extends Handler {
  constructor() {
    super(MENU_ID);
    this.threads = /* @__PURE__ */ new Map();
    this.activeThread = null;
  }
  onGenericEvent(ev) {
    if (ev.command === "chatOpen" /* GPT_OPEN */) {
      if (!ev.url) return;
      if (!ev.title) return;
      this.setEnabled(true);
      chrome.tabs.sendMessage(ev.tabId, {
        kind: "GPT_START_OBSERVE",
        url: ev.url,
        title: ev.title
      }).catch(() => {
      });
      return;
    } else {
      this.setEnabled(false);
    }
  }
  async onMenuClick(info, tab) {
    const tabId = tab.id;
    if (tabId == null) return;
    const resolved = await chrome.tabs.sendMessage(tabId, {
      kind: "RESOLVE_LAST_TARGET"
    }).catch(() => null);
    if (!resolved?.ok) {
      console.warn("No target:", resolved?.reason);
      return;
    }
    const result = await chrome.tabs.sendMessage(tabId, {
      kind: "FORCE_RESPONSE_THREADPAIR",
      parentId: resolved.parentId,
      preIndex: resolved.preIndex
    }).catch(() => null);
    console.log("result", result);
  }
};
var gpt_handler_default = GPTHandler;

// background/pdf-module/pdf-handler.ts
var MENU_ID2 = "create_hash_and_store";
var NATIVE_HOST_NAME = "trace_pilot_host_chrome";
var PdfHandler = class extends Handler {
  constructor() {
    super(MENU_ID2);
    this.lastPdf = null;
    this.lastPlainText = "";
  }
  onGenericEvent(ev) {
    if (ev.command === "pdfOpen" /* PDF_OPEN */) {
      if (!ev.url) return;
      this.lastPdf = {
        tabId: ev.tabId,
        url: ev.url,
        title: ev.title,
        isPdf: true,
        updatedAt: Date.now()
      };
      this.setEnabled(true);
    } else {
      this.setEnabled(false);
    }
  }
  // クリックされたとき
  async onMenuClick(info, tab) {
    const tabId = tab.id;
    const rawUrl = tab.url || this.lastPdf?.url || "";
    if (!rawUrl) {
      console.error("No url found for PDF tab.");
      return;
    }
    const { url, isPdf } = resolvePdfUrl(rawUrl);
    let plainText = info.selectionText;
    if (plainText === void 0) {
      return;
    }
    this.lastPlainText = plainText;
    console.log("selected text: ", plainText);
    const msg = {
      url,
      plain_text: plainText,
      is_pdf: true,
      web_type: "PDF" /* PDF */,
      additional_data: { kind: "NONE" }
    };
    let res = await this.sendToNativeHost(msg);
    const metaHash = res.metaHash;
    const marker = `${TRACE_PILOT_MARKER} ${metaHash}`;
    const clipboardText = `${marker}
${plainText}`;
    await writeClipboardViaContent(tab.id, clipboardText);
  }
  sendToNativeHost(message) {
    return new Promise((resolve, reject) => {
      console.log("send message to native host: ", message);
      chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME, message, (res) => {
        const err = chrome.runtime.lastError;
        if (err) return reject(err.message || String(err));
        console.log("succcess", res);
        resolve(res);
      });
    });
  }
};
function resolvePdfUrl(tabUrl) {
  let url = tabUrl;
  try {
    const u = new URL(url);
    const file = u.searchParams.get("file");
    if (file) url = file;
  } catch {
  }
  if (!(url.startsWith("http://") || url.startsWith("https://") || url.startsWith("file:///"))) {
    const i = url.indexOf("/https://") !== -1 ? url.indexOf("/https://") : url.indexOf("/http://") !== -1 ? url.indexOf("/http://") : url.indexOf("/file:///") !== -1 ? url.indexOf("/file:///") : -1;
    if (i !== -1) url = url.substring(i + 1);
  }
  const isPdf = isLikelyPdfUrl2(url);
  return { url, isPdf };
}
function isLikelyPdfUrl2(raw) {
  try {
    const u = new URL(raw);
    const path = u.pathname.toLowerCase();
    if (path.endsWith(".pdf")) return true;
    if (path.includes("/epdf/")) return true;
    const file = u.searchParams.get("file");
    if (file && file.toLowerCase().includes(".pdf")) return true;
    return false;
  } catch {
    return raw.toLowerCase().includes(".pdf");
  }
}
async function focusTabAndWindow(tabId) {
  const tab = await chrome.tabs.get(tabId);
  if (tab.windowId != null) {
    await chrome.windows.update(tab.windowId, { focused: true });
  }
  await chrome.tabs.update(tabId, { active: true });
  await new Promise((r) => setTimeout(r, 50));
}
async function writeClipboardViaContent(tabId, text) {
  await focusTabAndWindow(tabId);
  const res = await chrome.tabs.sendMessage(tabId, {
    kind: "TRACE_PILOT_WRITE_CLIPBOARD",
    text
  });
  if (!res?.ok) {
    throw new Error(res?.error ?? "clipboard write failed");
  }
}

// background/background.ts
var genericListener = new generic_listener_default();
var pdfHandler = new PdfHandler();
genericListener.addHandler((ev) => pdfHandler.onGenericEvent(ev));
var gptHandler = new gpt_handler_default();
genericListener.addHandler((ev) => gptHandler.onGenericEvent(ev));
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && typeof msg === "object" && msg.type === "PING") {
    sendResponse({ ok: true, from: "background" });
    console.log("first message is sccessed!");
    return;
  }
});
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    type: "normal",
    title: "create hash and store with trace-pilot",
    contexts: ["selection", "page"],
    id: "create_hash_and_store",
    enabled: false
  });
});
