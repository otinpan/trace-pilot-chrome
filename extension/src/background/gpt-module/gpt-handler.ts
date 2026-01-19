import { COMMANDS,GenericEvent,MessageToNativeHost, WEB_INFO_SOURCE,TRACE_PILOT_MARKER } from "../../type";
import { Handler } from "../handler";
import { GPTThread } from "../../content/gpt-module/gpt-thread";
const MENU_ID="create_hash_and_store";
const NATIVE_HOST_NAME="trace_pilot_host_chrome";


export class GPTHandler extends Handler{
    threads: Map<string,GPTThread> = new Map();
    activeThread: GPTThread | null=null;
    constructor(){
        super(MENU_ID);
    }

    public onGenericEvent(ev: GenericEvent){
        if(ev.command===COMMANDS.GPT_OPEN){
            if(!ev.url)return;
            if(!ev.title)return;
            this.setEnabled(true);

            // gpt専用スレッドの作成
            chrome.tabs.sendMessage(ev.tabId,{
                kind: "GPT_START_OBSERVE",
                url: ev.url,
                title: ev.title,
            }).catch(()=>{

            });
            return;

        }else{
            this.setEnabled(false);
        }
    }

    protected override async onMenuClick(
        info: chrome.contextMenus.OnClickData,
        tab: chrome.tabs.Tab
    ):Promise<void>{
        
    }
}

export default GPTHandler;