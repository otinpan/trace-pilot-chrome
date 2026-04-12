import{
    NATIVE_HOST_NAME,
    NativeHostResponse,
} from "../type";

import { Result } from "../type";

export abstract class Handler{
    private static installed=false;
    private static registry=new Map<string,Handler>();
    private static badgeTimers=new Map<number, ReturnType<typeof globalThis.setTimeout>>();
    private static globalBadgeTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
    constructor(
        protected readonly menuId: string,
    ){
        Handler.registry.set(menuId,this);
        this.init();
    }

    init(){
        if(Handler.installed)return;
        Handler.installed=true;

    }

    async showResult(result: Result, tabId?: number): Promise<void>{
        const text=result.ok ? "OK" : "NG";
        const color=result.ok ? "#1f9d55" : "#d93025";
        const title=result.ok
            ? "trace-pilot: success"
            : `trace-pilot: ${result.message ?? "failed"}`;
        const validTabId=typeof tabId === "number" && tabId >= 0
            ? tabId
            : undefined;
        const details=validTabId != null ? {tabId: validTabId} : {};

        await chrome.action.setBadgeText({
            text,
            ...details,
        });
        await chrome.action.setBadgeBackgroundColor({
            color,
            ...details,
        });
        await chrome.action.setTitle({
            title,
            ...details,
        });

        if(validTabId == null){
            if(Handler.globalBadgeTimer != null){
                clearTimeout(Handler.globalBadgeTimer);
            }

            Handler.globalBadgeTimer=globalThis.setTimeout(() => {
                void chrome.action.setBadgeText({
                    text: "",
                });
                Handler.globalBadgeTimer = null;
            }, 3000);
            return;
        }

        const prevTimer=Handler.badgeTimers.get(validTabId);
        if(prevTimer != null){
            clearTimeout(prevTimer);
        }

        const timer=globalThis.setTimeout(() => {
            void chrome.action.setBadgeText({
                text: "",
                tabId: validTabId,
            });
            Handler.badgeTimers.delete(validTabId);
        }, 3000);

        Handler.badgeTimers.set(validTabId, timer);
    }

    protected async sendToNativeHost(message:any):Promise<NativeHostResponse>{
        return new Promise((resolve,reject)=>{
            console.log("send message to native host (git): ",message);
            chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME,message,(res: NativeHostResponse | undefined)=>{
                const err=chrome.runtime.lastError;
                if(err)return reject(err.message||String(err));
                if(!res)return reject("native host returned empty response");
                console.log("success",res);
                resolve(res);
            });
        })
    }

    // 拡張機能で作成した右クリックメニューを有効・無効
    protected setEnabled(enabled: boolean) {
        chrome.contextMenus.update(this.menuId, { enabled }, () => void chrome.runtime.lastError);
    }

    // クリックされたとき
    protected abstract onMenuClick(
        info: chrome.contextMenus.OnClickData,
        tab: chrome.tabs.Tab,
        repoPath:string
    ):Promise<Result>;

    protected onClickMissingTab(
        info: chrome.contextMenus.OnClickData,
        tab?: chrome.tabs.Tab
    ){
        console.error("Menu clicked but tab is missing:", info);
    }

}
