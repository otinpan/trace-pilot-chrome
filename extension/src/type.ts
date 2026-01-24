import { ThreadPair } from "./content/gpt-module/gpt-thread";

// marker
export const TRACE_PILOT_MARKER:string="// @trace-pilot";

// content script に問い合わせ（レスポンス型を付ける）
export type TracePilotResponse = { selectionText: string } | { error: string };

export const MENU_ID_PDF="create_hash_and_store_PDF";
export const MENU_ID_GPT="create_hash_and_store_GPT";
export const MENU_ID_OTER="create_hash_and_store_OTHER";
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
  PDF_OPEN='pdfOpen'
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
    OTHER="OTHER"
}

export type MessageToNativeHost =
  | ChromePdfMessage
  | ChatGptMessage
  | OtherMessage;

interface BaseMessage {
  url: string;
  plain_text: string;
}

export interface ChromePdfMessage extends BaseMessage {
  type: RESPONSE_TYPE.CHROME_PDF;
  data: PDFData;
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
