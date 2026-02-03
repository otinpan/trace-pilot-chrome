use std::io::{self, Read, Write};
use anyhow::{anyhow, bail, Context, Result};
use chrono::Utc;
use serde::{Deserialize,Serialize};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;
use std::process::Command;
use std::collections::HashSet;

mod hash_and_store;
mod get_bytes_from_url;
mod types;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Response {
    metaHash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct GetGitResponse{
    ok:bool,
    git_repo: Vec<String>,
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
        // .gitが含まれるフォルダを返す
        types::RequestFromChrome::GetGit { .. } => {
            let repos=get_git_repos().await?;

            let resp=GetGitResponse{
                ok:true,
                git_repo:repos,
            };

            let resp_json=serde_json::to_vec(&resp)?;
            write_output_bytes(&resp_json)?;
            return Ok(());
        }
        types::RequestFromChrome::ChromePDF{url,plain_text, data, repoPath}=>{
            let meta_hash=hash_and_store_pdf(url,plain_text,true,repoPath).await?;
            let resp = Response { metaHash: meta_hash };
            let resp_json = serde_json::to_vec(&resp).context("failed to serialize response")?;
            eprintln!("resp {}",resp.metaHash);
            write_output_bytes(&resp_json).context("write_output failed")?;
        }
        types::RequestFromChrome::ChatGpt{url,plain_text,data,repoPath}=>{
            let meta_hash=hash_and_store_gpt(url,plain_text,data,repoPath).await?;
            let resp = Response { metaHash: meta_hash };
            let resp_json = serde_json::to_vec(&resp).context("failed to serialize response")?;
            eprintln!("resp {}",resp.metaHash);
            write_output_bytes(&resp_json).context("write_output failed")?;
        }
       types::RequestFromChrome::Other { .. } => {
            anyhow::bail!("expected CHROME_PDF or CHAT_GPT request")
        }
    };


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


async fn hash_and_store_pdf(url:String,plain_text:String,is_pdf:bool,repoPath:String)->Result<String>{
    if !is_pdf{
        bail!("this url is not PDF: url={}",url);
    }

    let cwd:&str=repoPath.as_str();
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



async fn hash_and_store_gpt(url: String,plain_text:String,data:types::GPTData,repoPath:String)->Result<String>{

    let cwd=repoPath.as_str();
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
    
    let mut cb_hashes: Vec<types::CodeBlockHash> 
        = Vec::with_capacity(thread_pair.codeBlocks.len());

    for(i,cb) in thread_pair.codeBlocks.iter().enumerate(){
        let code_hash = hash_and_store::calculate_hash_and_store_text(cwd, cb.code.as_str())?;

        cb_hashes.push(types::CodeBlockHash{
            index: i,
            codeHash: code_hash,
            language: Some(cb.language.clone()),
            parentId: Some(cb.parentId.clone()),
            turnParentId:Some(cb.turnParentId.clone()),
        });
    }
    

    let meta = types::Metadata {
        originalHash: original_hash,
        additionalHash: Some(
            types::AdditionalHash::GPTHash(
                types::GPTHash{
                    promptHash: prompt_hash,
                    generatedHash: response_hash,
                    codeBlockHashes: cb_hashes,
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


async fn get_git_repos() -> Result<Vec<String>> {
    let home = std::env::var("HOME").context("HOME not set")?;
    let mut repos = HashSet::<PathBuf>::new();

    for entry in WalkDir::new(&home)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_name() == ".git" {
            if let Some(parent) = entry.path().parent() {
                if is_valid_git_repo(parent) {
                    repos.insert(parent.to_path_buf());
                }
            }
        }
    }

    let mut result: Vec<String> = repos
        .into_iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect();

    result.sort();
    Ok(result)
}

fn is_valid_git_repo(path: &Path) -> bool {
    Command::new("git")
        .args(["-C", path.to_str().unwrap(), "rev-parse", "--is-inside-work-tree"])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}