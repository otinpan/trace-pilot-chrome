import { COMMANDS,GenericEvent,MessageToNativeHost, WEB_INFO_SOURCE,TRACE_PILOT_MARKER } from "../type";
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
    private lastPlainText: string="";
    private msgInstalled=false;
    constructor(){
        super(MENU_ID);
    }

    public onGenericEvent(ev: GenericEvent){
        if(ev.command===COMMANDS.PDF_OPEN){
            if(!ev.url)return;

            this.lastPdf={
                tabId: ev.tabId,
                url: ev.url,
                title: ev.title,
                isPdf: true,
                updatedAt: Date.now(),
            }
            
            this.setEnabled(true);
        }else{
            this.setEnabled(false);
        }
    }

    

    // クリックされたとき
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

        let plainText=info.selectionText;
        if(plainText===undefined){
            return;
        }
        this.lastPlainText=plainText;

        console.log("selected text: ",plainText);

        const msg:MessageToNativeHost={
            url,
            plain_text:plainText,
            is_pdf: true,
            web_type: WEB_INFO_SOURCE.PDF,
            additional_data:{kind:"NONE"},
        }
        let res=await this.sendToNativeHost(msg);
        const metaHash=res.metaHash;

        // クリップボードに貼る文字列
        const marker = `${TRACE_PILOT_MARKER} ${metaHash}`;
        const clipboardText = `${marker}\n${plainText}`;

        await writeClipboardViaContent(tab.id!, clipboardText);
    }

    private sendToNativeHost(message: any):Promise<any>{
        return new Promise((resolve,reject)=>{
            console.log("send message to native host: ",message);
            chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME,message,(res)=>{
                const err=chrome.runtime.lastError;
                if(err)return reject(err.message||String(err));
                console.log("succcess",res);
                resolve(res);
            })
        })
    }
}


// PDFのurlを読み取れる形に変形
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

// background / service worker 側
async function writeClipboardViaContent(tabId: number, text: string) {
  // content script にメッセージ送信
  const res = await chrome.tabs.sendMessage(tabId, {
    kind: "TRACE_PILOT_WRITE_CLIPBOARD",
    text,
  });

  if (!res?.ok) {
    throw new Error(res?.error ?? "clipboard write failed");
  }
}
