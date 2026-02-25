import { ThreadPair } from "./content/gpt-module/gpt-thread";

// marker
export const TRACE_PILOT_MARKER:string="// @trace-pilot";

// content script に問い合わせ（レスポンス型を付ける）
export type TracePilotResponse = { selectionText: string } | { error: string };

export const MENU_ID_PDF="create_hash_and_store_PDF";
export const MENU_ID_GPT="create_hash_and_store_GPT";
export const MENU_ID_OTER="create_hash_and_store_OTHER";
export const MENU_ID_STATIC="create_hash_and_store_STATIC";

export const NATIVE_HOST_NAME="trace_pilot_host_chrome";

export type TracePilotRequest={
    type: "trace-pilot";
}

export enum COMMANDS {
  GOOGLE_OPEN = 'googleOpen',
  STACKOVERFLOW_OPEN = 'stackoverflowOpen',
  GITHUB_OPEN = 'githubOpen',
  GPT_OPEN = 'chatOpen',
  OTHER_OPEN = 'otherOpen',
  GOOGLE_SEARCH = 'googleSearch',
  PDF_OPEN='pdfOpen',
  STATIC_OPEN='staticOpen',
}



export type GenericEvent={
    command: COMMANDS;
    tabId: number;
    url: string;
    title?: string;
}


export enum RESPONSE_TYPE{
    CHAT_GPT="CHAT_GPT",
    CHROME_PDF="CHROME_PDF",
    OTHER="OTHER",
    CHROME_STATIC="CHROME_STATIC",
    GET_GIT="GET_GIT",
}

export interface GetGitRepoMessage{
  type: RESPONSE_TYPE.GET_GIT;
  data: null;
}

export interface GetGitRepoResponse{
  ok:true;
  git_repo: string[];
}

export interface MetaHashMessage{
    meta_hash:string;
}


export type MessageToNativeHost =
  | ChromePdfMessage
  | ChatGptMessage
  | OtherMessage
  | ChromeStaticMessage


interface BaseMessage {
  url: string;
  plain_text: string;
  repoPath: string;
}

export interface ChromePdfMessage extends BaseMessage {
  type: RESPONSE_TYPE.CHROME_PDF;
  data: PDFData;
}

export interface ChromeStaticMessage extends BaseMessage{
  type: RESPONSE_TYPE.CHROME_STATIC;
  data: StaticData;
}

export interface ChatGptMessage extends BaseMessage {
  type: RESPONSE_TYPE.CHAT_GPT;
  data: GPTData;
}

export interface OtherMessage extends BaseMessage {
  type: RESPONSE_TYPE.OTHER;
  data: null;
}


export interface PDFData{

}

export interface GPTData{
    thread_pair: ThreadPair,
}

export interface StaticData{
  mhtml_base64: string,
  encoding: "base64",
  title?: string,
}
