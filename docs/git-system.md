# Git System

Git is used as a versioning/history backend for local auto-commits AND optional GitHub sync for cloud backup and multi-device access.

## Relevant Files

| File | Role |
|---|---|
| `src-tauri/src/git.rs` | All git operations via `git2` crate (vendored libgit2): clone, init, add, commit, push, pull, fetch, merge, ahead/behind |
| `src/services/git.js` | Frontend git wrapper: init, add, commit, status, log, show, diff, push, pull, fetch, merge |
| `src/services/githubSync.js` | Sync orchestration: push/pull cycle, conflict detection, error classification, GitHub API helpers |
| `src/stores/workspace.js` | Auto-commit timer, sync timer, sync state (`syncStatus`, `syncError`, `syncConflictBranch`) |
| `src/App.vue` | Manual save+commit (Cmd+S) + triggers sync |
| `src/components/VersionHistory.vue` | Version history viewer |
| `src/components/layout/Footer.vue` | Git branch display, sync icon, sync toast notifications |
| `src/components/layout/SyncPopover.vue` | Sync status popover: actionable guidance for errors/conflicts |
| `src/components/GitHubConflictDialog.vue` | Modal conflict resolution dialog |
| `src/components/settings/SettingsGitHub.vue` | GitHub account + repo linking settings |

## How Git Runs

All git operations go through dedicated Rust commands in `src-tauri/src/git.rs` using the `git2` crate (vendored libgit2). **No OS git dependency** — everything goes through the library.

The frontend `services/git.js` wraps each command:
```js
export async function gitPush(repoPath, remote, branch, token) {
  return invoke('git_push', { repoPath, remote, branch, token })
}
```

## Auto-Commit

`workspace.startAutoCommit()` sets up a 5-minute interval timer.

### Auto-Commit Flow (`workspace.autoCommit()`)
1. Check if `.git` exists in workspace → if not, run `git init` + create `.gitignore`
2. Run `git add -A` (stage everything)
3. Run `git status --porcelain` → if non-empty, commit with message `Auto: YYYY-MM-DD HH:MM`
4. On error, log warning and continue (doesn't break the app)

### Default `.gitignore`
Created on first auto-commit if missing:
```
.shoulders/
node_modules/
.DS_Store
```

### Timer Lifecycle
- Started in `workspace.openWorkspace()`
- Stopped and final commit in `workspace.cleanup()` (on app close)
- Interval: 5 minutes (`gitAutoCommitInterval: 5 * 60 * 1000`)

## Manual Save & Commit (Cmd+S)

`App.vue:forceSaveAndCommit()`:
1. Saves all open files to disk (DOCX via `docx-save-now` event, text via `filesStore.saveFile`)
2. Runs `git add -A` — freezes the staged snapshot
3. Runs `git status` — if no changes, shows "All saved (no changes)" in footer center and returns
4. Shows **save confirmation** in footer center: `✓ Saved · Name this version`
5. **8-second window**: user either ignores (timeout → auto-commit) or clicks "Name this version" (→ snapshot dialog)
6. Commits with either `Save: YYYY-MM-DD HH:MM` (timeout/cancel) or the user's chosen name directly (no prefix)

### Named Snapshots

Named snapshots let users create intentional checkpoints ("Submitted draft", "Pre-revision methods"). The flow is zero-friction — doing nothing produces the same `Save:` commit as before.

**Footer center swap**: During the 8-second window, the zoom controls crossfade out and the save confirmation message crossfades in (120ms transition). Dismiss triggers: timeout (8s), clicking "Name this version" (opens dialog), or another Cmd+S (resets timer).

**Snapshot dialog** (`SnapshotDialog.vue`): Lightweight input dialog, teleported to body. Auto-focused input, Enter to submit, Esc/click-outside to cancel. Resolves with the name string or `null`.

**Commit message format**: Named snapshots use the user's text directly as the commit message — no prefix. This keeps `git log` clean. Detection in the UI is by exclusion: anything not prefixed with `Auto:` or `Save:` is a named snapshot.

**Safety**: Files are saved to disk and staged immediately. Only the `git commit` is deferred during the 8-second window. Edits made during the window remain unstaged and don't contaminate the snapshot.

### Relevant Files

| File | Role |
|---|---|
| `src/App.vue` | `forceSaveAndCommit()` — orchestrates the flow |
| `src/components/layout/Footer.vue` | `beginSaveConfirmation()` — returns Promise, center section crossfade |
| `src/components/layout/SnapshotDialog.vue` | Naming dialog (input + save button) |

## Git Service Functions (`services/git.js`)

All functions call dedicated Rust commands via `invoke()`. No CLI git dependency.

### Local Operations

| Function | Rust Command | Purpose |
|---|---|---|
| `gitInit(path)` | `git_init` | Initialize repo + default `.gitignore` |
| `gitAdd(repoPath)` | `git_add_all` | Stage all changes (add + update deleted) |
| `gitCommit(repoPath, message)` | `git_commit` | Create commit |
| `gitStatus(repoPath)` | `git_status` | Porcelain-style status |
| `gitBranch(repoPath)` | `git_branch` | Current branch name |
| `gitLog(repoPath, filePath?, limit?)` | `git_log` | Commit history, optional file filter |
| `gitShow(repoPath, hash, filePath)` | `git_show_file` | File content at commit (text) |
| `gitShowBase64(repoPath, hash, filePath)` | `git_show_file_base64` | File content at commit (binary, e.g. .docx) |
| `gitDiff(repoPath)` | `git_diff` | Working copy diff (patch format) |
| `gitDiffSummary(repoPath, maxFiles?, maxLines?)` | `git_diff_summary` | Abbreviated diff for AI context |

### Remote Operations

| Function | Rust Command | Purpose |
|---|---|---|
| `gitPush(repoPath, remote, branch, token)` | `git_push` | Push branch to remote |
| `gitPushBranch(repoPath, remote, local, remote, token)` | `git_push_branch` | Push local branch to different remote branch name |
| `gitFetch(repoPath, remote, token)` | `git_fetch` | Fetch all refs from remote |
| `gitAheadBehind(repoPath)` | `git_ahead_behind` | Returns `{ ahead, behind }` vs upstream |
| `gitPullFf(repoPath, remote, branch, token)` | `git_pull_ff` | Fetch + fast-forward merge |
| `gitMergeRemote(repoPath, remote, branch)` | `git_merge_remote` | Merge remote branch (aborts on conflicts) |
| `gitRemoteAdd(repoPath, name, url)` | `git_remote_add` | Add remote |
| `gitRemoteGetUrl(repoPath)` | `git_remote_get_url` | Get origin URL |
| `gitRemoteRemove(repoPath, name)` | `git_remote_remove` | Remove remote |
| `gitSetUser(repoPath, name, email)` | `git_set_user` | Set repo-level user.name/email |
| `gitCloneAuthenticated(url, path, token)` | `git_clone_authenticated` | Clone private repo with token auth |

### gitDiffSummary

Returns `{ stat: string, diffs: [{file, diff}] }`. Used by `workspaceMeta.js` to provide AI context about recent changes.

Strategy:
1. Try working-dir diff (uncommitted changes since last auto-commit)
2. If empty (just after auto-commit), fall back to HEAD~1 diff
3. 2 lines of context per hunk
4. Caps at `maxFiles` (default 5). Per-file output capped at `maxLines` (default 20) then `[...truncated]`
5. Filters out `.shoulders/` paths from stat and diffs

### Path Handling
`gitShow` and `gitShowBase64` convert absolute paths to relative (strip workspace prefix) because git expects paths relative to the repo root.

## Version History (`VersionHistory.vue`)

Modal dialog showing git history for a specific file.

### Left Side: Commit List
- Loads via `gitLog(workspace.path, filePath)`
- Shows timestamp (formatted with `toLocaleString`) and commit message
- **Named snapshots** (commits not prefixed with `Auto:` or `Save:`) get visual distinction: bookmark icon, `--fg-primary` color, 500 font weight, subtle accent-tinted background
- Click to preview

### Right Side: Preview

**Text files:** Loads content via `gitShow()`, renders in a read-only CodeMirror editor with theme and markdown highlighting. "Copy" button copies historical content to clipboard.

**DOCX files:** Loads binary content via `gitShowBase64()`, converts to a File object via `base64ToFile()`, renders in a read-only SuperDoc instance (`documentMode: 'viewing'`). SuperDoc is dynamically imported. Copy button is hidden (binary content).

- "Restore" button writes the historical content back to the file (with confirmation dialog)
- For docx, restore uses `write_file_base64` and forces a tab close/reopen cycle to remount DocxEditor

### Access Points
- Context menu on a file in the sidebar → "Version History"
- Opens `VersionHistory.vue` as a modal (teleported to body)

## Footer: Git Branch + Sync Status

`Footer.vue` polls `gitBranch(workspace.path)` every 10 seconds and displays the branch name with a git icon.

When GitHub is connected, a cloud icon shows sync status:

| State | Icon | Color | Meaning |
|---|---|---|---|
| `synced` | Plain cloud | `--fg-muted` | Normal, expected state. Invisible by design. |
| `syncing` | Cloud with arrows | `--fg-muted` (pulse) | Sync in progress. Subtle opacity pulse animation. |
| `error` | Cloud with `!` | `--error` | Needs attention. Toast notification appears. |
| `conflict` | Cloud with `!` | `--warning` | Diverged but handled safely. Conflict dialog auto-opens. |
| `idle`/`disconnected` | Cloud with slash | `--fg-muted` at 0.4 opacity | Very quiet. Not connected or no repo linked. |

Toast notifications fire for actionable issues:
- **Conflict**: "Your changes conflict with updates on GitHub. Click to resolve." → opens conflict dialog
- **Auth error**: "GitHub connection expired. Reconnect in Settings." → opens settings
- **Generic error**: Shows message with "Details" action → opens sync popover
- **Network error**: No toast — stays quiet, auto-retries next cycle

## GitHub Sync

Optional cloud backup via GitHub. Connect a GitHub account in Settings, link a repo, and Shoulders auto-syncs.

### Relevant Files

| File | Role |
|---|---|
| `src/services/githubSync.js` | Orchestration: `syncNow()`, `handleConflict()`, `classifyError()`, GitHub API helpers |
| `src-tauri/src/git.rs` | Rust: `git_push`, `git_fetch`, `git_pull_ff`, `git_merge_remote`, `git_ahead_behind`, `git_push_branch` |
| `src/services/git.js` | JS wrappers for all Rust git commands |
| `src/stores/workspace.js` | Sync timer, sync state, `autoSync()`, `syncNow()`, `fetchRemoteChanges()` |

### Sync Cycle (`syncNow()`)

Called after auto-commit and on Cmd+S. Follows a strict **fetch → check → pull/merge → push** order:

1. **Fetch** remote state (`git_fetch`)
2. **Check divergence** via `git_ahead_behind` — returns `{ ahead, behind }`
3. **If only behind** (someone else pushed, you didn't edit) → fast-forward pull. Most common case.
4. **If both ahead and behind** (diverged) → attempt `git_merge_remote`. If no textual conflicts, creates a merge commit automatically. If real conflicts exist, aborts and escalates.
5. **If ahead** (after pulling) → push local commits
6. **Mark synced** — clear error state, update timestamp

If no upstream exists yet (first push), does an initial push and returns.

### Error Classification

`classifyError(msg)` categorizes errors for UI routing:

| Type | Matches | UI Behavior |
|---|---|---|
| `auth` | "authentication", "401", "403", "reconnect" | Toast with "Reconnect in Settings" action |
| `network` | "resolve", "dns", "network", "could not connect" | Silent — auto-retries next cycle |
| `conflict` | "conflict", "diverged" | Conflict dialog auto-opens |
| `generic` | Everything else | Toast with "Details" action |

### Conflict Handling

When both local and remote have diverging changes that can't be auto-merged:

1. **Guard**: If already in conflict state with a branch, don't create another (prevents repeated branch creation on each sync cycle)
2. **Push to safe branch**: `shoulders/sync-YYYY-MM-DDTHH-MM` — user's work is never lost
3. **Set conflict state**: `syncState.status = 'conflict'`, `syncState.conflictBranch` set
4. **UI**: Conflict dialog auto-opens, footer icon turns warning color, toast notification appears

The conflict dialog guides the user:
- "Open GitHub" (primary action) — compare branches on GitHub
- "Refresh" — check if conflict is resolved, pull if so
- "What happened?" expandable section for details

### Auto-Merge (`git_merge_remote`)

Rust command that attempts a real git merge via `git2`:
1. Finds remote commit from `refs/remotes/{remote}/{branch}`
2. Calls `repo.merge()` with safe checkout (won't overwrite dirty files)
3. Checks `index.has_conflicts()` — if conflicts, aborts (hard reset to HEAD) and returns CONFLICT error
4. If clean, creates merge commit with user's git identity (from `git_set_user`)
5. Cleans up merge state files

This handles the common case: you edited file A, someone else edited file B. No human intervention needed.

### Sync Timer & Auto-Sync

Two separate timers drive sync:

1. **Auto-commit timer** (5-minute interval) — `workspace.autoCommit()` commits local changes, then calls `autoSync()` which runs the full `syncNow()` cycle (fetch → pull/merge → push).
2. **Sync timer** (5-minute interval) — `workspace.startSyncTimer()` calls `fetchRemoteChanges()` to check for and pull remote changes. Does NOT push.

Both started when GitHub is connected + repo is linked. Stopped on disconnect/unlink/cleanup.

### Authentication

GitHub OAuth tokens stored in OS keychain (`keyring` crate). The token is passed to all git2 operations via `make_callbacks()`:
```rust
fn make_callbacks(token: &str) -> RemoteCallbacks<'_> {
    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(move |_url, username, _allowed| {
        Cred::userpass_plaintext(username.unwrap_or("x-access-token"), token)
    });
    callbacks
}
```

### User Journeys

| Journey | What Happens | User Sees |
|---|---|---|
| Happy path (95%) | Auto-commit → fetch → push → synced | Nothing. Muted cloud icon. |
| Someone else pushed | Fetch → behind only → fast-forward pull → synced | Nothing. Silently catches up. |
| Both edited different files | Fetch → diverged → auto-merge → push → synced | Nothing. Merge handled automatically. |
| Both edited same lines | Fetch → diverged → merge fails → conflict branch | Conflict dialog with guidance. |
| Offline | Fetch fails silently | No alarm. Retries next cycle. |
| Auth expired | Push/fetch fails with 401/403 | Toast: "Reconnect in Settings." |

## Important Notes

1. **Git is via `git2` crate, not system git.** Vendored libgit2 + vendored OpenSSL. No PATH dependency. Adds ~1.5–2MB to binary — acceptable for HTTPS-everywhere without system dependencies.
2. **`git add -A` stages everything.** The `.gitignore` prevents `.shoulders/` and `node_modules/` from being committed. API keys live in `~/.shoulders/keys.env` (outside the workspace).
3. **Restore writes directly** via `invoke('write_file')` (text) or `invoke('write_file_base64')` (binary) rather than using `git checkout`, which was chosen for reliability.
4. **Auto-merge before escalation.** The sync system always tries `git_merge_remote` before creating a conflict branch. Only real textual conflicts (same lines edited) escalate.
5. **Conflict branches are created at most once.** `handleConflict()` guards against re-entry — if already in conflict state, it returns early instead of creating duplicate branches.
6. **Binary file support.** `git_show_file_base64` in Rust base64-encodes blob content, enabling version history for `.docx` and other binary formats.
