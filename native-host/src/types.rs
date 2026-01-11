use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WebInfoSource {
    #[serde(rename = "CHAT_GPT")]
    ChatGpt,
    #[serde(rename = "VSCODE")]
    Vscode,
    #[serde(rename = "OTHER")]
    Other,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Metadata {
    pub originalHash: String,
    pub fullTextHash: String,
    pub url: String,
    #[serde(rename = "type")]
    pub r#type: WebInfoSource,
    pub timeCopied: String,
    pub timeCopiedNumber: i64,
    pub additionalMetaData: Option<AdditionalMetadata>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum AdditionalMetadata {
    ChatGptCopyBuffer(ChatGptCopyBuffer),
    VSCodeCopyMedia(VSCodeCopyMedia),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VSCodeCopyMedia {
    pub isText: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatGptCopyBuffer {
    pub messageCopied: ThreadPair,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreadPair {
    pub id: String,
    pub time: i64,
    pub prompt: String,
    pub response: String,
}
