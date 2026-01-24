import GenericListener from "./generic-listener";
import GPTHandler from "./gpt-module/gpt-handler";
import { OtherHandler } from "./other-handler";
import { PdfHandler } from "./pdf-module/pdf-handler";
import { MENU_ID_GPT,MENU_ID_OTER,MENU_ID_PDF } from "../type";

const genericListener = new GenericListener();

const pdfHandler = new PdfHandler();
genericListener.addHandler((ev) => pdfHandler.onGenericEvent(ev));

const gptHandler = new GPTHandler();
genericListener.addHandler((ev) => gptHandler.onGenericEvent(ev));

const otherHandler=new OtherHandler();
genericListener.addHandler((ev)=>otherHandler.onGenericEvent(ev));




chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && typeof msg === "object" && (msg as any).type === "PING") {
      sendResponse({ ok: true, from: "background" });
      console.log("first message is sccessed!");
      return; // sync reply
    }
});

chrome.runtime.onInstalled.addListener(()=>{
    chrome.contextMenus.create({
        type: "normal",
        title: "create hash and store with trace-pilot (PDF)",
        contexts: ["selection","page"],
        id: MENU_ID_PDF,
        enabled: false
    });
    chrome.contextMenus.create({
        type: "normal",
        title: "create hash and store with trace-pilot (GPT)",
        contexts: ["selection","page"],
        id: MENU_ID_GPT,
        enabled: false
    });
});


