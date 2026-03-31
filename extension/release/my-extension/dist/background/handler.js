import { NATIVE_HOST_NAME, } from "../type";
export class Handler {
    constructor(menuId) {
        this.menuId = menuId;
        Handler.registry.set(menuId, this);
        this.init();
    }
    init() {
        if (Handler.installed)
            return;
        Handler.installed = true;
    }
    async sendToNativeHost(message) {
        return new Promise((resolve, reject) => {
            console.log("send message to native host (git): ", message);
            chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME, message, (res) => {
                const err = chrome.runtime.lastError;
                if (err)
                    return reject(err.message || String(err));
                console.log("success", res);
                resolve(res);
            });
        });
    }
    // 拡張機能で作成した右クリックメニューを有効・無効
    setEnabled(enabled) {
        chrome.contextMenus.update(this.menuId, { enabled }, () => void chrome.runtime.lastError);
    }
    onClickMissingTab(info, tab) {
        console.error("Menu clicked but tab is missing:", info);
    }
}
Handler.installed = false;
Handler.registry = new Map();
