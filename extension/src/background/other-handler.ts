import { 
    MENU_ID_OTER,
    COMMANDS,GenericEvent,
    Result,
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
        tab: chrome.tabs.Tab,
        repoPath: string
    ):Promise<Result>{
        return{
            ok: true,
            message: null,
        };
    }
}
