use anyhow::{anyhow, Context, Result};
use reqwest::header::{ACCEPT, USER_AGENT};
use url::Url;

/// URL(http/https/file) からバイト列を取得する
pub async fn get_bytes_from_url(url_str: &str) -> Result<Vec<u8>> {
    // URLとして解釈（file:// も含む）
    let url = Url::parse(url_str).context("invalid url")?;

    match url.scheme() {
        "http" | "https" => {
            let client = reqwest::Client::builder()
                // 必要ならタイムアウト等を設定
                .build()
                .context("failed to build reqwest client")?;

            let resp = client
                .get(url.as_str())
                .header(ACCEPT, "application/pdf,*/*")
                .header(USER_AGENT, "trace-pilot-native-host/0.1")
                .send()
                .await
                .with_context(|| format!("GET failed: {}", url))?
                .error_for_status()
                .with_context(|| format!("non-success status: {}", url))?;

            let bytes = resp.bytes().await.context("failed to read response bytes")?;
            Ok(bytes.to_vec())
        }

        "file" => {
            // file:///home/user/foo.pdf → パスとして読み込む
            let path = url
                .to_file_path()
                .map_err(|_| anyhow!("invalid file url: {}", url_str))?;
            let bytes = std::fs::read(&path)
                .with_context(|| format!("failed to read file: {}", path.display()))?;
            Ok(bytes)
        }

        other => Err(anyhow!("unsupported scheme: {}", other)),
    }
}
