import { MENU_ID_OTER, COMMANDS, } from "../type";
import { Handler } from "./handler";
// 指定していないurlが開かれたらsetEnable(false)にする
export class OtherHandler extends Handler {
    constructor() {
        super(MENU_ID_OTER);
    }
    onGenericEvent(ev) {
        if (ev.command === COMMANDS.OTHER_OPEN && ev.url) {
            this.setEnabled(false);
        }
    }
    async onMenuClick(info, tab) {
        return;
    }
}
