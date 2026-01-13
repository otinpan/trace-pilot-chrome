import GenericListener from "./generic-listener";
import { PdfHandler } from "./pdf-handler";

new GenericListener();
new PdfHandler();

chrome.runtime.onInstalled.addListener(()=>{
    chrome.contextMenus.create({
        type: "normal",
        title: "create hash and store with trace-pilot",
        contexts: ["selection","page"],
        id: "create_hash_and_store",
        enabled: false
    });
});