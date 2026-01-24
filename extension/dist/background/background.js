// type.ts
var TRACE_PILOT_MARKER = "// @trace-pilot";
var MENU_ID_PDF = "create_hash_and_store_PDF";
var MENU_ID_GPT = "create_hash_and_store_GPT";
var MENU_ID_OTER = "create_hash_and_store_OTHER";
var NATIVE_HOST_NAME = "trace_pilot_host_chrome";

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
var Handler = class _Handler {
  constructor(menuId) {
    this.menuId = menuId;
    _Handler.registry.set(menuId, this);
    this.init();
  }
  static {
    this.installed = false;
  }
  static {
    this.registry = /* @__PURE__ */ new Map();
  }
  init() {
    if (_Handler.installed) return;
    _Handler.installed = true;
    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
      const menuId = String(info.menuItemId);
      const h = _Handler.registry.get(menuId);
      if (!h) return;
      if (!tab || typeof tab.id !== "number") {
        h.onClickMissingTab(info, tab);
        return;
      }
      await h.onMenuClick(info, tab);
    });
  }
  // 拡張機能で作成した右クリックメニューを有効・無効
  setEnabled(enabled) {
    chrome.contextMenus.update(this.menuId, { enabled }, () => void chrome.runtime.lastError);
  }
  onClickMissingTab(info, tab) {
    console.error("Menu clicked but tab is missing:", info);
  }
};

// background/pdf-module/pdf-handler.ts
var PdfHandler = class extends Handler {
  constructor() {
    super(MENU_ID_PDF);
    this.lastPdf = null;
    this.lastPlainText = "";
  }
  onGenericEvent(ev) {
    if (ev.command === "pdfOpen" /* PDF_OPEN */ && ev.url) {
      if (!ev.url) return;
      console.log("pdf");
      this.lastPdf = {
        tabId: ev.tabId,
        url: ev.url,
        title: ev.title,
        isPdf: true,
        updatedAt: Date.now()
      };
      this.setEnabled(true);
    }
  }
  async getValideTabId(info, tab) {
    const i = info;
    const cands = [
      i.tabId,
      tab.id,
      this.lastPdf?.tabId
    ].filter((x) => typeof x === "number");
    const ok = cands.find((id) => id >= 0);
    if (ok != null) return ok;
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (active?.id != null && active.id >= 0) return active.id;
    return null;
  }
  // クリックされたとき
  async onMenuClick(info, tab) {
    const tabId = await this.getValideTabId(info, tab);
    if (tabId == null || tabId < 0) {
      console.error("no valide tabId", tabId);
      return;
    }
    const rawUrl = info.frameUrl || info.pageUrl || tab.url || tab.pendingUrl || this.lastPdf?.url || "";
    if (!rawUrl) {
      console.error("No url found for PDF tab.");
      return;
    }
    const { url, isPdf } = resolvePdfUrl(rawUrl);
    const plainText = await getSelectionFromAnyFrame(tabId);
    if (!plainText.trim()) {
      console.warn("selection is empty");
      return;
    }
    console.log("plainttext", plainText);
    if (plainText === void 0) {
      return;
    }
    this.lastPlainText = plainText;
    console.log("selected text: ", plainText);
    console.log("tab.url:", tab.url);
    console.log("tab.pendingUrl:", tab.pendingUrl);
    console.log("info.pageUrl:", info.pageUrl);
    console.log("info.frameUrl:", info.frameUrl);
    const msg = {
      type: "CHROME_PDF" /* CHROME_PDF */,
      data: {},
      url,
      plain_text: plainText
    };
    let res = await this.sendToNativeHost(msg);
    const metaHash = res.metaHash;
    const marker = `${TRACE_PILOT_MARKER} ${metaHash}`;
    const clipboardText = `${marker}
${plainText}`;
    await writeClipboardViaContent(tabId, clipboardText);
  }
  sendToNativeHost(message) {
    return new Promise((resolve, reject) => {
      console.log("send message to native host (pdf): ", message);
      chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME, message, (res) => {
        const err = chrome.runtime.lastError;
        if (err) return reject(err.message || String(err));
        console.log("succcess", res);
        resolve(res);
      });
    });
  }
};
async function getSelectionFromAnyFrame(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: () => {
      const sel = window.getSelection?.();
      return {
        href: location.href,
        focused: document.hasFocus(),
        text: sel ? sel.toString() : ""
      };
    }
  });
  const hit = results.map((r) => r.result).find((r) => (r.text ?? "").trim().length > 0);
  if (hit) return hit.text;
  console.warn("No selection text in any frame:", results.map((r) => r.result));
  return "";
}
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
async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
async function focusTabAndWindow(tabId) {
  const tab = await chrome.tabs.get(tabId);
  if (tab.windowId != null) {
    await chrome.windows.update(tab.windowId, { focused: true });
  }
  await chrome.tabs.update(tabId, { active: true });
  for (let i = 0; i < 10; i++) {
    const t = await chrome.tabs.get(tabId);
    if (t.active) break;
    await sleep(50);
  }
  await sleep(200);
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

// background/gpt-module/gpt-handler.ts
var GPTHandler = class extends Handler {
  constructor() {
    super(MENU_ID_GPT);
    this.threads = /* @__PURE__ */ new Map();
    this.activeThread = null;
    this.lastPlainText = "";
  }
  onGenericEvent(ev) {
    if (ev.command === "chatOpen" /* GPT_OPEN */ && ev.url && ev.title) {
      console.log("gpt");
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
    }
  }
  async getValideTabId(info, tab) {
    const i = info;
    const cands = [
      i.tabId,
      tab.id
    ].filter((x) => typeof x === "number");
    const ok = cands.find((id) => id >= 0);
    if (ok != null) return ok;
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (active?.id != null && active.id >= 0) return active.id;
    return null;
  }
  async onMenuClick(info, tab) {
    const tabId = await this.getValideTabId(info, tab);
    if (tabId == null || tabId < 0) {
      console.error("no valide tabId", tabId);
      return;
    }
    const rawUrl = tab.url || "";
    if (tabId == null) return;
    if (!rawUrl) {
      return;
    }
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
    console.log("succsess: clickmenu");
    console.log(resolved.parentId);
    console.log("result", result);
    const plainText = await getSelectionFromAnyFrame(tabId);
    if (!plainText.trim()) {
      console.warn("selection is empty");
      return;
    }
    if (plainText === void 0) {
      return;
    }
    this.lastPlainText = plainText;
    const threadPair = result.result;
    const sanitized = {
      ...threadPair,
      codeBlocks: threadPair.codeBlocks.map((cb) => {
        const { codeRef, ...rest } = cb;
        return rest;
      })
    };
    const msg = {
      type: "CHAT_GPT" /* CHAT_GPT */,
      data: { thread_pair: sanitized },
      url: rawUrl,
      plain_text: plainText
    };
    console.log(msg);
    let res = await this.sendToNativeHost(msg);
    const metaHash = res.metaHash;
    const marker = `${TRACE_PILOT_MARKER} ${metaHash}`;
    const clipboardText = `${marker}
${plainText}`;
    await writeClipboardViaContent(tab.id, clipboardText);
  }
  sendToNativeHost(message) {
    return new Promise((resolve, reject) => {
      console.log("send message to native host (gpt): ", message);
      chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME, message, (res) => {
        const err = chrome.runtime.lastError;
        if (err) return reject(err.message || String(err));
        console.log("succcess", res);
        resolve(res);
      });
    });
  }
};
var gpt_handler_default = GPTHandler;

// background/other-handler.ts
var OtherHandler = class extends Handler {
  constructor() {
    super(MENU_ID_OTER);
  }
  onGenericEvent(ev) {
    if (ev.command === "otherOpen" /* OTHER_OPEN */ && ev.url) {
      this.setEnabled(false);
    }
  }
  async onMenuClick(info, tab) {
    return;
  }
};

// background/background.ts
var genericListener = new generic_listener_default();
var pdfHandler = new PdfHandler();
genericListener.addHandler((ev) => pdfHandler.onGenericEvent(ev));
var gptHandler = new gpt_handler_default();
genericListener.addHandler((ev) => gptHandler.onGenericEvent(ev));
var otherHandler = new OtherHandler();
genericListener.addHandler((ev) => otherHandler.onGenericEvent(ev));
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
    title: "create hash and store with trace-pilot (PDF)",
    contexts: ["selection", "page"],
    id: MENU_ID_PDF,
    enabled: false
  });
  chrome.contextMenus.create({
    type: "normal",
    title: "create hash and store with trace-pilot (GPT)",
    contexts: ["selection", "page"],
    id: MENU_ID_GPT,
    enabled: false
  });
});
