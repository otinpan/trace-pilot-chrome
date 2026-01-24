import { 
    MENU_ID_OTER,
    NATIVE_HOST_NAME,
    COMMANDS,GenericEvent,
    MessageToNativeHost, 
    TRACE_PILOT_MARKER,
    RESPONSE_TYPE,
    PDFData,
    GPTData,
} from "../type";
import { Handler } from "./handler";


// 指定していないurlが開かれたらsetEnable(false)にする
export class OtherHandler extends Handler{
    constructor(){
        super(MENU_ID_OTER);
    }

    public onGenericEvent(ev: GenericEvent){
        if(ev.command===COMMANDS.OTHER_OPEN&&ev.url){
            this.setEnabled(false);
        }
    }

    protected override async onMenuClick(
        info: chrome.contextMenus.OnClickData,
        tab: chrome.tabs.Tab
    ):Promise<void>{
        return;
    }
}