import{
    NATIVE_HOST_NAME,
    MessageToNativeHost,
    GetGitRepoMessage,
    GetGitRepoResponse,
    RESPONSE_TYPE,
} from "../type";
export abstract class Handler{
    private static installed=false;
    private static registry=new Map<string,Handler>();
    constructor(
        protected readonly menuId: string,
    ){
        Handler.registry.set(menuId,this);
        this.init();
    }

    init(){
        if(Handler.installed)return;
        Handler.installed=true;

    }

    protected async sendToNativeHost(message:any):Promise<any>{
        return new Promise((resolve,reject)=>{
            console.log("send message to native host (git): ",message);
            chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME,message,(res)=>{
                const err=chrome.runtime.lastError;
                if(err)return reject(err.message||String(err));
                console.log("success",res);
                resolve(res);
            });
        })
    }

    // 拡張機能で作成した右クリックメニューを有効・無効
    protected setEnabled(enabled: boolean) {
        chrome.contextMenus.update(this.menuId, { enabled }, () => void chrome.runtime.lastError);
    }

    // クリックされたときの
    protected abstract onMenuClick(
        info: chrome.contextMenus.OnClickData,
        tab: chrome.tabs.Tab,
        repoPath:string
    ):Promise<void>|void;

    protected onClickMissingTab(
        info: chrome.contextMenus.OnClickData,
        tab?: chrome.tabs.Tab
    ){
        console.error("Menu clicked but tab is missing:", info);
    }

}