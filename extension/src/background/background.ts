import GenericListener from "./generic-listener";
import GPTHandler from "./gpt-module/gpt-handler";
import { OtherHandler } from "./other-handler";
import { PdfHandler } from "./pdf-module/pdf-handler";

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
        title: "create hash and store with trace-pilot",
        contexts: ["selection","page"],
        id: "create_hash_and_store",
        enabled: false
    });
});


