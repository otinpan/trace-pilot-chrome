import { GoogleSheetsThread } from "./google-sheets-thread";

export class GoogleSheetsListener{
  thread: Map<string,GoogleSheetsThread> = new Map();
  activeThread: GoogleSheetsThread | null=null;
  pendingRepos: string[] = [];
  constructor(){
    this.init();
  }

  init(){
    this.listen();
  }

  listen(){
    if(this.isGoogleSheetsPage()){
      this.ensureActiveThread(window.location.href, document.title);
    }

    chrome.runtime.onMessage.addListener((request) => {
      if(!request || typeof request !== "object") return;
      if((request as any).kind === "GOOGLE_SHEETS_REPOS_UPDATED"){
        const repos = Array.isArray((request as any).repos)
          ? (request as any).repos.filter((repo: unknown): repo is string => typeof repo === "string")
          : [];
        this.pendingRepos = repos;
        this.activeThread?.setRepos(repos);
        return;
      }

      if((request as any).kind !== "GOOGLE_SHEETS_START_OBSERVE") return;

      const url = typeof (request as any).url === "string"
        ? (request as any).url
        : window.location.href;
      const title = typeof (request as any).title === "string"
        ? (request as any).title
        : document.title;

      this.ensureActiveThread(url, title);
    });
  }

  private ensureActiveThread(url: string, title: string){
    if(!this.isGoogleSheetsUrl(url)) return;

    const key = this.normalizeThreadKey(url);
    const existing = this.thread.get(key);

    if(existing){
      this.activeThread = existing;
      existing.initPageObserver();
      if(this.pendingRepos.length > 0){
        existing.setRepos(this.pendingRepos);
      }
      return;
    }

    const newThread = new GoogleSheetsThread(key, title);
    if(this.pendingRepos.length > 0){
      newThread.setRepos(this.pendingRepos);
    }
    this.thread.set(key, newThread);
    this.activeThread = newThread;
  }

  private normalizeThreadKey(rawUrl: string){
    try{
      const url = new URL(rawUrl);
      return `${url.origin}${url.pathname}`;
    }catch{
      return rawUrl;
    }
  }

  private isGoogleSheetsPage(){
    return this.isGoogleSheetsUrl(window.location.href);
  }

  private isGoogleSheetsUrl(url: string){
    return url.startsWith("https://docs.google.com/spreadsheets/");
  }
}
