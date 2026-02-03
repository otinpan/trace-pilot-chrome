use anyhow::{anyhow, bail, Context, Result};
use regex::Regex;
use std::{
    fs,
    io::{self, Write},
    path::{Path, PathBuf},
    process::{Command, Stdio},
};

pub fn calculate_hash_and_store_text(cwd: impl AsRef<Path>, text:&str) -> Result<String>{
    let repo=get_repo_path_or_err(cwd)?;
    ensure_worktree(&repo)?;

    let worktree=repo.join(".trace-worktree");

    // hashの計算
    let hash=git_hash_object_stdin(&worktree, text.as_bytes())?;
    // staging
    stage_blob_object(&worktree,&hash,text.as_bytes())?;
    // commit
    commit_blob_object(&worktree)?;

    Ok(hash)
}

pub fn calculate_hash_and_store_bytes(cwd: impl AsRef<Path>,data: &[u8])->Result<String>{
    let repo=get_repo_path_or_err(cwd)?;
    ensure_worktree(&repo)?;

    let worktree=repo.join(".trace-worktree");

    // hashの計算
    let hash=git_hash_object_stdin(&worktree,data)?;
    // staging
    stage_blob_object(&worktree,&hash,data)?;
    // commit
    commit_blob_object(&worktree)?;

    Ok(hash)

}

fn git_hash_object_stdin(worktree: &Path, data: &[u8])->Result<String>{
    let mut child=Command::new("git")
        .args(["hash-object","--stdin"])
        .current_dir(worktree)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .context("failed to spawn git hash-objet")?;
    
    // 書き込み
    {
        let stdin=child.stdin.as_mut().context("failed to open stdin")?;
        stdin.write_all(data).context("failed to write stdin")?;
    }
    
    let out=child.wait_with_output().context("failed to wait")?;
    if !out.status.success(){
        bail!{
            "git hash-object failed: {}",
            String::from_utf8_lossy(&out.stderr)
        };
    }

    Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

fn stage_blob_object(worktree: &Path,hash: &str, data: &[u8]) -> Result<()>{
    let dir=worktree.join("blobs");
    fs::create_dir_all(&dir).context("failed to create blobs dir")?;

    let file=dir.join(format!("{hash}.bin"));
    fs::write(&file,data).context("failed to write blobs/<hash>.bin")?;

    exec_git(
        worktree,
        &["add","-f",&format!("blobs/{hash}.bin")],
        true,
    )?;

    Ok(())
}

fn commit_blob_object(worktree: &Path)->Result<()>{
    let out=Command::new("git")
        .args(["commit","-m","store copied content"])
        .current_dir(worktree)
        .output()
        .context("failed to run git commit")?;

    if out.status.success(){
        return Ok(());
    }

    let msg=format!(
        "{}{}",
        String::from_utf8_lossy(&out.stderr),
        String::from_utf8_lossy(&out.stdout)
    );

    let re = Regex::new(r"nothing to commit|working tree clean").unwrap();
    if re.is_match(&msg.to_lowercase()) {
        return Ok(());
    }

    bail!("git commit failed: {msg}");
}




// .gitのある親ディレクトリを返す
fn get_repo_path_or_err(cwd:impl AsRef<Path>)->Result<PathBuf>{
    let out=Command::new("git")
        .args(["rev-parse","--show-toplevel"])
        .current_dir(cwd.as_ref())
        .output()
        .context("failed to run git rev-parse")?;

    if !out.status.success(){
        bail!(
            "Not a git repository. git rev-parse failed: {}",
            String::from_utf8_lossy(&out.stderr)
        );
    }

    
    Ok(PathBuf::from(String::from_utf8_lossy(&out.stdout).trim()))
}

// worktreeの作成
fn ensure_worktree(repo: &Path)->Result<()>{
    let worktree_dir=repo.join(".trace-worktree");

    if worktree_dir.exists(){
        ensure_gitignore(repo)?;
        return Ok(());
    }

    let worktree_path = worktree_dir
        .to_str()
        .ok_or_else(|| anyhow!("non-utf8 path"))?;

    let out1 = Command::new("git")
        .args(["worktree", "add", worktree_path, "trace-store"])
        .current_dir(repo)
        .output()
        .context("failed to run git worktree add trace-store")?;

    if out1.status.success() {
        return Ok(());
    }

    let err1 = String::from_utf8_lossy(&out1.stderr).to_string();

    // ブランチが無い場合 → 作りながら worktree add
    let out2 = Command::new("git")
        .args(["worktree", "add", "-b", "trace-store", worktree_path])
        .current_dir(repo)
        .output()
        .context("failed to run git worktree add -b trace-store")?;

    if out2.status.success() {
        return Ok(());
    }

    let err2 = String::from_utf8_lossy(&out2.stderr).to_string();

    // どちらも失敗 & ディレクトリも無い → エラー
    if !worktree_dir.exists() {
        bail!(
            "Failed to ensure worktree.\n\
             First attempt (existing branch): {}\n\
             Second attempt (create branch): {}",
            err1.trim(),
            err2.trim()
        );
    }

    ensure_gitignore(repo)?;
    Ok(())
}


fn ensure_gitignore(repo_root: &Path) -> Result<()> {
    let gitignore_path = repo_root.join(".gitignore");
    let entry = ".trace-worktree/";

    let mut content = String::new();

    if gitignore_path.exists() {
        content = fs::read_to_string(&gitignore_path)
            .with_context(|| format!("failed to read {:?}", gitignore_path))?;

        let exists = content
            .lines()
            .map(|l| l.trim())
            .any(|l| l == entry || l == ".trace-worktree");

        if exists {
            return Ok(());
        }

        if !content.is_empty() && !content.ends_with('\n') {
            content.push('\n');
        }
    }

    content.push_str(entry);
    content.push('\n');

    fs::write(&gitignore_path, content)
        .with_context(|| format!("failed to write {:?}", gitignore_path))?;

    Ok(())
}


fn exec_git(worktree: &Path, args: &[&str], check: bool) -> Result<String> {
    let out = Command::new("git")
        .args(args)
        .current_dir(worktree)
        .output()
        .with_context(|| format!("failed to run git {}", args.join(" ")))?;

    let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();

    if check && !out.status.success() {
        bail!("git {} failed: {}", args.join(" "), if stderr.is_empty() { stdout.clone() } else { stderr });
    }

    Ok(if stdout.is_empty() { stderr } else { stdout })
}