import { MENU_ID_PDF, COMMANDS, TRACE_PILOT_MARKER, RESPONSE_TYPE, } from "../../type";
import { Handler } from "../handler";
export class PdfHandler extends Handler {
    constructor() {
        super(MENU_ID_PDF);
        this.lastPdf = null;
        this.lastPlainText = "";
    }
    onGenericEvent(ev) {
        if (ev.command === COMMANDS.PDF_OPEN && ev.url) {
            if (!ev.url)
                return;
            console.log("pdf");
            this.lastPdf = {
                tabId: ev.tabId,
                url: ev.url,
                title: ev.title,
                isPdf: true,
                updatedAt: Date.now(),
            };
            this.setEnabled(true);
        }
        else {
            this.setEnabled(false);
        }
    }
    async getValidTabId(info, tab) {
        const i = info;
        const cands = [
            i.tabId,
            tab.id,
            this.lastPdf?.tabId,
        ].filter((x) => typeof x === "number");
        const ok = cands.find((id) => id >= 0);
        if (ok != null)
            return ok;
        const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (active?.id != null && active.id >= 0)
            return active.id;
        return null;
    }
    async handleRepoClick(info, tab, repoPath) {
        await this.onMenuClick(info, tab, repoPath);
    }
    // クリックされたとき
    async onMenuClick(info, tab, repoPath) {
        const tabId = await this.getValidTabId(info, tab);
        if (tabId == null || tabId < 0) {
            console.error("no valide tabId", tabId);
            return;
        }
        const rawUrl = info.frameUrl ||
            info.pageUrl ||
            tab.url ||
            tab.pendingUrl ||
            this.lastPdf?.url ||
            "";
        if (!rawUrl) {
            console.error("No url found for PDF tab.");
            return;
        }
        const { url, isPdf } = resolvePdfUrl(rawUrl);
        const plainText = info.selectionText;
        console.log("plainttext", plainText);
        if (plainText === undefined) {
            return;
        }
        this.lastPlainText = plainText;
        console.log("selected text: ", plainText);
        console.log("tab.url:", tab.url);
        console.log("tab.pendingUrl:", tab.pendingUrl);
        console.log("info.pageUrl:", info.pageUrl);
        console.log("info.frameUrl:", info.frameUrl);
        const msg = {
            type: RESPONSE_TYPE.CHROME_PDF,
            data: {},
            url,
            plain_text: plainText,
            repoPath,
        };
        let res = await this.sendToNativeHost(msg);
        const metaHash = res.metaHash;
        // クリップボードに貼る文字列
        const marker = `${TRACE_PILOT_MARKER} ${metaHash}`;
        const clipboardText = `${marker}\n${plainText}`;
        await writeClipboardViaContent(tabId, clipboardText);
    }
}
// PDFのurlを読み取れる形に変形
function resolvePdfUrl(tabUrl) {
    let url = tabUrl;
    try {
        const u = new URL(url);
        const file = u.searchParams.get("file");
        if (file)
            url = file;
    }
    catch { }
    if (!(url.startsWith("http://") || url.startsWith("https://") || url.startsWith("file:///"))) {
        const i = url.indexOf("/https://") !== -1 ? url.indexOf("/https://") :
            url.indexOf("/http://") !== -1 ? url.indexOf("/http://") :
                url.indexOf("/file:///") !== -1 ? url.indexOf("/file:///") :
                    -1;
        if (i !== -1)
            url = url.substring(i + 1);
    }
    const isPdf = isLikelyPdfUrl(url);
    return { url, isPdf };
}
function isLikelyPdfUrl(raw) {
    try {
        const u = new URL(raw);
        const path = u.pathname.toLowerCase();
        if (path.endsWith(".pdf"))
            return true;
        if (path.includes("/epdf/"))
            return true;
        const file = u.searchParams.get("file");
        if (file && file.toLowerCase().includes(".pdf"))
            return true;
        return false;
    }
    catch {
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
    // 状態が反映されるまで少し待つ（確認付き）
    for (let i = 0; i < 10; i++) {
        const t = await chrome.tabs.get(tabId);
        if (t.active)
            break;
        await sleep(50);
    }
    // 最後にもう少し待つ（右クリック直後のフォーカス不安定対策）
    await sleep(200);
}
// background / service worker 側
export async function writeClipboardViaContent(tabId, text) {
    await focusTabAndWindow(tabId);
    // content script にメッセージ送信
    const res = await chrome.tabs.sendMessage(tabId, {
        kind: "TRACE_PILOT_WRITE_CLIPBOARD",
        text,
    });
    if (!res?.ok) {
        throw new Error(res?.error ?? "clipboard write failed");
    }
}
