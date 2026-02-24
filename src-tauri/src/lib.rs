mod chat;
mod fs_commands;
mod git;
mod kernel;
mod latex;
mod pty;
mod typst_export;
mod usage_db;

/// Enable macOS spellcheck for WKWebView (must run before webview init)
#[cfg(target_os = "macos")]
fn enable_macos_spellcheck() {
    use objc2_foundation::{NSString, NSUserDefaults};
    let defaults = NSUserDefaults::standardUserDefaults();
    let key = NSString::from_str("WebContinuousSpellCheckingEnabled");
    defaults.setBool_forKey(true, &key);
}

/// Open the macOS Spelling & Grammar panel
#[cfg(target_os = "macos")]
#[tauri::command]
fn open_spelling_panel(app: tauri::AppHandle) -> Result<(), String> {
    use objc2_app_kit::NSSpellChecker;
    app.run_on_main_thread(move || {
        let mtm = objc2::MainThreadMarker::new().unwrap();
        let checker = NSSpellChecker::sharedSpellChecker();
        let panel = checker.spellingPanel(mtm);
        panel.makeKeyAndOrderFront(None);
    }).map_err(|e| format!("{:?}", e))?;
    Ok(())
}

/// Get spelling suggestions for a word via macOS NSSpellChecker
#[cfg(target_os = "macos")]
#[tauri::command]
fn spell_suggest(word: String) -> Vec<String> {
    use objc2_foundation::{NSRange, NSString};
    use objc2_app_kit::NSSpellChecker;

    let checker = NSSpellChecker::sharedSpellChecker();
    let ns_word = NSString::from_str(&word);

    // Check if misspelled (returns range of first error, length=0 means OK)
    let bad = checker.checkSpellingOfString_startingAt(&ns_word, 0);
    if bad.length == 0 {
        return vec![];
    }

    // Get suggestions
    let range = NSRange::new(0, ns_word.len());
    let guesses = checker.guessesForWordRange_inString_language_inSpellDocumentWithTag(
        range, &ns_word, None, 0,
    );

    match guesses {
        Some(arr) => {
            let mut out = Vec::new();
            for i in 0..arr.count() {
                let s = arr.objectAtIndex(i);
                out.push(s.to_string());
            }
            out
        }
        None => vec![],
    }
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn spell_suggest(_word: String) -> Vec<String> {
    vec![]
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn open_spelling_panel() -> Result<(), String> {
    Err("Spelling panel is only available on macOS".into())
}

const KEYRING_SERVICE: &str = "com.shoulders.editor";

const ALLOWED_KEYCHAIN_KEYS: &[&str] = &[
    "anthropic-key",
    "openai-key",
    "google-key",
    "auth-data",
    "github-token",
];

#[tauri::command]
fn keychain_get(key: String) -> Result<String, String> {
    if !ALLOWED_KEYCHAIN_KEYS.contains(&key.as_str()) {
        return Err(format!("Invalid keychain key: {}", key));
    }
    let entry = keyring::Entry::new(KEYRING_SERVICE, &key).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(val) => Ok(val),
        Err(keyring::Error::NoEntry) => Ok(String::new()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn keychain_set(key: String, value: String) -> Result<(), String> {
    if !ALLOWED_KEYCHAIN_KEYS.contains(&key.as_str()) {
        return Err(format!("Invalid keychain key: {}", key));
    }
    let entry = keyring::Entry::new(KEYRING_SERVICE, &key).map_err(|e| e.to_string())?;
    entry.set_password(&value).map_err(|e| e.to_string())
}

#[tauri::command]
fn keychain_delete(key: String) -> Result<(), String> {
    if !ALLOWED_KEYCHAIN_KEYS.contains(&key.as_str()) {
        return Err(format!("Invalid keychain key: {}", key));
    }
    let entry = keyring::Entry::new(KEYRING_SERVICE, &key).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

/// Enrich PATH with common tool locations so production .app bundles
/// can find Python, R, Jupyter, Homebrew binaries, etc.
#[cfg(unix)]
fn enrich_path() {
    let home = std::env::var("HOME").unwrap_or_default();
    let extra_paths = [
        "/opt/homebrew/bin",
        "/opt/homebrew/sbin",
        "/usr/local/bin",
        &format!("{}/.cargo/bin", home),
        &format!("{}/.pyenv/shims", home),
        &format!("{}/.local/bin", home),
        &format!("{}/miniconda3/bin", home),
        &format!("{}/miniforge3/bin", home),
        &format!("{}/anaconda3/bin", home),
        "/Library/TeX/texbin",
    ];
    let current = std::env::var("PATH").unwrap_or_default();
    let enriched = extra_paths.join(":") + ":" + &current;
    std::env::set_var("PATH", enriched);
}

pub fn run() {
    #[cfg(unix)]
    enrich_path();

    #[cfg(target_os = "macos")]
    enable_macos_spellcheck();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            #[cfg(desktop)]
            app.handle().plugin(
                tauri_plugin_updater::Builder::new().build()
            )?;
            Ok(())
        })
        .manage(pty::PtyState::default())
        .manage(fs_commands::WatcherState::default())
        .manage(chat::ChatState::default())
        .manage(kernel::KernelState::default())
        .manage(latex::LatexState::default())
        .manage(usage_db::UsageDbState::default())
        .invoke_handler(tauri::generate_handler![
            fs_commands::read_dir_recursive,
            fs_commands::read_file,
            fs_commands::read_file_base64,
            fs_commands::write_file,
            fs_commands::write_file_base64,
            fs_commands::create_file,
            fs_commands::create_dir,
            fs_commands::rename_path,
            fs_commands::delete_path,
            fs_commands::copy_file,
            fs_commands::copy_dir,
            fs_commands::is_directory,
            fs_commands::path_exists,
            fs_commands::watch_directory,
            fs_commands::unwatch_directory,
            fs_commands::proxy_api_call,
            git::git_clone,
            git::git_init,
            git::git_add_all,
            git::git_commit,
            git::git_status,
            git::git_branch,
            git::git_log,
            git::git_show_file,
            git::git_show_file_base64,
            git::git_diff,
            git::git_diff_stat,
            git::git_diff_summary,
            git::git_remote_add,
            git::git_remote_get_url,
            git::git_remote_remove,
            git::git_push,
            git::git_push_branch,
            git::git_fetch,
            git::git_ahead_behind,
            git::git_pull_ff,
            git::git_merge_remote,
            git::git_set_user,
            git::git_clone_authenticated,
            fs_commands::search_file_contents,
            fs_commands::run_shell_command,
            fs_commands::fetch_url_content,
            fs_commands::get_global_config_dir,
            pty::pty_spawn,
            pty::pty_write,
            pty::pty_resize,
            pty::pty_kill,
            chat::chat_stream,
            chat::chat_abort,
            chat::chat_cleanup,
            kernel::kernel_discover,
            kernel::kernel_launch,
            kernel::kernel_execute,
            kernel::kernel_interrupt,
            kernel::kernel_shutdown,
            kernel::kernel_complete,
            latex::compile_latex,
            latex::set_tectonic_enabled,
            latex::is_tectonic_enabled,
            latex::check_tectonic,
            latex::download_tectonic,
            latex::synctex_forward,
            latex::synctex_backward,
            typst_export::export_md_to_pdf,
            typst_export::is_typst_available,
            usage_db::usage_record,
            usage_db::usage_query_month,
            usage_db::usage_query_monthly_trend,
            usage_db::usage_query_daily_trend,
            usage_db::usage_get_setting,
            usage_db::usage_set_setting,
            keychain_get,
            keychain_set,
            keychain_delete,
            open_spelling_panel,
            spell_suggest,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
