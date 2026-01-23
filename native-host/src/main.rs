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


fn main()->Result<()>{
    let rt=tokio::runtime::Runtime::new()?;
    rt.block_on(async_main())
}

async fn async_main() -> Result<()> {
    let input = read_input().context("read_input failed")?;

    eprintln!("raw input bytes = {}", input.len());
eprintln!("{}", String::from_utf8_lossy(&input));
eprintln!("first char = {:?}", String::from_utf8_lossy(&input).chars().next());


    let req: types::RequestFromChrome = serde_json::from_slice(&input)
        .context("failed to parse Request JSON")?;

    
    let meta_hash=match req{
        types::RequestFromChrome::ChromePDF{url,plain_text,..}=>{
            hash_and_store_pdf(url,plain_text,true)
                .await
                .context("hash_and_store_pdf failed")?
        }
        

        types::RequestFromChrome::ChatGpt{url,plain_text,data}=>{
            hash_and_store_gpt(url,plain_text,data)
                .await
                .context("hash_and_store_gpt failed")?
        }
       types::RequestFromChrome::Other { .. } => {
            anyhow::bail!("expected CHROME_PDF or CHAT_GPT request")
        }
    };

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

    eprintln!("url: {}",url);
    let bytes = get_bytes_from_url::get_bytes_from_url(&url).await?;
    let data: &[u8] = &bytes;

    let full_text_hash = hash_and_store::calculate_hash_and_store_bytes(cwd, data)?;
    eprintln!("full_text_hash: {}",full_text_hash);

    

    let meta = types::Metadata {
        originalHash: original_hash,
        additionalHash: Some(
            types::AdditionalHash::ChromePDFHash(
                types::ChromePDFHash{
                    fullTextHash: full_text_hash,
                }
            )
        ),
        url,

        r#type: types::WebInfoSource::ChromePDF,

        timeCopied: Utc::now().to_rfc3339(),
        timeCopiedNumber: Utc::now().timestamp_millis(),

        additionalMetaData: Some(
            types::AdditionalMetadata::ChromePDFMetadata(
                types::ChromePDFMetadata {
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



async fn hash_and_store_gpt(url: String,plain_text:String,data:types::GPTData)->Result<String>{

    let cwd="/home/hase/thesis/trace-pilot-chrome/extension";
    // plainTextの保存
    let plain_text_str:&str=plain_text.as_str();
    let original_hash
        =hash_and_store::calculate_hash_and_store_text(cwd, plain_text_str)?;

    eprintln!("original_hash: {}",original_hash);

    let thread_pair=data.thread_pair;
    let user_message:&str=thread_pair.userMessage.as_str();
    let prompt_hash
        =hash_and_store::calculate_hash_and_store_text(cwd,user_message)?;
    
    let bot_response:&str=thread_pair.botResponse.as_str();
    let response_hash
        =hash_and_store::calculate_hash_and_store_text(cwd, bot_response)?;
    

    let meta = types::Metadata {
        originalHash: original_hash,
        additionalHash: Some(
            types::AdditionalHash::GPTHash(
                types::GPTHash{
                    promptHash: prompt_hash,
                    generatedHash: response_hash,
                }
            )
        ),
        url,

        r#type: types::WebInfoSource::ChatGpt,

        timeCopied: Utc::now().to_rfc3339(),
        timeCopiedNumber: Utc::now().timestamp_millis(),

        additionalMetaData: Some(
            types::AdditionalMetadata::GPTMetadata(
                types::GPTMetadata {
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

