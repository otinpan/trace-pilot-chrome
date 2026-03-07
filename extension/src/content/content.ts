import { TracePilotResponse } from "../type";
import { GPTListener } from "./gpt-module/gpt-listener";
import { GoogleSheetsListener } from "./google-sheets/google-sheets-listener";
const gptListener=new GPTListener();
const googleSheetsListener=new GoogleSheetsListener();
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



/*
@param {Object.<string,{text:string}|{blob:Blob}>} write_data 
 * クリップボードへ書き込むデータ\
 * keyに「text/plain」「image/png」等のデータタイプ(MIMEタイプ)を指定、\
 * valueに書き込むデータとして、"text"か"blob"を指定する
 * @returns clipboardの「write」結果(Promise<void>)
 */
async function writeClipbpard(write_data:Object){
    // まずは[key,blob]のturple配列に変換
    const clipboard_entries = Object.entries(write_data).map(([key,value])=>{
        if(value["text"]){    // "text"が渡ってきたら自前でBlobを作る
            const blob=new Blob([value["text"]],{type:key})
            return [key,blob]
        }
        else if(value["blob"]){ // "blob"が来たらBlobが入ってると見なしてそのまま
            return [key,value["blob"]]
        }
        else{     // それ以外が来たら一応空文字をセットしておく
            return [key,""]
        }
    })

    // 上のturple配列をオブジェクトにしつつ、ClipboardItemを作る
    const clipboard_item = [new ClipboardItem(Object.fromEntries(clipboard_entries))]

    // clipboardにwriteする
    return navigator.clipboard.write(clipboard_item)
}



// Ctrl + cでclipboardのデータを表示する
function viewClipboardData(event: ClipboardEvent){
  const clipboardData=event.clipboardData;
  if(!clipboardData){
    console.log("clipboardData is empty");
    return;
  }

  console.log("clipboard data");
  console.log("types:", Array.from(clipboardData.types));


  if(clipboardData.items){
    for(let i=0;i<clipboardData.items.length;i++){
      const item=clipboardData.items[i];
      const kind=item.kind;
      const type=item.type;
      if(item.kind==="string"){
        item.getAsString((s: string)=>{
          console.log(`kind = ${kind}, type = ${type}, string = ${s}`);
        })
      }else if(item.kind==="file"){
        const f=item.getAsFile();
        if(!f) continue;

        const url=window.URL.createObjectURL(f);
        console.log(`kind = ${kind}, type = ${type}, url = ${url}`);

        window.URL.revokeObjectURL(url);
      }
    }
  }
}

let isCtrlCPressed=false;

window.addEventListener("keydown",(event: KeyboardEvent)=>{
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="c"){
    isCtrlCPressed=true;
  }
});

window.addEventListener("keyup",(event: KeyboardEvent)=>{
  if(event.key.toLowerCase()==="c"||event.key==="Control"||event.key==="Meta"){
    isCtrlCPressed=false;
  }
});

window.addEventListener("blur",()=>{
  isCtrlCPressed=false;
});

window.addEventListener("copy",(event: ClipboardEvent)=>{
  if(!isCtrlCPressed) return;
  viewClipboardData(event);
  isCtrlCPressed=false;
});
