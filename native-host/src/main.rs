use std::io::{self, Read, Write};
use anyhow::{anyhow, bail, Context, Result};
use chrono::Utc;
use serde::{Deserialize,Serialize};

mod hash_and_store;
mod get_bytes_from_url;
mod types;

#[derive(Serialize)]
struct Response {
    metaHash: String,
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
struct Request {
    url: String,
    plain_text: String,
    is_pdf: bool,
    web_type: WebInfoSource,
    additional_data: AdditionalData,
}

#[derive(Debug, Deserialize)]
enum WebInfoSource {
    CHAT_GPT,
    PDF,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "kind")]
enum AdditionalData {
    NONE,
}


fn main()->Result<()>{
    let rt=tokio::runtime::Runtime::new()?;
    rt.block_on(async_main())
}

async fn async_main() -> Result<()> {
    let input = read_input().context("read_input failed")?;

    let req: Request = serde_json::from_slice(&input)
        .context("failed to parse Request JSON")?;

    
    let meta_hash = hash_and_store_pdf(req.url, req.plain_text, req.is_pdf)
    .await
    .context("hash_and_store failed")?;

    
    let resp = Response { metaHash: meta_hash };
    let resp_json = serde_json::to_vec(&resp).context("failed to serialize response")?;
    write_output_bytes(&resp_json).context("write_output failed")?;

    Ok(())
}



pub fn read_input() -> io::Result<Vec<u8>> {
    let mut instream = io::stdin();

    // 4バイトの長さ（little-endian）を読む
    let mut length = [0u8; 4];
    instream.read_exact(&mut length)?;
    let size = u32::from_le_bytes(length) as usize;

    if size > 1024 * 1024 {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "Message too large"));
    }

    let mut buffer = vec![0u8; size];
    instream.read_exact(&mut buffer)?;
    Ok(buffer)
}

pub fn write_output_bytes(payload: &[u8]) -> io::Result<()> {
    let mut outstream = io::stdout();

    if payload.len() > 1024 * 1024 {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "Message too large"));
    }

    outstream.write_all(&(payload.len() as u32).to_le_bytes())?;
    outstream.write_all(payload)?;
    outstream.flush()?;
    Ok(())
}


async fn hash_and_store_pdf(url:String,plain_text:String,is_pdf:bool)->Result<String>{
    if !is_pdf{
        bail!("this url is not PDF: url={}",url);
    }

    let cwd="/home/hase/thesis/trace-pilot-chrome/extension";
    // plainTextの保存
    let plain_text_str:&str=plain_text.as_str();
    let original_hash
        =hash_and_store::calculate_hash_and_store_text(cwd, plain_text_str)?;

    eprintln!("original_hash: {}",original_hash);

    // fullTextの取得
    let full_text_hash: String="ppp".to_string();
    
    let bytes = get_bytes_from_url::get_bytes_from_url(&url).await?;
    let data: &[u8] = &bytes;

    let full_text_hash = hash_and_store::calculate_hash_and_store_bytes(cwd, data)?;

    

    let meta = types::Metadata {
        originalHash: original_hash,
        fullTextHash: full_text_hash,
        url,

        r#type: types::WebInfoSource::Other,

        timeCopied: Utc::now().to_rfc3339(),
        timeCopiedNumber: Utc::now().timestamp_millis(),

        additionalMetaData: Some(
            types::AdditionalMetadata::VSCodeCopyMedia(
                types::VSCodeCopyMedia {
                    isText: false,
                }
            )
        ),
    };
    

    eprintln!("{:?}",meta);

    let meta_json=serde_json::to_string(&meta)?;
    let meta_json_str: &str=meta_json.as_str();
    let meta_hash=hash_and_store::calculate_hash_and_store_text(cwd, meta_json_str)?;


    Ok(meta_hash)
}


