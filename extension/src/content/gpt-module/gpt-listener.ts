import { GPTThread } from "./gpt-thread";

export class GPTListener{
    threads:Map<string,GPTThread> = new Map();
    activeThread: GPTThread | null=null;
    constructor(){
        this.init();
    }

    init(){
        this.listen();
    }

    listen(){
        chrome.runtime.onMessage.addListener((request,sender,sendResponse)=>{
            if(!request||typeof request !=="object")return;
            if((request as any).kind!=="GPT_START_OBSERVE")return;
            console.log("start gpt thread");
            const url=request.url;
            const title=request.title;

            if(!this.threads.has(url)){
                console.log("create new thread url=",url);
                const newThread=new GPTThread(url,title);
                this.threads.set(url,newThread);
                this.activeThread=newThread;
            }else{
                const thread=this.threads.get(url);
                console.log("use thread: url=",url);
                if(thread){
                    this.activeThread?.destroyPageObserver();
                    thread.initPageObserver();
                    this.activeThread=thread;
                }
            }
            console.log("thread num: ",this.threads.size);
            console.log(this.threads);    
        });
    }
}