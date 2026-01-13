export abstract class Handler{
    private installed=false;
    constructor(
        protected readonly menuId: string,
    ){
        this.init();
    }

    init(){
        if(this.installed)return;
        this.installed=true;

        chrome.contextMenus.onClicked.addListener(this.onClick);
    }

    // 拡張機能で作成した右クリックメニューを有効・無効
    protected setEnabled(enabled: boolean) {
        chrome.contextMenus.update(this.menuId, { enabled }, () => void chrome.runtime.lastError);
    }

    private onClick=(
        info: chrome.contextMenus.OnClickData,
        tab?:chrome.tabs.Tab
    )=>{
        if(info.menuItemId !== this.menuId) return;

        if(!tab||typeof tab.id!=="number"){
            this.onClickMissingTab(info,tab);
            return;
        }
        void this.onMenuClick(info,tab);
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