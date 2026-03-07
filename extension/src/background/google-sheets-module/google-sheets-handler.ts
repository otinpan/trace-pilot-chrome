import{
  MENU_ID_GOOGLE_SHEETS,
  COMMANDS,
  GenericEvent,
  NATIVE_HOST_NAME,
  MessageToNativeHost,
  TRACE_PILOT_MARKER,
  RESPONSE_TYPE,
} from "../../type";
import { Handler } from "../handler";

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

  private async handleRepoClick(
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
  ):Promise<void>{
    const tabId=await this.getValidTabId(info,tab);
    if(tabId==null||tabId<0){
      console.error("no valid tabId",tabId);
      return;
    }

    const rawUrl=tab.url || "";
    if(tabId==null)return;
    if(!rawUrl){
      return;
    }

    let result:any;
    try{
      // google-sheets-threadからdom情報を取得
      result=await chrome.tabs.sendMessage(tabId,{
        kind: "FORCE_RESPONSE_SHEETS_DOM",
        url: rawUrl,
      })
    }catch(e){
      console.warn("sendMessage FORCE_RESPONSE_SHEETS_DOM returned empty", result);
      return;
    }

    console.log("result:", result);
    const plainText=info.selectionText;
    if(plainText===undefined){
      return;
    }

    // TODO:  NativeHostにmessageを送る
  }
}
