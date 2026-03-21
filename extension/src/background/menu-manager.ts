import { 
    MENU_ID_GPT,
    MENU_ID_PDF,
    MENU_ID_STATIC,
    NATIVE_HOST_NAME,
    RESPONSE_TYPE,
    GetGitRepoMessage,
    GetGitRepoResponse,
    MENU_ID_GOOGLE_SHEETS
} from "../type";
import GPTHandler from "./gpt-module/gpt-handler";
import { OtherHandler } from "./other-handler";
import { PdfHandler } from "./pdf-module/pdf-handler";
import { GoogleSheetsHandler } from "./google-sheets-module/google-sheets-handler";
const CHILD_PREFIX_PDF="tp:repo:pdf:";
const CHILD_PREFIX_GPT="tp:repo:gpt:";
const CHILD_PREFIX_STATIC="tp:repo:static:"
const CHILD_PREFIX_GOOGLESHEETS="tp:repo:googlesheets:";

export class MenuManager{
    constructor(
        private readonly pdfHandler
            :{handleRepoClick
                :(info:chrome.contextMenus.OnClickData,
                    tab:chrome.tabs.Tab,repoPath:string)=>Promise<void>},
        private readonly gptHandler
             :{handleRepoClick
                :(info:chrome.contextMenus.OnClickData,
                    tab:chrome.tabs.Tab,repoPath:string)=>Promise<void>},
        private readonly staticHandler
             :{handleRepoClick
                :(info:chrome.contextMenus.OnClickData,
                    tab:chrome.tabs.Tab,repoPath:string)=>Promise<void>},
        private readonly googleSheetsHandler
              :{handleRepoClick
                :(info:chrome.contextMenus.OnClickData,
                 tab:chrome.tabs.Tab,repoPath:string)=>Promise<void>},
    ){
        this.init();
        this.listenClicks();
        this.listenGoogleSheetsTabs();
        void this.refreshReposAndMenus();
    }

    private cachedRepos: string[]=[];

    init(){
        // Menuを作成
        // If an extension adds more than one context menu item, 
        // Chrome automatically creates a parent menu with the extension's name.
        chrome.runtime.onInstalled.addListener(()=>{
            chrome.contextMenus.create({
                type: "normal",
                title: "create hash and store with trace-pilot (PDF)",
                contexts: ["selection","page"],
                id: MENU_ID_PDF,
                enabled: false
            });
            chrome.contextMenus.create({
                type: "normal",
                title: "create hash and store with trace-pilot (GPT)",
                contexts: ["selection","page"],
                id: MENU_ID_GPT,
                enabled: false
            });
            chrome.contextMenus.create({
                type: "normal",
                title: "create hash and store with trace-pilot (Static)",
                contexts: ["selection","page"],
                id: MENU_ID_STATIC,
                enabled: false
            });
            /*
            chrome.contextMenus.create({
              type: "normal",
              title: "create hash and store with trace-pilot (GoogleSpreadSheets)",
              contexts: ["selection","page"],
              id: MENU_ID_GOOGLE_SHEETS,
              enabled: false
            })
            */
        });
    }

    private listenGoogleSheetsTabs(){
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if(changeInfo.status !== "complete") return;

            const url = tab.url ?? "";
            if(!url.startsWith("https://docs.google.com/spreadsheets/")) return;

            void this.sendReposToGoogleSheetsTab(tabId, this.cachedRepos);
        });
    }

    private async refreshReposAndMenus(){
        const repos=await this.getGitRepos();
        this.cachedRepos=repos;
        await this.sendReposToGoogleSheetsTabs(repos);
        await this.rebuildMenus(repos);
    }

    private async sendReposToGoogleSheetsTabs(repos: string[]):Promise<void>{
        const tabs = await chrome.tabs.query({
            url: ["https://docs.google.com/spreadsheets/*"],
        });

        await Promise.all(
            tabs
                .filter((tab): tab is chrome.tabs.Tab & { id: number } => typeof tab.id === "number")
                .map((tab) => this.sendReposToGoogleSheetsTab(tab.id, repos))
        );
    }

    private async sendReposToGoogleSheetsTab(tabId: number, repos: string[]):Promise<void>{
        try{
            await chrome.tabs.sendMessage(tabId, {
                kind: "GOOGLE_SHEETS_REPOS_UPDATED",
                repos,
            });
        }catch{
            return;
        }
    }

    private async getGitRepos():Promise<string[]>{
        const msg:GetGitRepoMessage={
            type: RESPONSE_TYPE.GET_GIT,
            data: null,
        };

        let res=await this.sendToNativeHost(msg) as GetGitRepoResponse;
        console.log("repositories: ",res);

        return res.git_repo;
    }

    async sendToNativeHost(message:any):Promise<any>{
        return new Promise((resolve,reject)=>{
            console.log("send message to native host (git): ",message);
            chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME,message,(res)=>{
                const err=chrome.runtime.lastError;
                if(err)return reject(err.message||String(err));
                console.log("success",res);
                resolve(res);
            });
        })
    }

    private async rebuildMenus(repos: string[]){
        await new Promise<void>((resolve)=>{
            chrome.contextMenus.removeAll(()=>resolve());
        })

        const filtered = repos.filter(r => !r.endsWith(".trace-worktree"));


        chrome.contextMenus.create({
            type: "normal",
            title: "create hash and store with trace-pilot (PDF)",
            contexts: ["selection","page"],
            id: MENU_ID_PDF,
            enabled: repos.length>0,
        });

        chrome.contextMenus.create({
            type: "normal",
            title: "create hash and store with trace-pilot (GPT)",
            contexts: ["selection","page"],
            id: MENU_ID_GPT,
            enabled: filtered.length>0,
        });

        chrome.contextMenus.create({
            type: "normal",
            title: "create hash and store with trace-pilot (Static)",
            contexts: ["selection","page"],
            id: MENU_ID_STATIC,
            enabled: filtered.length>0,
        });

        /*
        chrome.contextMenus.create({
          type: "normal",
          title: "create hash and store with trace-pilot (GoogleSpreadSheets)",
          contexts: ["selection","page"],
          id: MENU_ID_GOOGLE_SHEETS,
          enabled: filtered.length>0,
        });
        */

        // pdf
        for (const repo of filtered){
            chrome.contextMenus.create({
                parentId: MENU_ID_PDF,
                id: makeChildIdPdf(repo),
                title:repo,
                contexts: ["selection","page"],
                enabled: true,
            });
        }

        // gpt
        for (const repo of filtered){
            chrome.contextMenus.create({
                parentId: MENU_ID_GPT,
                id: makeChildIdGpt(repo),
                title:repo,
                contexts: ["selection","page"],
                enabled: true,
            });
        }

        // static
        for (const repo of filtered){
            chrome.contextMenus.create({
                parentId: MENU_ID_STATIC,
                id: makeChildIdStatic(repo),
                title:repo,
                contexts: ["selection","page"],
                enabled: true,
            });
        }

        // google spread sheets
        /*
        for (const repo of filtered){
          chrome.contextMenus.create({
            parentId: MENU_ID_GOOGLE_SHEETS,
            id: makeChildIdGoogleSheets(repo),
            title: repo,
            contexts: ["selection","page"],
            enabled: true,
          });
        }
        */
    }

    private listenClicks(){
        chrome.contextMenus.onClicked.addListener(async (info,tab)=>{
            if(!tab || typeof tab.id!=="number"){
                console.error("Menu clicked but tab is missing:", info);
                return;
            }


            const menuId=String(info.menuItemId);

            // 親は何もしない
            if(
                menuId===MENU_ID_PDF ||
                menuId===MENU_ID_GPT ||
                menuId===MENU_ID_STATIC ||
                menuId===MENU_ID_GOOGLE_SHEETS
            ) return;

            // 子 pdf
            if(menuId.startsWith(CHILD_PREFIX_PDF)){
                const repo=decodedRepoId(menuId.slice(CHILD_PREFIX_PDF.length));
                await this.pdfHandler.handleRepoClick(info,tab,repo);
                return;
            }

            // 子 gpt
            if(menuId.startsWith(CHILD_PREFIX_GPT)){
                const repo=decodedRepoId(menuId.slice(CHILD_PREFIX_GPT.length));
                await this.gptHandler.handleRepoClick(info,tab,repo);
                return;
            }

            // 子 static
            if(menuId.startsWith(CHILD_PREFIX_STATIC)){
                const repo=decodedRepoId(menuId.slice(CHILD_PREFIX_STATIC.length));
                await this.staticHandler.handleRepoClick(info,tab,repo);
                return;
            }

            // 子 googlesheets
            /*
            if(menuId.startsWith(CHILD_PREFIX_GOOGLESHEETS)){
              const repo=decodedRepoId(menuId.slice(CHILD_PREFIX_GOOGLESHEETS.length));
              await this.googleSheetsHandler.handleRepoClick(info,tab,repo);
              return;
            }
            */

        })
    }

}

function encodedRepoId(repoPath: string){
        return encodeURIComponent(repoPath);
    }

function decodedRepoId(encoded: string){
    return decodeURIComponent(encoded);
}

function makeChildIdPdf(repoPath:string){
    return CHILD_PREFIX_PDF+encodedRepoId(repoPath);
}

function makeChildIdGpt(repoPath:string){
    return CHILD_PREFIX_GPT+encodedRepoId(repoPath);
}

function makeChildIdStatic(repoPath:string){
    return CHILD_PREFIX_STATIC+encodedRepoId(repoPath);
}

function makeChildIdGoogleSheets(repoPath:string){
  return CHILD_PREFIX_GOOGLESHEETS+encodedRepoId(repoPath);
}
