use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
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


#[derive(Debug, Clone, Serialize, Deserialize)]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum AdditionalHash{
    VSCodeHash(VSCodeHash),
    ChromePDFHash(ChromePDFHash),
    GPTHash(GPTHash),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VSCodeHash{
    pub fullTextHash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChromePDFHash{
    pub fullTextHash:String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GPTHash{
    pub promptHash:String,
    pub generatedHash: String,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum AdditionalMetadata {
    GPTMetadata(GPTMetadata),
    VSCodeMetadata(VSCodeMetadata),
    ChromePDFMetadata(ChromePDFMetadata),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VSCodeMetadata {
    pub isText: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChromePDFMetadata{
    pub isText:bool,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GPTMetadata {
    pub isText: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreadPair {
    pub id: String,
    pub time: i64,
    pub prompt: String,
    pub response: String,
}
