import { TracePilotResponse } from "../type";
import { GPTListener } from "./gpt-module/gpt-listener";

const gptListener=new GPTListener();

chrome.runtime.sendMessage(
    {type:"PING"},
    (response)=>{
        console.log("response from background:",response);
    }
)

function getSelectedText(): string {
  const active = document.activeElement as (HTMLInputElement | HTMLTextAreaElement | null);

  // input / textarea の選択範囲
  if (active && (active.tagName === "TEXTAREA" || (active.tagName === "INPUT" && active.type === "text"))) {
    const start = active.selectionStart ?? 0;
    const end = active.selectionEnd ?? 0;
    return active.value.substring(start, end);
  }

  // 通常ページの選択
  return window.getSelection()?.toString() ?? "";
}


chrome.runtime.onMessage.addListener(
    (
        request: unknown,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response: TracePilotResponse)=> void
    ): true|void=>{
        if(
            typeof request!=="object"||
            request===null||
            !("type" in request)||
            (request as any).type!=="trace-pilot"
        ){
            return;
        }

        (async()=>{
            try{
                const st=await navigator.clipboard.readText();
                sendResponse({selectionText:st});
            }catch(e){
                sendResponse({error: String(e)});
            }
        })();

        return true;
    }
)


// 選択した範囲を開業を含めて返す
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.kind !== "TRACE_PILOT_GET_SELECTION_WITH_BREAKES") return;

    try {
        const sel = window.getSelection?.();
        const text = sel ? sel.toString() : "";
        console.log("text",text);
        sendResponse({ ok: true, text });
    } catch (e: any) {
        sendResponse({ ok: false, error: String(e?.message ?? e) });
    }

    return true;
});







async function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

async function waitForReady(timeoutMs = 1200): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (document.hasFocus() && document.visibilityState === "visible") return true;
    await sleep(30);
  }
  return document.hasFocus() && document.visibilityState === "visible";
}

async function writeClipboardWithRetry(text: string, tries = 6) {
  let lastErr: any = null;
  for (let i = 0; i < tries; i++) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (e) {
      lastErr = e;
      await sleep(80); // 少し待って再挑戦
    }
  }
  throw lastErr;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.kind !== "TRACE_PILOT_WRITE_CLIPBOARD") return;

  (async () => {
    const ready = await waitForReady(1500);
    try {
      await writeClipboardWithRetry(msg.text, 8);
      sendResponse({ ok: true, ready });
    } catch (e: any) {
      sendResponse({ ok: false, error: String(e?.message ?? e), ready });
    }
  })();

  return true;
});


