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



        chrome.contextMenus.onClicked.addListener(async(info,tab)=>{
            const menuId=String(info.menuItemId);

            const h=Handler.registry.get(menuId);
            if(!h)return;

            if(!tab||typeof tab.id!=="number"){
                h.onClickMissingTab(info,tab);
                return;
            }

            await h.onMenuClick(info,tab);
        });
    }

    // 拡張機能で作成した右クリックメニューを有効・無効
    protected setEnabled(enabled: boolean) {
        chrome.contextMenus.update(this.menuId, { enabled }, () => void chrome.runtime.lastError);
    }

    // クリックされたときの
    protected abstract onMenuClick(
        info: chrome.contextMenus.OnClickData,
        tab: chrome.tabs.Tab
    ):Promise<void>|void;

    protected onClickMissingTab(
        info: chrome.contextMenus.OnClickData,
        tab?: chrome.tabs.Tab
    ){
        console.error("Menu clicked but tab is missing:", info);
    }

}