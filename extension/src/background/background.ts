import GenericListener from "./generic-listener";
import GPTHandler from "./gpt-module/gpt-handler";
import { OtherHandler } from "./other-handler";
import { PdfHandler } from "./pdf-module/pdf-handler";
import { MenuManager } from "./menu-manager";
import { GoogleSheetsHandler } from "./google-sheets-module/google-sheets-handler";
import { StaticHandler } from "./static-module/static-handler";
import { MENU_ID_GPT,MENU_ID_OTER,MENU_ID_PDF } from "../type";

const genericListener = new GenericListener();

const pdfHandler = new PdfHandler();
genericListener.addHandler((ev) => pdfHandler.onGenericEvent(ev));

const gptHandler = new GPTHandler();
genericListener.addHandler((ev) => gptHandler.onGenericEvent(ev));

const otherHandler=new OtherHandler();
genericListener.addHandler((ev)=>otherHandler.onGenericEvent(ev));

const googleSheetsHandler=new GoogleSheetsHandler();
genericListener.addHandler((ev)=>googleSheetsHandler.onGenericEvent(ev));

const staticHandler=new StaticHandler();
genericListener.addHandler((ev)=>staticHandler.onGenericEvent(ev));

const menuManager=new MenuManager(
    pdfHandler,
    gptHandler,
    staticHandler,
    googleSheetsHandler
);


chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && typeof msg === "object" && (msg as any).type === "PING") {
      sendResponse({ ok: true, from: "background" });
      console.log("first message is sccessed!");
      return; // sync reply
    }

    if(msg && typeof msg === "object" && (msg as any).kind === "GOOGLE_SHEETS_CELLDATAS"){
      (async () => {
        const response = await googleSheetsHandler.handleContentMessage(
          msg as any,
          sender.tab?.id ?? null,
        );
        googleSheetsHandler.showResult(response);
        sendResponse(response);
      })();
      return true;
    }
});



