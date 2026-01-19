import { GenericEvent } from "../type";
import { COMMANDS } from "../type";

type GenericEventHandler = (ev: GenericEvent) => void;

export class GenericListener{
    private handlers : Set<GenericEventHandler> = new Set();
    constructor(onEvent?: GenericEventHandler){
        if(onEvent)this.handlers.add(onEvent);
        this.init();
    }

    init(){
        this.listen();
    }

    addHandler(handler:GenericEventHandler):()=>void{
        this.handlers.add(handler);
        return ()=>this.removeHandler(handler);
    }

    removeHandler(handler:GenericEventHandler):void{
        this.handlers.delete(handler);
    }

    private emit(ev:GenericEvent):void{
        for(const h of this.handlers){
            try{
                h(ev);
            }catch(e){
                console.error("GenericListener handelr error:",e,"event",ev);
            }
        }
    }
    listen() {
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            const url = tab.url;
            if (!url || changeInfo.status !== "complete") return;
            
            const isPdf=isLikelyPdfUrl(url);
          
            let command: COMMANDS = COMMANDS.OTHER_OPEN;
          
            if (isPdf) {
                command = COMMANDS.PDF_OPEN;
            } else if (url.includes("chatgpt.com")) {
                command = COMMANDS.GPT_OPEN;
            } else if (url.startsWith("https://www.google.com/")) {
                command = COMMANDS.GOOGLE_OPEN;
            } else if (url.startsWith("https://stackoverflow.com")) {
                command = COMMANDS.STACKOVERFLOW_OPEN;
            } else if (url.startsWith("https://github.com")) {
                command = COMMANDS.GITHUB_OPEN;
            }

            this.emit({ command, tabId, url, title: tab.title });
            
        });
    }       

}

function isLikelyPdfUrl(raw:string):boolean{
    try{
        const u=new URL(raw);
        const path=u.pathname.toLowerCase();

        if(path.endsWith(".pdf")) return true;

        // ACM
        if(path.includes("/epdf/"))return true;

        // pdf.js
        const file=u.searchParams.get("file");
        if(file&&file.toLowerCase().includes(".pdf")) return true;

        return false;
    }catch{
        return false;
    }
}

export default GenericListener;