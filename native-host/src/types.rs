use serde::{Deserialize, Serialize};
use schemars::JsonSchema;

#[derive(Debug, Clone, Serialize, Deserialize,JsonSchema)]
pub enum WebInfoSource {
    #[serde(rename = "CHAT_GPT")]
    ChatGpt,
    #[serde(rename="CHROME_PDF")]
    ChromePDF,
    #[serde(rename = "VSCODE")]
    Vscode,
    #[serde(rename = "OTHER")]
    Other,
}


#[derive(Debug, Clone, Serialize, Deserialize,JsonSchema)]
pub struct Metadata {
    pub originalHash: String,
    pub additionalHash: Option<AdditionalHash>,
    pub url: String,
    #[serde(rename = "type")]
    pub r#type: WebInfoSource,
    pub timeCopied: String,
    pub timeCopiedNumber: i64,
    pub additionalMetaData: Option<AdditionalMetadata>,
}

#[derive(Debug, Clone, Serialize, Deserialize,JsonSchema)]
#[serde(untagged)]
pub enum AdditionalHash{
    VSCodeHash(VSCodeHash),
    ChromePDFHash(ChromePDFHash),
    GPTHash(GPTHash),
}

#[derive(Debug, Clone, Serialize, Deserialize,JsonSchema)]
pub struct VSCodeHash{
    pub fullTextHash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize,JsonSchema)]
pub struct ChromePDFHash{
    pub fullTextHash:String,
}

#[derive(Debug, Clone, Serialize, Deserialize,JsonSchema)]
pub struct GPTHash{
    pub promptHash:String,
    pub generatedHash: String,

    #[serde(default)]
    pub codeBlockHashes: Vec<CodeBlockHash>,
}

#[derive(Debug, Clone, Serialize, Deserialize,JsonSchema)]
pub struct CodeBlockHash {
    pub index: usize,
    pub codeHash: String,

    // あると便利（後で紐付けに使える）
    #[serde(default)]
    pub language: Option<String>,
    #[serde(default)]
    pub parentId: Option<String>,
    #[serde(default)]
    pub turnParentId: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize,JsonSchema)]
#[serde(untagged)]
pub enum AdditionalMetadata {
    GPTMetadata(GPTMetadata),
    VSCodeMetadata(VSCodeMetadata),
    ChromePDFMetadata(ChromePDFMetadata),
}

#[derive(Debug, Clone, Serialize, Deserialize,JsonSchema)]
pub struct VSCodeMetadata {
    pub isText: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize,JsonSchema)]
pub struct ChromePDFMetadata{
    pub isText:bool,
}


#[derive(Debug, Clone, Serialize, Deserialize,JsonSchema)]
pub struct GPTMetadata {
    pub isText: bool,
}


// message from chrome /////////////////////////////////////////////////////
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum RequestFromChrome {
    #[serde(rename = "CHROME_PDF")]
    ChromePDF {
        data: PDFData,
        url: String,
        plain_text: String,
        repoPath: String,
    },

    #[serde(rename = "CHAT_GPT")]
    ChatGpt {
        data: GPTData,
        url: String,
        plain_text: String,
        repoPath: String,
    },

    #[serde(rename = "OTHER")]
    Other {
        data: Option<serde_json::Value>, // or omit data entirely, どっちでも
        url: String,
        plain_text: String,
        repoPath: String,
    },

    #[serde(rename="GET_GIT")]
    GetGit{
        data: Option<serde_json::Value>,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PDFData {}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GPTData {
    pub thread_pair: ThreadPair,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeBlock {
    pub code: String,
    #[serde(default)]
    pub codeRef: Option<String>,
    pub copied: bool,
    pub surroundingText: String,
    pub language: String,
    pub parentId: String,
    pub turnParentId: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreadPair {
    pub id: String,
    pub time: i64,
    pub userMessage: String,
    pub botResponse: String,
    pub codeBlocks: Vec<CodeBlock>,
}


#[derive(Debug,Clone,Serialize,Deserialize)]
pub struct GetGitRepoResponse{
    pub ok:bool,
    pub git_repo:Vec<String>,
}


