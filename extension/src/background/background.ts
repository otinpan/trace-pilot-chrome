import GenericListener from "./generic-listener";
import { PdfHandler } from "./pdf-handler";

const pdfHandler = new PdfHandler();
new GenericListener((ev) => pdfHandler.onGenericEvent(ev));


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


