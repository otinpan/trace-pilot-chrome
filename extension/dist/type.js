// marker
export const TRACE_PILOT_MARKER = "// @trace-pilot";
export const MENU_ID_PDF = "create_hash_and_store_PDF";
export const MENU_ID_GPT = "create_hash_and_store_GPT";
export const MENU_ID_OTER = "create_hash_and_store_OTHER";
export const MENU_ID_STATIC = "create_hash_and_store_STATIC";
export const MENU_ID_GOOGLE_SHEETS = "create_hash_and_store_GOOGLE_SHEETS";
export const NATIVE_HOST_NAME = "trace_pilot_host_chrome";
export var COMMANDS;
(function (COMMANDS) {
    COMMANDS["GOOGLE_OPEN"] = "googleOpen";
    COMMANDS["STACKOVERFLOW_OPEN"] = "stackoverflowOpen";
    COMMANDS["GITHUB_OPEN"] = "githubOpen";
    COMMANDS["GPT_OPEN"] = "chatOpen";
    COMMANDS["OTHER_OPEN"] = "otherOpen";
    COMMANDS["GOOGLE_SEARCH"] = "googleSearch";
    COMMANDS["PDF_OPEN"] = "pdfOpen";
    COMMANDS["STATIC_OPEN"] = "staticOpen";
    COMMANDS["GOOGLE_SHEETS_OPEN"] = "googleSheetsOpen";
})(COMMANDS || (COMMANDS = {}));
export var RESPONSE_TYPE;
(function (RESPONSE_TYPE) {
    RESPONSE_TYPE["CHAT_GPT"] = "CHAT_GPT";
    RESPONSE_TYPE["CHROME_PDF"] = "CHROME_PDF";
    RESPONSE_TYPE["OTHER"] = "OTHER";
    RESPONSE_TYPE["CHROME_STATIC"] = "CHROME_STATIC";
    RESPONSE_TYPE["GET_GIT"] = "GET_GIT";
    RESPONSE_TYPE["GOOGLE_SHEETS"] = "GOOGLE_SHEETS";
})(RESPONSE_TYPE || (RESPONSE_TYPE = {}));
