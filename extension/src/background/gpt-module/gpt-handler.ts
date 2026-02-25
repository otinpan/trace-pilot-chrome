import { 
    MENU_ID_GPT,
    NATIVE_HOST_NAME,
    COMMANDS,GenericEvent,
    MessageToNativeHost, 
    TRACE_PILOT_MARKER,
    RESPONSE_TYPE,
    PDFData,
    GPTData,
} from "../../type";
import { Handler } from "../handler";
import { GPTThread } from "../../content/gpt-module/gpt-thread";
import { writeClipboardViaContent} from "../pdf-module/pdf-handler";
import { CodeBlock,ThreadPair } from "../../content/gpt-module/gpt-thread";

type ClickInfoExt = chrome.contextMenus.OnClickData & { tabId?: number };



export class GPTHandler extends Handler{
    threads: Map<string,GPTThread> = new Map();
    activeThread: GPTThread | null=null;
    lastPlainText: string="";
    constructor(){
        super(MENU_ID_GPT);
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
    ):Promise<void>{
        const tabId=await this.getValidTabId(info,tab);
        if(tabId==null||tabId<0){
            console.error("no valide tabId",tabId);
            return;
        }
        const rawUrl=tab.url || "";
        if(tabId==null)return;
        if(!rawUrl){
            return;
        }

        // イベントが発火したことを通知 → parentIdの取得
        let resolved:any;
        try{
            resolved=await chrome.tabs.sendMessage(tabId,{
                kind:"RESOLVE_LAST_TARGET",
            }).catch(()=>null as any);
        }catch(e){
            console.warn("sendMessage RESOLVE_LAST_TARGET failed:", e);
            return;
        }
        

        if(!resolved?.ok){
            console.warn("No target:",resolved?.reason);
            return;
        }

        // parentIdを渡す → threadPairを取得
        let result:any;
        try{
            result=await chrome.tabs.sendMessage(tabId,{
                kind: "FORCE_RESPONSE_THREADPAIR",
                parentId: resolved.parentId,
                preIndex: resolved.preIndex,
            });
        }catch(e){
            console.warn("sendMessage FORCE_RESPONSE_THREADPAIR failed:", e);
            return;
        }
        
        if(!result){
            console.warn("FORCE_RESPONSE_THREADPAIR returned empty:", result);
            return;
        }

        console.log("succsess: clickmenu");
        console.log(resolved.parentId);
        console.log("result",result);

        // 改行を含めて保存
        const plainText= await getSelectionFromAnyFrame(tabId);
        if(!plainText.trim()){
            console.warn("selection is empty");
            return;
        }

        if(plainText===undefined){
            return;
        }
        
        this.lastPlainText=plainText;

        const threadPair=result.result;
        // codeBlockを文字列に直す
        const sanitized = {
            ...threadPair,
            codeBlocks: threadPair.codeBlocks.map((cb: CodeBlock) => {
                const { codeRef, ...rest } = cb;
                return rest;
            }),
        };


        const msg:MessageToNativeHost={
            type:RESPONSE_TYPE.CHAT_GPT,
            data: {thread_pair:sanitized},
            url: rawUrl,
            plain_text: plainText,
            repoPath: repoPath
        }



        console.log("message to native host: ",msg);
        let res=await this.sendToNativeHost(msg);
        const metaHash=res.metaHash;
        
         // クリップボードに貼る文字列
        const marker = `${TRACE_PILOT_MARKER} ${metaHash}`;
        const clipboardText = `${marker}\n${plainText}`;
        
        await writeClipboardViaContent(tab.id!, clipboardText);
    }

}

export async function getSelectionFromAnyFrame(tabId: number): Promise<string> {
    const results = await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        func: () => {
            const sel = window.getSelection?.();
            return {
                href: location.href,
                focused: document.hasFocus(),
                text: sel ? sel.toString() : "",
            };
        },
    });

    // 文字が取れたフレームを優先
    const hit = results
        .map(r => r.result as { href: string; focused: boolean; text: string })
        .find(r => (r.text ?? "").trim().length > 0);

    if (hit) return hit.text;

    // 取れなかった場合、デバッグ用にどのフレームが見えてたかログれる
    console.warn("No selection text in any frame:", results.map(r => r.result));
    return "";
}

export default GPTHandler;



