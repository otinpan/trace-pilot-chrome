import { 
    MENU_ID_PDF,
    NATIVE_HOST_NAME,
    COMMANDS,GenericEvent,
    MessageToNativeHost, 
    TRACE_PILOT_MARKER,
    RESPONSE_TYPE,
    PDFData,
    GPTData,
} from "../../type";
import { Handler } from "../handler";


type ClickInfoExt = chrome.contextMenus.OnClickData & { tabId?: number };

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
    constructor(){
        super(MENU_ID_PDF);
    }

    public onGenericEvent(ev: GenericEvent){
        if(ev.command===COMMANDS.PDF_OPEN&&ev.url){
            if(!ev.url)return;

            console.log("pdf");

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


    private async getValideTabId(
        info: chrome.contextMenus.OnClickData,
        tab: chrome.tabs.Tab
    ):Promise<number|null>{
        const i=info as ClickInfoExt;
        const cands=[
            i.tabId,
            tab.id,
            this.lastPdf?.tabId,
        ].filter((x): x is number=>typeof x==="number");

        const ok=cands.find((id)=>id>=0);
        if(ok!=null)return ok;

        const [active]=await chrome.tabs.query({active:true,currentWindow:true});
        if(active?.id!=null && active.id>=0)return active.id;

        return null;
    }


    
    // クリックされたとき
    protected override async onMenuClick(
        info: chrome.contextMenus.OnClickData,
        tab: chrome.tabs.Tab
    ):Promise<void>{
        const tabId=await this.getValideTabId(info,tab);
        if(tabId==null||tabId<0){
            console.error("no valide tabId",tabId);
            return;
        }

        const rawUrl =
            (info as any).frameUrl ||
            info.pageUrl ||
            tab.url ||
            (tab as any).pendingUrl ||
            this.lastPdf?.url ||
            "";

        if(!rawUrl){
            console.error("No url found for PDF tab.");
            return;
        }

        const { url, isPdf } = resolvePdfUrl(rawUrl);

        const plainText= info.selectionText;
        console.log("plainttext",plainText);
        if(plainText===undefined){
            return;
        }
        this.lastPlainText=plainText;

        console.log("selected text: ",plainText);

        console.log("tab.url:", tab.url);
        console.log("tab.pendingUrl:", (tab as any).pendingUrl);
        console.log("info.pageUrl:", info.pageUrl);
        console.log("info.frameUrl:", (info as any).frameUrl);

        
        const msg:MessageToNativeHost={
            type: RESPONSE_TYPE.CHROME_PDF,
            data: {},
            url,
            plain_text:plainText,
        }
        let res=await this.sendToNativeHost(msg);
        const metaHash=res.metaHash;

        // クリップボードに貼る文字列
        const marker = `${TRACE_PILOT_MARKER} ${metaHash}`;
        const clipboardText = `${marker}\n${plainText}`;

        await writeClipboardViaContent(tabId, clipboardText);
    }

    private sendToNativeHost(message: any):Promise<any>{
        return new Promise((resolve,reject)=>{
            console.log("send message to native host (pdf): ",message);
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

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function focusTabAndWindow(tabId: number) {
  const tab = await chrome.tabs.get(tabId);

  if (tab.windowId != null) {
    await chrome.windows.update(tab.windowId, { focused: true });
  }
  await chrome.tabs.update(tabId, { active: true });

  // 状態が反映されるまで少し待つ（確認付き）
  for (let i = 0; i < 10; i++) {
    const t = await chrome.tabs.get(tabId);
    if (t.active) break;
    await sleep(50);
  }

  // 最後にもう少し待つ（右クリック直後のフォーカス不安定対策）
  await sleep(200);
}





// background / service worker 側
export async function writeClipboardViaContent(tabId: number, text: string) {
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

