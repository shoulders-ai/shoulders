use base64::{engine::general_purpose::STANDARD, Engine as _};
use git2::{
    Cred, DiffOptions, FetchOptions, IndexAddOption, Oid, PushOptions, RemoteCallbacks,
    Repository, Signature, Sort, StatusOptions,
};
use serde::Serialize;
use std::path::Path;

fn open_repo(repo_path: &str) -> Result<Repository, String> {
    Repository::open(repo_path).map_err(|e| e.message().to_string())
}

#[tauri::command]
pub async fn git_clone(url: String, target_path: String) -> Result<(), String> {
    Repository::clone(&url, &target_path).map_err(|e| {
        let msg = e.message().to_string();
        // Return user-friendly messages for common errors
        if msg.contains("unexpected http status code: 404") || msg.contains("repository not found") {
            "Repository not found. Check the URL and try again.".to_string()
        } else if msg.contains("authentication") || msg.contains("401") || msg.contains("403") {
            "Authentication failed. This may be a private repository.".to_string()
        } else if msg.contains("already exists and is not an empty directory") {
            "A folder with that name already exists in the chosen location.".to_string()
        } else if msg.contains("resolve") || msg.contains("dns") || msg.contains("network") {
            "Could not connect. Check your internet connection and the URL.".to_string()
        } else {
            format!("Clone failed: {}", msg)
        }
    })?;
    Ok(())
}

#[tauri::command]
pub async fn git_init(path: String) -> Result<(), String> {
    let repo = Repository::init(&path).map_err(|e| e.message().to_string())?;

    // Write default .gitignore if it doesn't exist
    let gitignore_path = Path::new(&path).join(".gitignore");
    if !gitignore_path.exists() {
        std::fs::write(
            &gitignore_path,
            ".shoulders/\n.project/references/fulltext/\nnode_modules/\n.DS_Store\n",
        )
        .map_err(|e| e.to_string())?;
    }

    // Stage the .gitignore so the initial commit isn't empty
    let mut index = repo.index().map_err(|e| e.message().to_string())?;
    index
        .add_path(Path::new(".gitignore"))
        .map_err(|e| e.message().to_string())?;
    index.write().map_err(|e| e.message().to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn git_add_all(repo_path: String) -> Result<(), String> {
    let repo = open_repo(&repo_path)?;
    let mut index = repo.index().map_err(|e| e.message().to_string())?;
    index
        .add_all(["*"].iter(), IndexAddOption::DEFAULT, None)
        .map_err(|e| e.message().to_string())?;
    // Also remove deleted files from the index
    index
        .update_all(["*"].iter(), None)
        .map_err(|e| e.message().to_string())?;
    index.write().map_err(|e| e.message().to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn git_commit(repo_path: String, message: String) -> Result<String, String> {
    let repo = open_repo(&repo_path)?;
    let sig =
        Signature::now("Shoulders", "shoulders@local").map_err(|e| e.message().to_string())?;

    let mut index = repo.index().map_err(|e| e.message().to_string())?;
    let tree_oid = index
        .write_tree()
        .map_err(|e| e.message().to_string())?;
    let tree = repo
        .find_tree(tree_oid)
        .map_err(|e| e.message().to_string())?;

    let parent_commit = match repo.head() {
        Ok(head) => {
            let commit = head
                .peel_to_commit()
                .map_err(|e| e.message().to_string())?;
            Some(commit)
        }
        Err(_) => None, // Initial commit — no parent
    };

    let parents: Vec<&git2::Commit> = parent_commit.iter().collect();

    let oid = repo
        .commit(Some("HEAD"), &sig, &sig, &message, &tree, &parents)
        .map_err(|e| e.message().to_string())?;

    Ok(oid.to_string())
}

#[tauri::command]
pub async fn git_status(repo_path: String) -> Result<String, String> {
    let repo = open_repo(&repo_path)?;
    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true);

    let statuses = repo
        .statuses(Some(&mut opts))
        .map_err(|e| e.message().to_string())?;

    let mut lines = Vec::new();
    for entry in statuses.iter() {
        let path = entry.path().unwrap_or("");
        let status = entry.status();
        let code = status_to_porcelain(status);
        if !code.is_empty() {
            lines.push(format!("{} {}", code, path));
        }
    }

    Ok(lines.join("\n"))
}

fn status_to_porcelain(status: git2::Status) -> String {
    let index_char = if status.contains(git2::Status::INDEX_NEW) {
        'A'
    } else if status.contains(git2::Status::INDEX_MODIFIED) {
        'M'
    } else if status.contains(git2::Status::INDEX_DELETED) {
        'D'
    } else if status.contains(git2::Status::INDEX_RENAMED) {
        'R'
    } else {
        ' '
    };

    let wt_char = if status.contains(git2::Status::WT_NEW) {
        '?'
    } else if status.contains(git2::Status::WT_MODIFIED) {
        'M'
    } else if status.contains(git2::Status::WT_DELETED) {
        'D'
    } else {
        ' '
    };

    // Untracked files: "?? path"
    if status.contains(git2::Status::WT_NEW) && !status.contains(git2::Status::INDEX_NEW) {
        return "??".to_string();
    }

    let code = format!("{}{}", index_char, wt_char);
    if code.trim().is_empty() {
        String::new()
    } else {
        code
    }
}

#[tauri::command]
pub async fn git_branch(repo_path: String) -> Result<String, String> {
    let repo = open_repo(&repo_path)?;
    let result = match repo.head() {
        Ok(head) => head.shorthand().unwrap_or("HEAD").to_string(),
        Err(_) => String::new(),
    };
    Ok(result)
}

#[derive(Serialize, Clone)]
pub struct LogEntry {
    pub hash: String,
    pub date: String,
    pub message: String,
}

#[tauri::command]
pub async fn git_log(
    repo_path: String,
    file_path: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<LogEntry>, String> {
    let repo = open_repo(&repo_path)?;
    let limit = limit.unwrap_or(50);

    let mut revwalk = repo.revwalk().map_err(|e| e.message().to_string())?;
    revwalk
        .push_head()
        .map_err(|e| e.message().to_string())?;
    revwalk.set_sorting(Sort::TIME).map_err(|e| e.message().to_string())?;

    let rel_path = file_path.as_ref().map(|fp| {
        if fp.starts_with(&repo_path) {
            fp[repo_path.len()..].trim_start_matches('/').to_string()
        } else {
            fp.clone()
        }
    });

    let mut entries = Vec::new();
    let mut prev_blob_id: Option<Oid> = None;

    for oid_result in revwalk {
        if entries.len() >= limit {
            break;
        }

        let oid = oid_result.map_err(|e| e.message().to_string())?;
        let commit = repo
            .find_commit(oid)
            .map_err(|e| e.message().to_string())?;

        // If filtering by file, check if this commit changed the file
        if let Some(ref rel) = rel_path {
            let tree = commit.tree().map_err(|e| e.message().to_string())?;
            let current_blob_id = tree
                .get_path(Path::new(rel))
                .ok()
                .map(|entry| entry.id());

            // On first commit, just record the blob id and include it
            if prev_blob_id.is_none() && entries.is_empty() {
                // Fall through to record and include
            } else if current_blob_id == prev_blob_id {
                // File unchanged in this commit — skip
                continue;
            }
            prev_blob_id = current_blob_id;

            // Skip if file doesn't exist at this commit at all
            if current_blob_id.is_none() {
                continue;
            }
        }

        let time = commit.time();
        let secs = time.seconds();
        let offset_mins = time.offset_minutes();
        let dt = chrono::DateTime::from_timestamp(secs, 0)
            .unwrap_or_default()
            .with_timezone(&chrono::FixedOffset::east_opt(offset_mins * 60).unwrap_or(chrono::FixedOffset::east_opt(0).unwrap()));

        entries.push(LogEntry {
            hash: oid.to_string(),
            date: dt.to_rfc3339(),
            message: commit.summary().unwrap_or("").to_string(),
        });
    }

    Ok(entries)
}

#[tauri::command]
pub async fn git_show_file(
    repo_path: String,
    commit_hash: String,
    file_path: String,
) -> Result<String, String> {
    let repo = open_repo(&repo_path)?;

    let rel_path = if file_path.starts_with(&repo_path) {
        file_path[repo_path.len()..].trim_start_matches('/').to_string()
    } else {
        file_path.clone()
    };

    let oid = Oid::from_str(&commit_hash).map_err(|e| e.message().to_string())?;
    let commit = repo
        .find_commit(oid)
        .map_err(|e| e.message().to_string())?;
    let tree = commit.tree().map_err(|e| e.message().to_string())?;
    let entry = tree
        .get_path(Path::new(&rel_path))
        .map_err(|e| e.message().to_string())?;
    let blob = repo
        .find_blob(entry.id())
        .map_err(|e| e.message().to_string())?;

    String::from_utf8(blob.content().to_vec())
        .map_err(|_| "File is not valid UTF-8".to_string())
}

#[tauri::command]
pub async fn git_show_file_base64(
    repo_path: String,
    commit_hash: String,
    file_path: String,
) -> Result<String, String> {
    let repo = open_repo(&repo_path)?;

    let rel_path = if file_path.starts_with(&repo_path) {
        file_path[repo_path.len()..].trim_start_matches('/').to_string()
    } else {
        file_path.clone()
    };

    let oid = Oid::from_str(&commit_hash).map_err(|e| e.message().to_string())?;
    let commit = repo
        .find_commit(oid)
        .map_err(|e| e.message().to_string())?;
    let tree = commit.tree().map_err(|e| e.message().to_string())?;
    let entry = tree
        .get_path(Path::new(&rel_path))
        .map_err(|e| e.message().to_string())?;
    let blob = repo
        .find_blob(entry.id())
        .map_err(|e| e.message().to_string())?;

    Ok(STANDARD.encode(blob.content()))
}

#[tauri::command]
pub async fn git_diff(repo_path: String) -> Result<String, String> {
    let repo = open_repo(&repo_path)?;

    let head_tree = match repo.head() {
        Ok(head) => {
            let commit = head
                .peel_to_commit()
                .map_err(|e| e.message().to_string())?;
            Some(
                commit
                    .tree()
                    .map_err(|e| e.message().to_string())?,
            )
        }
        Err(_) => None,
    };

    let mut opts = DiffOptions::new();
    let diff = repo
        .diff_tree_to_workdir_with_index(head_tree.as_ref(), Some(&mut opts))
        .map_err(|e| e.message().to_string())?;

    let mut patch = String::new();
    diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
        let origin = line.origin();
        if origin == '+' || origin == '-' || origin == ' ' {
            patch.push(origin);
        }
        patch.push_str(std::str::from_utf8(line.content()).unwrap_or(""));
        true
    })
    .map_err(|e| e.message().to_string())?;

    Ok(patch)
}

#[tauri::command]
pub async fn git_diff_stat(repo_path: String) -> Result<String, String> {
    let repo = open_repo(&repo_path)?;

    let head_tree = match repo.head() {
        Ok(head) => {
            let commit = head
                .peel_to_commit()
                .map_err(|e| e.message().to_string())?;
            Some(
                commit
                    .tree()
                    .map_err(|e| e.message().to_string())?,
            )
        }
        Err(_) => None,
    };

    let mut opts = DiffOptions::new();
    let diff = repo
        .diff_tree_to_workdir_with_index(head_tree.as_ref(), Some(&mut opts))
        .map_err(|e| e.message().to_string())?;

    let stats = diff.stats().map_err(|e| e.message().to_string())?;
    let buf = stats
        .to_buf(git2::DiffStatsFormat::FULL, 80)
        .map_err(|e| e.message().to_string())?;

    Ok(buf.as_str().unwrap_or("").to_string())
}

#[derive(Serialize, Clone)]
pub struct DiffFilePatch {
    pub file: String,
    pub diff: String,
}

#[derive(Serialize, Clone)]
pub struct DiffSummary {
    pub stat: String,
    pub diffs: Vec<DiffFilePatch>,
}

#[tauri::command]
pub async fn git_diff_summary(
    repo_path: String,
    max_files: Option<usize>,
    max_lines: Option<usize>,
) -> Result<DiffSummary, String> {
    let repo = open_repo(&repo_path)?;
    let max_files = max_files.unwrap_or(5);
    let max_lines = max_lines.unwrap_or(20);

    // Try working-dir diff first, then HEAD~1
    let diff = get_working_diff(&repo)
        .or_else(|_| get_head_parent_diff(&repo))
        .unwrap_or(None);

    let diff = match diff {
        Some(d) => d,
        None => {
            return Ok(DiffSummary {
                stat: String::new(),
                diffs: Vec::new(),
            })
        }
    };

    // Build stat string
    let stat = match diff.stats() {
        Ok(stats) => stats
            .to_buf(git2::DiffStatsFormat::FULL, 80)
            .ok()
            .and_then(|b| b.as_str().map(|s| s.to_string()))
            .unwrap_or_default(),
        Err(_) => String::new(),
    };

    // Filter out .shoulders/ paths from stat
    let stat = stat
        .lines()
        .filter(|line| !line.trim_start().starts_with(".shoulders/"))
        .collect::<Vec<_>>()
        .join("\n");

    // Build per-file diffs
    let mut diffs = Vec::new();
    let num_deltas = diff.deltas().len();

    for i in 0..num_deltas {
        if diffs.len() >= max_files {
            break;
        }

        let delta = diff.get_delta(i).unwrap();
        let file_path = delta
            .new_file()
            .path()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| "unknown".to_string());

        // Skip .shoulders/ config noise
        if file_path.starts_with(".shoulders/") {
            continue;
        }

        // Get patch for this specific file
        if let Ok(patch) = git2::Patch::from_diff(&diff, i) {
            if let Some(patch) = patch {
                let mut lines_collected = Vec::new();
                let num_hunks = patch.num_hunks();

                'outer: for h in 0..num_hunks {
                    if let Ok((hunk, _)) = patch.hunk(h) {
                        let header = std::str::from_utf8(hunk.header()).unwrap_or("");
                        lines_collected.push(header.trim_end().to_string());

                        let num_lines = patch.num_lines_in_hunk(h).unwrap_or(0);
                        for l in 0..num_lines {
                            if lines_collected.len() >= max_lines {
                                lines_collected.push("[...truncated]".to_string());
                                break 'outer;
                            }
                            if let Ok(line) = patch.line_in_hunk(h, l) {
                                let origin = line.origin();
                                let content =
                                    std::str::from_utf8(line.content()).unwrap_or("");
                                let formatted = if origin == '+' || origin == '-' || origin == ' ' {
                                    format!("{}{}", origin, content.trim_end())
                                } else {
                                    content.trim_end().to_string()
                                };
                                lines_collected.push(formatted);
                            }
                        }
                    }
                }

                if !lines_collected.is_empty() {
                    diffs.push(DiffFilePatch {
                        file: file_path,
                        diff: lines_collected.join("\n"),
                    });
                }
            }
        }
    }

    Ok(DiffSummary { stat, diffs })
}

fn get_working_diff(repo: &Repository) -> Result<Option<git2::Diff<'_>>, git2::Error> {
    let head_tree = match repo.head() {
        Ok(head) => Some(head.peel_to_commit()?.tree()?),
        Err(_) => None,
    };

    let mut opts = DiffOptions::new();
    opts.context_lines(2);
    let diff =
        repo.diff_tree_to_workdir_with_index(head_tree.as_ref(), Some(&mut opts))?;

    // Check if there are any deltas
    if diff.deltas().len() == 0 {
        return Ok(None);
    }

    Ok(Some(diff))
}

fn get_head_parent_diff(repo: &Repository) -> Result<Option<git2::Diff<'_>>, git2::Error> {
    let head = repo.head()?.peel_to_commit()?;
    let parent = head.parent(0)?;

    let head_tree = head.tree()?;
    let parent_tree = parent.tree()?;

    let mut opts = DiffOptions::new();
    opts.context_lines(2);
    let diff = repo.diff_tree_to_tree(Some(&parent_tree), Some(&head_tree), Some(&mut opts))?;

    if diff.deltas().len() == 0 {
        return Ok(None);
    }

    Ok(Some(diff))
}

// ── Remote management ──

#[tauri::command]
pub async fn git_remote_add(repo_path: String, name: String, url: String) -> Result<(), String> {
    let repo = open_repo(&repo_path)?;
    repo.remote(&name, &url)
        .map_err(|e| e.message().to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn git_remote_get_url(repo_path: String) -> Result<String, String> {
    let repo = open_repo(&repo_path)?;
    let result = match repo.find_remote("origin") {
        Ok(remote) => remote.url().unwrap_or("").to_string(),
        Err(_) => String::new(),
    };
    Ok(result)
}

#[tauri::command]
pub async fn git_remote_remove(repo_path: String, name: String) -> Result<(), String> {
    let repo = open_repo(&repo_path)?;
    repo.remote_delete(&name)
        .map_err(|e| e.message().to_string())?;
    Ok(())
}

// ── Push / Fetch / Pull ──

fn make_callbacks(token: &str) -> RemoteCallbacks<'_> {
    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(move |_url, username, _allowed| {
        Cred::userpass_plaintext(username.unwrap_or("x-access-token"), token)
    });
    callbacks
}

#[tauri::command]
pub async fn git_push(
    repo_path: String,
    remote: String,
    branch: String,
    token: String,
) -> Result<(), String> {
    let repo = open_repo(&repo_path)?;
    let mut remote_obj = repo
        .find_remote(&remote)
        .map_err(|e| e.message().to_string())?;

    let callbacks = make_callbacks(&token);
    let mut opts = PushOptions::new();
    opts.remote_callbacks(callbacks);

    let refspec = format!("refs/heads/{}:refs/heads/{}", branch, branch);
    remote_obj
        .push(&[&refspec], Some(&mut opts))
        .map_err(|e| {
            let msg = e.message().to_string();
            if msg.contains("non-fast-forward")
                || msg.contains("cannot fast-forward")
                || msg.contains("cannot push")
                || msg.contains("not present locally")
            {
                "CONFLICT: Remote has changes that conflict with your local commits.".to_string()
            } else if msg.contains("authentication") || msg.contains("401") || msg.contains("403") {
                "Authentication failed. Please reconnect your GitHub account.".to_string()
            } else {
                format!("Push failed: {}", msg)
            }
        })?;

    Ok(())
}

#[tauri::command]
pub async fn git_push_branch(
    repo_path: String,
    remote: String,
    local_branch: String,
    remote_branch: String,
    token: String,
) -> Result<(), String> {
    let repo = open_repo(&repo_path)?;
    let mut remote_obj = repo
        .find_remote(&remote)
        .map_err(|e| e.message().to_string())?;

    let callbacks = make_callbacks(&token);
    let mut opts = PushOptions::new();
    opts.remote_callbacks(callbacks);

    let refspec = format!("refs/heads/{}:refs/heads/{}", local_branch, remote_branch);
    remote_obj
        .push(&[&refspec], Some(&mut opts))
        .map_err(|e| format!("Push to branch failed: {}", e.message()))?;

    Ok(())
}

#[tauri::command]
pub async fn git_fetch(
    repo_path: String,
    remote: String,
    token: String,
) -> Result<(), String> {
    let repo = open_repo(&repo_path)?;
    let mut remote_obj = repo
        .find_remote(&remote)
        .map_err(|e| e.message().to_string())?;

    let callbacks = make_callbacks(&token);
    let mut opts = FetchOptions::new();
    opts.remote_callbacks(callbacks);

    remote_obj
        .fetch(&[] as &[&str], Some(&mut opts), None)
        .map_err(|e| {
            let msg = e.message().to_string();
            if msg.contains("authentication") || msg.contains("401") || msg.contains("403") {
                "Authentication failed. Please reconnect your GitHub account.".to_string()
            } else if msg.contains("resolve") || msg.contains("dns") || msg.contains("network") {
                "Could not connect to GitHub. Check your internet connection.".to_string()
            } else {
                format!("Fetch failed: {}", msg)
            }
        })?;

    Ok(())
}

#[derive(Serialize, Clone)]
pub struct AheadBehind {
    pub ahead: usize,
    pub behind: usize,
}

#[tauri::command]
pub async fn git_ahead_behind(repo_path: String) -> Result<AheadBehind, String> {
    let repo = open_repo(&repo_path)?;

    let head = repo.head().map_err(|e| e.message().to_string())?;
    let local_oid = head
        .peel_to_commit()
        .map_err(|e| e.message().to_string())?
        .id();

    // Find upstream tracking branch
    let branch_name = head.shorthand().unwrap_or("main");
    let upstream_ref = format!("refs/remotes/origin/{}", branch_name);
    let upstream = repo
        .find_reference(&upstream_ref)
        .map_err(|_| format!("No upstream tracking branch found for '{}'", branch_name))?;
    let remote_oid = upstream
        .peel_to_commit()
        .map_err(|e| e.message().to_string())?
        .id();

    let (ahead, behind) = repo
        .graph_ahead_behind(local_oid, remote_oid)
        .map_err(|e| e.message().to_string())?;

    Ok(AheadBehind { ahead, behind })
}

#[tauri::command]
pub async fn git_pull_ff(
    repo_path: String,
    remote: String,
    branch: String,
    token: String,
) -> Result<(), String> {
    let repo = open_repo(&repo_path)?;

    // Step 1: Fetch
    {
        let mut remote_obj = repo
            .find_remote(&remote)
            .map_err(|e| e.message().to_string())?;
        let callbacks = make_callbacks(&token);
        let mut opts = FetchOptions::new();
        opts.remote_callbacks(callbacks);
        remote_obj
            .fetch(&[] as &[&str], Some(&mut opts), None)
            .map_err(|e| format!("Fetch failed: {}", e.message()))?;
    }

    // Step 2: Fast-forward merge
    let fetch_head_ref = format!("refs/remotes/{}/{}", remote, branch);
    let fetch_commit = repo
        .find_reference(&fetch_head_ref)
        .map_err(|e| format!("Could not find remote branch: {}", e.message()))?
        .peel_to_commit()
        .map_err(|e| e.message().to_string())?;

    let head = repo.head().map_err(|e| e.message().to_string())?;
    let head_commit = head
        .peel_to_commit()
        .map_err(|e| e.message().to_string())?;

    // Check if fast-forward is possible
    let (_, behind) = repo
        .graph_ahead_behind(head_commit.id(), fetch_commit.id())
        .map_err(|e| e.message().to_string())?;

    if behind == 0 {
        return Ok(()); // Already up to date
    }

    // Check that local is not ahead (would require merge)
    let analysis = repo
        .merge_analysis(&[&repo.find_annotated_commit(fetch_commit.id()).map_err(|e| e.message().to_string())?])
        .map_err(|e| e.message().to_string())?;

    if !analysis.0.is_fast_forward() && !analysis.0.is_up_to_date() {
        return Err("CONFLICT: Cannot fast-forward. Local and remote have diverged.".to_string());
    }

    if analysis.0.is_up_to_date() {
        return Ok(());
    }

    // Perform fast-forward
    let local_ref_name = format!("refs/heads/{}", branch);
    let mut local_ref = repo
        .find_reference(&local_ref_name)
        .map_err(|e| e.message().to_string())?;
    local_ref
        .set_target(fetch_commit.id(), "fast-forward pull")
        .map_err(|e| e.message().to_string())?;

    // Update working directory
    repo.checkout_head(Some(git2::build::CheckoutBuilder::new().force()))
        .map_err(|e| e.message().to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn git_merge_remote(
    repo_path: String,
    remote: String,
    branch: String,
) -> Result<(), String> {
    let repo = open_repo(&repo_path)?;

    let fetch_ref = format!("refs/remotes/{}/{}", remote, branch);
    let remote_ref = repo
        .find_reference(&fetch_ref)
        .map_err(|e| format!("Could not find remote branch: {}", e.message()))?;
    let remote_commit = remote_ref
        .peel_to_commit()
        .map_err(|e| e.message().to_string())?;

    let annotated = repo
        .find_annotated_commit(remote_commit.id())
        .map_err(|e| e.message().to_string())?;

    // Perform merge (updates index + workdir)
    let mut merge_opts = git2::MergeOptions::new();
    let mut checkout_opts = git2::build::CheckoutBuilder::new();
    checkout_opts.safe();

    repo.merge(
        &[&annotated],
        Some(&mut merge_opts),
        Some(&mut checkout_opts),
    )
    .map_err(|e| format!("CONFLICT: {}", e.message()))?;

    // Check for conflicts in the index
    let index = repo.index().map_err(|e| e.message().to_string())?;
    if index.has_conflicts() {
        // Abort: reset to HEAD so repo isn't left in merging state
        if let Ok(head) = repo.head() {
            if let Ok(commit) = head.peel_to_commit() {
                let _ = repo.reset(commit.as_object(), git2::ResetType::Hard, None);
            }
        }
        let _ = repo.cleanup_state();
        return Err(
            "CONFLICT: Files have conflicting changes that need manual resolution.".to_string(),
        );
    }

    // Create merge commit
    let sig = repo
        .signature()
        .unwrap_or_else(|_| Signature::now("Shoulders", "shoulders@local").unwrap());

    let mut index = repo.index().map_err(|e| e.message().to_string())?;
    let tree_oid = index
        .write_tree()
        .map_err(|e| e.message().to_string())?;
    let tree = repo
        .find_tree(tree_oid)
        .map_err(|e| e.message().to_string())?;

    let head_commit = repo
        .head()
        .map_err(|e| e.message().to_string())?
        .peel_to_commit()
        .map_err(|e| e.message().to_string())?;

    repo.commit(
        Some("HEAD"),
        &sig,
        &sig,
        &format!("Merge remote changes from {}/{}", remote, branch),
        &tree,
        &[&head_commit, &remote_commit],
    )
    .map_err(|e| e.message().to_string())?;

    // Clean up merge state files
    let _ = repo.cleanup_state();

    Ok(())
}

#[tauri::command]
pub async fn git_set_user(
    repo_path: String,
    name: String,
    email: String,
) -> Result<(), String> {
    let repo = open_repo(&repo_path)?;
    let mut config = repo.config().map_err(|e| e.message().to_string())?;
    config
        .set_str("user.name", &name)
        .map_err(|e| e.message().to_string())?;
    config
        .set_str("user.email", &email)
        .map_err(|e| e.message().to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn git_clone_authenticated(
    url: String,
    target_path: String,
    token: String,
) -> Result<(), String> {
    let callbacks = make_callbacks(&token);
    let mut fetch_opts = FetchOptions::new();
    fetch_opts.remote_callbacks(callbacks);

    let mut builder = git2::build::RepoBuilder::new();
    builder.fetch_options(fetch_opts);

    builder.clone(&url, Path::new(&target_path)).map_err(|e| {
        let msg = e.message().to_string();
        if msg.contains("404") || msg.contains("not found") {
            "Repository not found. Check the URL and try again.".to_string()
        } else if msg.contains("authentication") || msg.contains("401") || msg.contains("403") {
            "Authentication failed. Please reconnect your GitHub account.".to_string()
        } else if msg.contains("already exists") {
            "A folder with that name already exists.".to_string()
        } else {
            format!("Clone failed: {}", msg)
        }
    })?;
    Ok(())
}
