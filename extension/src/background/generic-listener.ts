export enum COMMANDS {
  GOOGLE_OPEN = 'googleOpen',
  STACKOVERFLOW_OPEN = 'stackoverflowOpen',
  GITHUB_OPEN = 'githubOpen',
  CHAT_OPEN = 'chatOpen',
  OTHER_OPEN = 'otherOpen',
  GOOGLE_SEARCH = 'googleSearch',
  PDF_OPEN='pdfOpen'
}



class GenericListener{
    constructor(){
        this.init();
    }

    init(){
        this.listen();
    }

    listen() {
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            const url = tab.url;
            if (!url || changeInfo.status !== "complete") return;
            
            
            const isPdf=isLikelyPdfUrl(url);
          
            let command: COMMANDS = COMMANDS.OTHER_OPEN;
          
            if (isPdf) {
                command = COMMANDS.PDF_OPEN;
            } else if (url.includes("chatgpt.com")) {
                command = COMMANDS.CHAT_OPEN;
            } else if (url.startsWith("https://www.google.com/")) {
                command = COMMANDS.GOOGLE_OPEN;
            } else if (url.startsWith("https://stackoverflow.com")) {
                command = COMMANDS.STACKOVERFLOW_OPEN;
            } else if (url.startsWith("https://github.com")) {
                command = COMMANDS.GITHUB_OPEN;
            }
          
            chrome.tabs.sendMessage(tabId, {
                command,
                payload: { url, title: tab.title },
            });
        });
    }       

}

function isLikelyPdfUrl(raw:string):boolean{
    try{
        const u=new URL(raw);
        const path=u.pathname.toLowerCase();

        if(path.endsWith(".pdf")) return true;

        // ACM
        if(path.includes("/epdf/"))return true;

        // pdf.js
        const file=u.searchParams.get("file");
        if(file&&file.toLowerCase().includes(".pdf")) return true;

        return false;
    }catch{
        return false;
    }
}

export default GenericListener;