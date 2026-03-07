export interface ThreadSelectors{
  container: string;
}
export const defaultSelectors: ThreadSelectors={
  container: "",
}
export class GoogleSheetsThread{
  
  constructor(
    readonly id:string,
    readonly title:string,
    private selectors: ThreadSelectors=defaultSelectors,
  ){
    this.init();
  }

  init(){
    this.initPageObserver();
    this.initListener();
  }

  private getThreadContainer():HTMLElement | null{
    return document.querySelector(this.selectors.container) as HTMLElement | null;
  }

  initListener(){

  }

  initPageObserver(){
    const targetNode=this.getThreadContainer();
    if(!targetNode){
      setTimeout(()=>this.initPageObserver(),5000);
      return;
    }

    // TODO: 初期化
  }

  // TODO: メッセージ作成
}
