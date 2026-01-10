
chrome.runtime.sendMessage(
    {type:"PING"},
    (response)=>{
        console.log("response from background:",response);
    }
)

document.addEventListener("copy",()=>{
    chrome.runtime.sendMessage(
        {
            type: "COPY_EVENT",
            text: window.getSelection().toString()
        },
        (response)=>{
            console.log("copy event reported to background",response);
        }
    );
});


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!request || request.type !== "trace-pilot") return;

    (async () => {
      try {
        const st = await navigator.clipboard.readText();
        sendResponse({ selectionText: st });
      } catch (e) {
        sendResponse({ error: String(e) });
      }
    })();

    return true; 
});


/*
sendMessage(
  message  ───────────▶  request
                             │
                             │  sendResponse(value)
                             ▼
callback(res)  ◀─────────── value
*/