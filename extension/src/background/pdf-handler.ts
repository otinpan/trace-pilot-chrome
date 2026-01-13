import { COMMANDS } from "./generic-listener";
import { Handler } from "./handler";

const MENU_ID="create_hash_and_store";
const NATIVE_HOST_NAME="trace_pilot_host_chrome";

type PdfState={
    tabId: number;
    url: string;
    title?: string;
    isPdf?: boolean;
    updatedAt: number;
}

export class PdfHandler extends Handler {
    private lastPdf: PdfState|null=null;
    private msgInstalled=false;
    constructor(){
        super(MENU_ID);
        this.initMessageListener();

    }

    private initMessageListener(){
        if(this.msgInstalled)return;
        this.msgInstalled=true;

        chrome.runtime.onMessage.addListener((msg,sender)=>{
            if(!msg||typeof msg!=="object")return;

            const {command,payload}=msg as{
                command?: COMMANDS;
                payload?: {url?:string; title?: string};
            };

            const tabId=sender.tab?.id;
            if(typeof tabId!=="number")return;

            if(command===COMMANDS.PDF_OPEN){
                const url=payload?.url ?? "";
                if(!url)return;

                this.lastPdf={
                    tabId,
                    url,
                    title:payload?.title,
                    isPdf: true,
                    updatedAt: Date.now(),
                };

                this.setEnabled(true);
            }else{
                this.setEnabled(false);
            }
        });
    }

    protected override async onMenuClick(
        info: chrome.contextMenus.OnClickData,
        tab: chrome.tabs.Tab
    ):Promise<void>{
        const tabId=tab.id!;
        const rawUrl=tab.url || this.lastPdf?.url || "";
        if(!rawUrl){
            console.error("No url found for PDF tab.");
            return;
        }

        const { url, isPdf } = resolvePdfUrl(rawUrl);

        const res=await sendMessageToTab(tabId,{type:"trace-pilot"});
        if(!res)return;

        if("error" in res){
            console.error("trace-pilot error:", res.error);
            return;
        }

        const plainText=res.selectionText as string;
        await this.sendToNativeHost({url,plainText,isPdf});
    }

    private sendToNativeHost(message: any):Promise<any>{
        return new Promise((resolve,reject)=>{
            chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME,message,(res)=>{
                const err=chrome.runtime.lastError;
                if(err)return reject(err.message||String(err));
                resolve(res);
            })
        })
    }
}

function sendMessageToTab(tabId: number, msg: any): Promise<any> {
    return new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, msg, (res) => {
        if (chrome.runtime.lastError) {
            console.error("sendMessage failed:", chrome.runtime.lastError.message);
            resolve(undefined);
            return;
        }
        resolve(res);
        });
    });
}

// URL解決（そのまま）
function resolvePdfUrl(tabUrl: string): { url: string; isPdf: boolean } {
    let url = tabUrl;

    try {
        const u = new URL(url);
        const file = u.searchParams.get("file");
        if (file) url = file;
    } catch {}

    if (!(url.startsWith("http://") || url.startsWith("https://") || url.startsWith("file:///"))) {
        const i =
        url.indexOf("/https://") !== -1 ? url.indexOf("/https://") :
        url.indexOf("/http://")  !== -1 ? url.indexOf("/http://")  :
        url.indexOf("/file:///") !== -1 ? url.indexOf("/file:///") :
        -1;
        if (i !== -1) url = url.substring(i + 1);
    }

    const isPdf = isLikelyPdfUrl(url);
    return { url, isPdf };
}


function isLikelyPdfUrl(raw: string): boolean {
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