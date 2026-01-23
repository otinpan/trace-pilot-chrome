// marker
export const TRACE_PILOT_MARKER:string="// @trace-pilot";

// content script に問い合わせ（レスポンス型を付ける）
export type TracePilotResponse = { selectionText: string } | { error: string };

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




export interface MessageToNativeHost{
    url: string,
    plain_text: string,
    is_pdf: boolean,
    web_type: WEB_INFO_SOURCE;
    additional_data: AdditionalData,
}

export enum WEB_INFO_SOURCE{
    CHAT_GPT="CHAT_GPT",
    PDF="PDF"
}

export type AdditionalData=
| {kind:"NONE"}


