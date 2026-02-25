import{
  MENU_ID_STATIC,
  GenericEvent,
  COMMANDS,
  MessageToNativeHost,
  TRACE_PILOT_MARKER,
  RESPONSE_TYPE,
} from "../../type"
import { Handler } from "../handler"
import { writeClipboardViaContent } from "../pdf-module/pdf-handler";


type ClickInfoExt=chrome.contextMenus.OnClickData & {tabId?: number};

function saveAsMhtml(tabId: number): Promise<Blob>{
  return new Promise((resolve,reject)=>{
    chrome.pageCapture.saveAsMHTML({tabId}, (data)=>{
      const err=chrome.runtime.lastError;
      if(err){
        reject(new Error(err.message||String(err)));
        return;
      }
      if(!data){
        reject(new Error("saveAsMHTML returned empty data"));
        return;
      }
      resolve(data);
    });
  });
}

function arrayBufferToBase64(ab: ArrayBuffer):string{
  let binary="";
  const bytes=new Uint8Array(ab);
  const chunkSize=0x8000;
  for(let i=0;i<bytes.length;i+=chunkSize){
    const chunk=bytes.subarray(i,i+chunkSize);
    binary+=String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export class StaticHandler extends Handler{
  constructor(){
    super(MENU_ID_STATIC);
  }

  public onGenericEvent(ev: GenericEvent){
    if(ev.command===COMMANDS.STATIC_OPEN&&ev.url){
      console.log("static page");

      this.setEnabled(true);
    }else{
      this.setEnabled(false);
    }
  }

  private async getValidTabId(
    info: chrome.contextMenus.OnClickData,
    tab: chrome.tabs.Tab
  ):Promise<number|null>{
    const i=info as ClickInfoExt;
    const cands=[
      i.tabId,
      tab.id,
    ].filter((x): x is number=>typeof x==="number");

    const ok=cands.find((id)=>id>=0);
    if(ok!=null)return ok;

    const [active]=await chrome.tabs.query({
      active:true,
      currentWindow: true
    });
    if(active?.id!=null && active.id>=0)return active.id;

    return null;
  }

  public async handleRepoClick(
    info: chrome.contextMenus.OnClickData,
    tab: chrome.tabs.Tab,
    repoPath: string,
  ):Promise<void>{
    await this.onMenuClick(info,tab,repoPath);
  }

  protected override async onMenuClick(
    info: chrome.contextMenus.OnClickData,
    tab: chrome.tabs.Tab,
    repoPath: string
  ):Promise<void>{
    const tabId=await this.getValidTabId(info,tab);
    if(tabId==null||tabId<0){
      console.error("no valid tabId", tabId);
      return;
    }

    const rawUrl= (info as any).frameUrl ||
      info.pageUrl ||
      tab.url ||
      (tab as any).pendingUrl ||
      "";
    if(!rawUrl){
      return;
    }

    const plainText=info.selectionText;
    if(plainText===undefined){
      return;
    }
    console.log("plain text: ",plainText);

    // mhtmlの取得
    let mhtml_base64: string;
    try{
      const mhtmlBlob=await saveAsMhtml(tabId);
      const ab=await mhtmlBlob.arrayBuffer();
      // 文字列を英数字だけの文字列に変換する
      // サイズは1.33倍になるが置換文字などを安全に扱える
      mhtml_base64=arrayBufferToBase64(ab);
    }catch(err){
      console.error("failed to capture mhtml",err);
      return;
    }

    const msg:MessageToNativeHost={
      type:RESPONSE_TYPE.CHROME_STATIC,
      data: {
        mhtml_base64,
        encoding: "base64",
        title: tab.title,
      },
      url: rawUrl,
      plain_text: plainText,
      repoPath,
    }

    let res=await this.sendToNativeHost(msg);
    const metaHash=res.metaHash;

    const marker=`${TRACE_PILOT_MARKER} ${metaHash}`;
    const clipboardText=`${marker}\n${plainText}`;

    await writeClipboardViaContent(tabId,clipboardText);
  }
}
