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

    const rawUrl=
      (info as any).frameUrl ||
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

    const msg:MessageToNativeHost={
      type:RESPONSE_TYPE.CHROME_STATIC,
      data: {},
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
