import { MENU_ID_GOOGLE_SHEETS, COMMANDS, RESPONSE_TYPE, TRACE_PILOT_MARKER, } from "../../type";
import { Handler } from "../handler";
import { writeClipboardViaContent } from "../pdf-module/pdf-handler";
export class GoogleSheetsHandler extends Handler {
    constructor() {
        super(MENU_ID_GOOGLE_SHEETS);
    }
    onGenericEvent(ev) {
        if (ev.command == COMMANDS.GOOGLE_SHEETS_OPEN && ev.url && ev.title) {
            console.log("google sheets");
            if (!ev.url)
                return;
            if (!ev.title)
                return;
            this.setEnabled(true);
            chrome.tabs.sendMessage(ev.tabId, {
                kind: "GOOGLE_SHEETS_START_OBSERVE",
                url: ev.url,
                title: ev.title,
            }).catch(() => {
                return;
            });
        }
        else {
            this.setEnabled(false);
        }
    }
    async handleContentMessage(msg, tabId) {
        if (typeof msg.url !== "string" || !msg.url) {
            return { ok: false, error: "url is required" };
        }
        if (typeof msg.repoPath !== "string" || !msg.repoPath) {
            return { ok: false, error: "repoPath is required" };
        }
        if (typeof msg.plainText !== "string") {
            return { ok: false, error: "plainText must be a string" };
        }
        if (tabId == null || tabId < 0) {
            return { ok: false, error: "tabId is required" };
        }
        const plainText = msg.plainText;
        const nativeMessage = {
            type: RESPONSE_TYPE.GOOGLE_SHEETS,
            data: {
                selectedArea: msg.selectedArea,
                cellSnapshot: msg.cellSnapshot,
            },
            url: msg.url,
            plain_text: plainText,
            repoPath: msg.repoPath,
        };
        console.log("message to native message: ", nativeMessage);
        try {
            const response = await this.sendToNativeHost(nativeMessage);
            const metaHash = response.metaHash;
            const marker = `${TRACE_PILOT_MARKER} ${metaHash}`;
            const clipboardText = `${marker}\n${plainText}`;
            await writeClipboardViaContent(tabId, clipboardText);
            return { ok: true, response };
        }
        catch (error) {
            return { ok: false, error: String(error) };
        }
    }
    async getValidTabId(info, tab) {
        const i = info;
        const cands = [
            i.tabId,
            tab.id,
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
    async onMenuClick(info, tab, repoPath) {
        const tabId = await this.getValidTabId(info, tab);
        if (tabId == null || tabId < 0) {
            console.error("no valid tabId", tabId);
            return;
        }
        const rawUrl = tab.url || "";
        if (tabId == null)
            return;
        if (!rawUrl) {
            return;
        }
        let result;
        try {
            // google-sheets-threadからdom情報を取得
            result = await chrome.tabs.sendMessage(tabId, {
                kind: "FORCE_RESPONSE_SHEETS_DOM",
                url: rawUrl,
            });
        }
        catch (e) {
            console.warn("sendMessage FORCE_RESPONSE_SHEETS_DOM returned empty", result);
            return;
        }
        console.log("result:", result);
        const plainText = info.selectionText;
        if (plainText === undefined) {
            return;
        }
        // TODO:  NativeHostにmessageを送る
    }
}
