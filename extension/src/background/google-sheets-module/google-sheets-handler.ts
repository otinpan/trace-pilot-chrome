import{
  MENU_ID_GOOGLE_SHEETS,
  COMMANDS,
  GenericEvent,
  MessageToNativeHost,
  RESPONSE_TYPE,
  TRACE_PILOT_MARKER,
  Result,
} from "../../type";
import { Handler } from "../handler";
import { writeClipboardViaContent } from "../pdf-module/pdf-handler";
type ClickInfoExt = chrome.contextMenus.OnClickData & { tabId?: number };

export class GoogleSheetsHandler extends Handler{
  constructor(){
    super(MENU_ID_GOOGLE_SHEETS);
  }

  public onGenericEvent(ev: GenericEvent){
    if(ev.command==COMMANDS.GOOGLE_SHEETS_OPEN&&ev.url&&ev.title){
      console.log("google sheets");
      if(!ev.url)return;
      if(!ev.title)return;
      this.setEnabled(true);

      chrome.tabs.sendMessage(ev.tabId,{
        kind: "GOOGLE_SHEETS_START_OBSERVE",
        url: ev.url,
        title: ev.title,
      }).catch(()=>{
        return;
      });
    }else{
      this.setEnabled(false);
    }
  }

  public async handleContentMessage(msg: {
    url?: unknown;
    repoPath?: unknown;
    plainText?: unknown;
    selectedArea?: unknown;
    cellSnapshot?: unknown;
  }, tabId: number | null):Promise<Result>{
    if(typeof msg.url !== "string" || !msg.url){
      return { ok: false, message: "url is required" };
    }

    if(typeof msg.repoPath !== "string" || !msg.repoPath){
      return { ok: false, message: "repoPath is required" };
    }

    if(typeof msg.plainText !== "string"){
      return { ok: false, message: "plainText must be a string" };
    }

    if(tabId == null || tabId < 0){
      return { ok: false, message: "tabId is required" };
    }

    const plainText=msg.plainText;

    const nativeMessage: MessageToNativeHost = {
      type: RESPONSE_TYPE.GOOGLE_SHEETS,
      data: {
        selectedArea: msg.selectedArea as any,
        cellSnapshot: msg.cellSnapshot as any,
      },
      url: msg.url,
      plain_text: plainText,
      repoPath: msg.repoPath,
    };

    console.log("message to native message: ",nativeMessage);

    try{
      const response = await this.sendToNativeHost(nativeMessage);
      if(!response.ok){
        return { ok: false, message: response.error };
      }
      const metaHash = response.metaHash;
      if(!metaHash){
        return { ok: false, message: "native host response did not include metaHash" };
      }
      const marker = `${TRACE_PILOT_MARKER} ${metaHash}`;
      const clipboardText = `${marker}\n${plainText}`;
      const result=await writeClipboardViaContent(tabId, clipboardText);
      return result;
    }catch(error){
      return { ok: false, message: String(error) };
    }
  }

  private async getValidTabId(
    info: chrome.contextMenus.OnClickData,
    tab: chrome.tabs.Tab
  ):Promise<number | null>{
    const i=info as ClickInfoExt;
    const cands=[
      i.tabId,
      tab.id,
    ].filter((x):x is number=>typeof x==="number");

    const ok=cands.find((id)=>id>=0);
    if(ok!=null)return ok;

    const [active]=await chrome.tabs.query({active:true,currentWindow:true});
    if(active?.id!=null && active.id>=0)return active.id;

    return null;
  }

  public async handleRepoClick(
    info: chrome.contextMenus.OnClickData,
    tab: chrome.tabs.Tab,
    repoPath: string
  ):Promise<void>{
    await this.onMenuClick(info,tab,repoPath);
  }

  protected override async onMenuClick(
    info: chrome.contextMenus.OnClickData,
    tab: chrome.tabs.Tab,
    repoPath: string
  ):Promise<Result>{
    return{
      ok: true,
      message: null,
    }
  }
}
