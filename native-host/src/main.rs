use std::io::{self, Read, Write};
use anyhow::{anyhow, bail, Context, Result};
use chrono::Utc;
use serde::Deserialize;

mod hash_and_store;
mod get_bytes_from_url;
mod types;

#[derive(Debug, Deserialize)]
struct Request {
    url: String,
    plainText: String,
    isPdf: bool,
}

fn main() -> Result<()> {
    let input = read_input().context("read_input failed")?;

    let req: Request = serde_json::from_slice(&input)
        .context("failed to parse Request JSON")?;

    let meta_hash = hash_and_store(req.url, req.plainText, req.isPdf)
        .context("hash_and_store failed")?;

    write_output(meta_hash.as_str()).context("write_output failed")?;
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

pub fn write_output(msg: &str) -> io::Result<()> {
    let mut outstream = io::stdout();
    let len = msg.len();

    if len > 1024 * 1024 {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "Message too large"));
    }

    // 4バイト長 + 本体（little-endian）
    outstream.write_all(&(len as u32).to_le_bytes())?;
    outstream.write_all(msg.as_bytes())?;
    outstream.flush()?;
    Ok(())
}

fn hash_and_store(url:String,plain_text:String,is_pdf:bool)->Result<String>{
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
    /* 
    let data: &[u8]=get_bytes_from_url::
    fullTextHash
        =hash_and_store::calculate_hash_and_store_bytes(cwd, data);
    */

    let meta = types::Metadata {
        originalHash: original_hash,
        fullTextHash: full_text_hash,
        url,

        r#type: types::WebInfoSource::Other,

        timeCopied: Utc::now().to_rfc3339(),
        timeCopiedNumber: Utc::now().timestamp_millis(),

        additionalMetaData: None,
    };

    let meta_json=serde_json::to_string(&meta)?;
    let meta_json_str: &str=meta_json.as_str();
    let meta_hash=hash_and_store::calculate_hash_and_store_text(cwd, meta_json_str)?;


    Ok(meta_hash)
}


