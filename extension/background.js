chrome.runtime.onInstalled.addListener(function(){
    chrome.contextMenus.create({
        type: "normal",
        title: "Copy wit trace pilot (PDF)",
        contexts: ["selection"],
        id: "copy_with_trace_pilot_pdf",
    });
})

chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
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
});

// chromeではpdfのコピーはフック出来ない
// ユーザーはctr+cでコピーした後にコンテキストメニューを使い保存する
function onClickHandler(info,tab){
    if(info.menuItemId!="copy_with_trace_pilot_pdf"){
        return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab0 = tabs[0];
        let url = tab0.url || "";

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
    
        console.log("resolved pdf url =", url);
    
        chrome.tabs.sendMessage(tab0.id, { type: "trace-pilot" }, (res) => {
          if (chrome.runtime.lastError) {
            console.error("sendMessage failed:", chrome.runtime.lastError.message);
            return;
          }
          if (!res) return;
      
          let planeText = res.selectionText;
          console.log("received selection text:", planeText);
        });
    });
}


async function getPdfAsBuffer(url){

}



chrome.contextMenus.onClicked.addListener(onClickHandler);