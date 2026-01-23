import { COMMANDS,GenericEvent,MessageToNativeHost, TRACE_PILOT_MARKER } from "../../type";
import { Handler } from "../handler";
import { GPTThread } from "../../content/gpt-module/gpt-thread";
import { MENU_ID,NATIVE_HOST_NAME } from "../../type";


export class GPTHandler extends Handler{
    threads: Map<string,GPTThread> = new Map();
    activeThread: GPTThread | null=null;
    lastPlainText: string="";
    constructor(){
        super(MENU_ID);
    }

    public onGenericEvent(ev: GenericEvent){
        if(ev.command===COMMANDS.GPT_OPEN&&ev.url&&ev.title){
            console.log("gpt");
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

        }
    }

    protected override async onMenuClick(
        info: chrome.contextMenus.OnClickData,
        tab: chrome.tabs.Tab
    ):Promise<void>{
        const tabId=tab.id;
        if(tabId==null)return;

        // イベントが発火したことを通知 → parentIdの取得
        const resolved=await chrome.tabs.sendMessage(tabId,{
            kind:"RESOLVE_LAST_TARGET",
        }).catch(()=>null as any);

        if(!resolved?.ok){
            console.warn("No target:",resolved?.reason);
            return;
        }

        // parentIdを渡す → threadPairを取得
        const result=await chrome.tabs.sendMessage(tabId,{
            kind: "FORCE_RESPONSE_THREADPAIR",
            parentId: resolved.parentId,
            preIndex: resolved.preIndex,
        }).catch(()=>null as any);

        /*console.log("succsess: clickmenu");
        console.log(resolved.parentId);
        console.log("result",result);*/

        let plainText=info.selectionText;
        if(plainText===undefined){
            return;
        }
        
        this.lastPlainText=plainText;


    }

    private sendToNativeHost(message: any):Promise<any>{
        return new Promise((resolve,reject)=>{
            console.log("send message to native host: ",message);
            chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME,message,(res)=>{
                const err=chrome.runtime.lastError;
                if(err)return reject(err.message||String(err));
                console.log("succcess",res);
                resolve(res);
            });
        })
    }
}

export default GPTHandler;