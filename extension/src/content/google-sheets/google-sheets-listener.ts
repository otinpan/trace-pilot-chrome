import { GoogleSheetsThread } from "./google-sheets-thread";

export class GoogleSheetsListener{
  thread: Map<string,GoogleSheetsThread> = new Map();
  activeThread: GoogleSheetsThread | null=null;
  constructor(){
    this.init();
  }

  init(){
    this.listen();
  }

  listen(){
    // TODO: hadlerからのメッセージを受信
  }
}
