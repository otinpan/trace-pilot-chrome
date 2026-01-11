chrome.runtime.onInstalled.addListener(function(){
    chrome.contextMenus.create({
        type: "normal",
        title: "create hash and store with trace-pilot (PDF)",
        contexts: ["selection"],
        id: "create_hash_and_store_pdf",
    });
})


// messsageが到達したら=>の中身を実行
/*chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
    console.log("background received message:",message);
    console.log("==sender object==");
    console.log(sender);

    if(message.type=="PING"){
        sendResponse({type: "PONG"});
    }
    else if(message.type=="COPY_EVENT"){
        setTimeout(()=>{
            sendResponse({type: "COPY_RECORDED",text: message.text});
        },100);
        return true;
    }
});*/


const NATIVE_HOST_NAME="trace_pilot_host_chrome";

// native messagingでネイティブホストにメッセージを送る
// 返ってきたらonResponseを呼ぶ
function sendMessageToNativeHost(
    message:any,
    onResponse: (res:any) =>void,
    onError: (err: string) =>void
){
    chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME,message,(res)=>{
        const err=chrome.runtime.lastError;
        if(err){
            const msg=err.message || "Unknown native messaging error";
            if(onError){
                onError(msg);
            }else{
                console.error("Native messaging eror:",msg);
            }
            return;
        }

        onResponse(res);
    })
}


// chromeではpdfのコピーはフック出来ない
// ユーザーはctr+cでコピーした後にコンテキストメニューを使い保存する
function onClickHandler(
    info: chrome.contextMenus.OnClickData,
    tab?: chrome.tabs.Tab
){
    if(info.menuItemId!=="create_hash_and_store_pdf")return;

    chrome.tabs.query({active:true,currentWindow:true},(tabs)=>{
        const tab0=tabs[0];
        if(!tab0)return;


        const tabId=tab0.id;
        if(typeof tabId!=="number"){
            console.error("active tab has no id");
            return;
        }

        let url=tab0.url ?? "";
        if (!url) {
            console.error("active tab has no url:", tab0);
            return;
        }

        // 1) まず viewer.html?file=... を優先して抜く
    try {
      const u = new URL(url);
      const file = u.searchParams.get("file");
      if (file) {
        // searchParams.get は基本デコード済みなので、そのまま使う
        url = file;
      }
    } catch (e) {
      console.error("invalid tab url:", url, e);
      return;
    }

    // 2) http(s):// や file:/// で始まらない場合、PDF.jsビューワーのURL形式を考慮して抽出する
    if (!(url.startsWith("http://") || url.startsWith("https://") || url.startsWith("file:///"))) {
        const i =
            url.indexOf("/https://") !== -1 ? url.indexOf("/https://") :
            url.indexOf("/http://")  !== -1 ? url.indexOf("/http://")  :
            url.indexOf("/file:///") !== -1 ? url.indexOf("/file:///") :
            -1;

          if (i === -1) {
            console.error("unsupported viewer url:", tab0.url);
            return;
          }
          url = url.substring(i + 1);
        }

        let isPdf:boolean=false;
        if(url.includes("pdf")){
            isPdf=true;
        }

        console.log("resolved pdf url =", url);
        console.log(`is Pdf = ${isPdf}`);



        chrome.tabs.sendMessage(
            tabId,
            { type: "trace-pilot" },
            (res: TracePilotResponse | undefined) => {
              if (chrome.runtime.lastError) {
                console.error("sendMessage failed:", chrome.runtime.lastError.message);
                return;
              }
              if (!res) return;

              if ("error" in res) {
                console.error("trace-pilot error:", res.error);
                return;
              }

              const plainText = res.selectionText;

              // metadataに必要なものを送信する (fulltextはapp側でurlから再現する)
              // url
              // plane text
              sendURLAndPlainText(url,plainText,isPdf);
              console.log("received selection text:", plainText);
          }
        );
    });
}



function sendURLAndPlainText(url: string,plainText:string,isPdf:boolean){
    sendMessageToNativeHost(
        { 
          url,
          plainText,
          isPdf,
        },
        (res)=>{
          console.log("received from native:",res);
        },
        (err)=>{
          console.error("Failed to talk to native app:", err);
        }
    )
}



// クリックイベントに登録
chrome.contextMenus.onClicked.addListener(onClickHandler);

