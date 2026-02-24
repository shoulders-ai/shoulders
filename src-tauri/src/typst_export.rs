use pulldown_cmark::{Event, Options, Parser, Tag, TagEnd, HeadingLevel, CodeBlockKind};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportError {
    pub line: Option<u32>,
    pub message: String,
    pub severity: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportResult {
    pub success: bool,
    pub pdf_path: Option<String>,
    pub errors: Vec<ExportError>,
    pub warnings: Vec<ExportError>,
    pub duration_ms: u64,
}

/// PDF export settings passed from frontend
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PdfSettings {
    pub template: Option<String>,   // "clean", "academic", "report", "letter", "compact"
    pub font: Option<String>,       // font family name
    pub font_size: Option<f32>,     // in pt
    pub page_size: Option<String>,  // "a4", "us-letter", "a5"
    pub margins: Option<String>,    // "normal", "narrow", "wide"
    pub spacing: Option<String>,    // "compact", "normal", "relaxed"
    pub bib_style: Option<String>,  // "apa", "chicago", "ieee", "harvard", "vancouver"
}

/// 5-tier binary discovery for Typst (mirrors find_tectonic in latex.rs)
fn find_typst(app: &tauri::AppHandle) -> Option<String> {
    // 1. Bundled sidecar (production)
    if let Ok(exe) = std::env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            let sidecar = exe_dir.join("typst");
            if sidecar.exists() {
                return Some(sidecar.to_string_lossy().to_string());
            }
            let triple = current_target_triple();
            let sidecar_triple = exe_dir.join(format!("typst-{triple}"));
            if sidecar_triple.exists() {
                return Some(sidecar_triple.to_string_lossy().to_string());
            }
        }
    }

    // 2. Resource dir (Tauri v2 bundled resources)
    if let Ok(resource_dir) = app.path().resource_dir() {
        let sidecar = resource_dir.join("binaries").join("typst");
        if sidecar.exists() {
            return Some(sidecar.to_string_lossy().to_string());
        }
    }

    // 3. Dev mode: src-tauri/binaries/
    if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
        let triple = current_target_triple();
        let dev_path = Path::new(&manifest_dir)
            .join("binaries")
            .join(format!("typst-{triple}"));
        if dev_path.exists() {
            return Some(dev_path.to_string_lossy().to_string());
        }
    }

    // 4. Common system install locations
    let candidates = [
        "/opt/homebrew/bin/typst",
        "/usr/local/bin/typst",
        "/usr/bin/typst",
    ];
    for path in &candidates {
        if Path::new(path).exists() {
            return Some(path.to_string());
        }
    }
    if let Ok(home) = std::env::var("HOME") {
        let cargo_path = format!("{home}/.cargo/bin/typst");
        if Path::new(&cargo_path).exists() {
            return Some(cargo_path);
        }
    }

    // 5. Shell lookup fallback
    #[cfg(unix)]
    {
        let output = Command::new("/bin/bash")
            .args(&["-lc", "which typst"])
            .output()
            .ok()?;
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                return Some(path);
            }
        }
    }
    #[cfg(windows)]
    {
        let output = Command::new("where")
            .arg("typst")
            .output()
            .ok()?;
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout)
                .lines().next()?.trim().to_string();
            if !path.is_empty() {
                return Some(path);
            }
        }
    }

    None
}

/// Find the bundled fonts directory (for --font-path)
fn find_font_dir(app: &tauri::AppHandle) -> Option<String> {
    // 1. Dev mode: public/fonts/ relative to CARGO_MANIFEST_DIR (src-tauri/)
    if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
        let dev_fonts = Path::new(&manifest_dir).join("..").join("public").join("fonts");
        if dev_fonts.is_dir() {
            if let Ok(canonical) = dev_fonts.canonicalize() {
                return Some(canonical.to_string_lossy().to_string());
            }
        }
    }

    // 2. Production: resource dir (fonts placed by bundle.resources)
    if let Ok(resource_dir) = app.path().resource_dir() {
        let fonts_dir = resource_dir.join("fonts");
        if fonts_dir.is_dir() {
            return Some(fonts_dir.to_string_lossy().to_string());
        }
        // Fallback: files directly in resource dir
        if resource_dir.join("Lora-VariableFont_wght.ttf").exists() {
            return Some(resource_dir.to_string_lossy().to_string());
        }
    }

    None
}

fn current_target_triple() -> String {
    let arch = if cfg!(target_arch = "aarch64") { "aarch64" }
               else if cfg!(target_arch = "x86_64") { "x86_64" }
               else { "unknown" };
    let os = if cfg!(target_os = "macos") { "apple-darwin" }
             else if cfg!(target_os = "linux") { "unknown-linux-gnu" }
             else if cfg!(target_os = "windows") { "pc-windows-msvc" }
             else { "unknown" };
    format!("{arch}-{os}")
}

/// Convert markdown to Typst markup using pulldown-cmark.
fn markdown_to_typst(markdown: &str) -> String {
    // Pre-process: convert Pandoc citations BEFORE parsing, because pulldown-cmark
    // consumes the [] brackets and the citation pattern is lost.
    let preprocessed = preprocess_citations(markdown);

    let mut opts = Options::empty();
    opts.insert(Options::ENABLE_TABLES);
    opts.insert(Options::ENABLE_FOOTNOTES);
    opts.insert(Options::ENABLE_STRIKETHROUGH);
    opts.insert(Options::ENABLE_MATH);

    let parser = Parser::new_ext(&preprocessed, opts);
    let mut output = String::new();
    let mut list_stack: Vec<Option<u64>> = Vec::new(); // None = unordered, Some(n) = ordered
    #[allow(unused_assignments)]
    let mut table_cols: usize = 0;
    let mut _table_header = false;
    let mut _table_cell_count: usize = 0;
    let mut in_code_block = false;
    let mut code_lang = String::new();
    let mut code_buf = String::new();

    for event in parser {
        match event {
            Event::Start(tag) => match tag {
                Tag::Heading { level, .. } => {
                    let marker = match level {
                        HeadingLevel::H1 => "= ",
                        HeadingLevel::H2 => "== ",
                        HeadingLevel::H3 => "=== ",
                        HeadingLevel::H4 => "==== ",
                        HeadingLevel::H5 => "===== ",
                        HeadingLevel::H6 => "====== ",
                    };
                    output.push_str(marker);
                }
                Tag::Paragraph => {
                    // Start new paragraph (blank line before, unless at start)
                    if !output.is_empty() && !output.ends_with('\n') {
                        output.push('\n');
                    }
                }
                Tag::BlockQuote(_) => {
                    output.push_str("#quote[\n");
                }
                Tag::CodeBlock(kind) => {
                    in_code_block = true;
                    code_buf.clear();
                    code_lang = match kind {
                        CodeBlockKind::Fenced(lang) => {
                            let s = lang.to_string();
                            // Handle Rmd/Quarto chunk syntax: ```{r, options} → r
                            if s.starts_with('{') {
                                s.trim_start_matches('{')
                                    .trim_end_matches('}')
                                    .split(',')
                                    .next()
                                    .unwrap_or("")
                                    .trim()
                                    .to_string()
                            } else {
                                s
                            }
                        }
                        CodeBlockKind::Indented => String::new(),
                    };
                }
                Tag::List(start) => {
                    list_stack.push(start);
                }
                Tag::Item => {
                    let indent = "  ".repeat(list_stack.len().saturating_sub(1));
                    match list_stack.last() {
                        Some(Some(n)) => {
                            output.push_str(&format!("{}{}. ", indent, n));
                            // Increment counter
                            if let Some(Some(ref mut n)) = list_stack.last_mut() {
                                *n += 1;
                            }
                        }
                        _ => {
                            output.push_str(&format!("{}- ", indent));
                        }
                    }
                }
                Tag::Emphasis => {
                    output.push('_');
                }
                Tag::Strong => {
                    output.push('*');
                }
                Tag::Strikethrough => {
                    output.push_str("#strike[");
                }
                Tag::Link { dest_url, title: _, .. } => {
                    // We'll collect link text, then close with URL
                    output.push_str(&format!("#link(\"{}\")[", escape_typst_string(&dest_url)));
                }
                Tag::Image { dest_url, title: _, .. } => {
                    output.push_str(&format!("#image(\"{}\")", escape_typst_string(&dest_url)));
                }
                Tag::Table(alignments) => {
                    table_cols = alignments.len();
                    let cols = alignments.iter().map(|a| match a {
                        pulldown_cmark::Alignment::Left => "left",
                        pulldown_cmark::Alignment::Center => "center",
                        pulldown_cmark::Alignment::Right => "right",
                        pulldown_cmark::Alignment::None => "auto",
                    }).collect::<Vec<_>>().join(", ");
                    output.push_str(&format!("#table(\n  columns: ({}),\n",
                        "1fr, ".repeat(table_cols).trim_end_matches(", ")));
                    output.push_str(&format!("  align: ({}),\n", cols));
                }
                Tag::TableHead => {
                    _table_header = true;
                    _table_cell_count = 0;
                }
                Tag::TableRow => {
                    _table_cell_count = 0;
                }
                Tag::TableCell => {
                    output.push_str("  [");
                }
                _ => {}
            },
            Event::End(tag) => match tag {
                TagEnd::Heading(_) => {
                    output.push('\n');
                }
                TagEnd::Paragraph => {
                    output.push_str("\n\n");
                }
                TagEnd::BlockQuote(_) => {
                    output.push_str("]\n\n");
                }
                TagEnd::CodeBlock => {
                    in_code_block = false;
                    if code_lang.is_empty() {
                        output.push_str(&format!("```\n{}\n```\n\n", code_buf.trim_end()));
                    } else {
                        output.push_str(&format!("```{}\n{}\n```\n\n", code_lang, code_buf.trim_end()));
                    }
                }
                TagEnd::List(_) => {
                    list_stack.pop();
                    if list_stack.is_empty() {
                        output.push('\n');
                    }
                }
                TagEnd::Item => {
                    if !output.ends_with('\n') {
                        output.push('\n');
                    }
                }
                TagEnd::Emphasis => {
                    output.push('_');
                }
                TagEnd::Strong => {
                    output.push('*');
                }
                TagEnd::Strikethrough => {
                    output.push(']');
                }
                TagEnd::Link => {
                    output.push(']');
                }
                TagEnd::Image => {}
                TagEnd::Table => {
                    output.push_str(")\n\n");
                }
                TagEnd::TableHead => {
                    _table_header = false;
                }
                TagEnd::TableRow => {}
                TagEnd::TableCell => {
                    _table_cell_count += 1;
                    output.push_str("],\n");
                }
                _ => {}
            },
            Event::Text(text) => {
                if in_code_block {
                    code_buf.push_str(&text);
                } else {
                    // Escape $ signs in non-math text — Typst treats $ as math delimiter
                    let escaped = text.replace('$', "\\$");
                    output.push_str(&escaped);
                }
            }
            Event::Code(code) => {
                output.push('`');
                output.push_str(&code);
                output.push('`');
            }
            Event::InlineMath(math) => {
                output.push('$');
                output.push_str(&math);
                output.push('$');
            }
            Event::DisplayMath(math) => {
                output.push_str("$ ");
                output.push_str(&math);
                output.push_str(" $\n");
            }
            Event::Html(html) => {
                // Pass through as raw Typst comment
                output.push_str(&format!("// HTML: {}\n", html.trim()));
            }
            Event::SoftBreak => {
                output.push('\n');
            }
            Event::HardBreak => {
                output.push_str(" \\\n");
            }
            Event::Rule => {
                output.push_str("#line(length: 100%)\n\n");
            }
            Event::FootnoteReference(name) => {
                output.push_str(&format!("#footnote[{}]", name));
            }
            Event::TaskListMarker(checked) => {
                if checked {
                    output.push_str("[x] ");
                } else {
                    output.push_str("[ ] ");
                }
            }
            _ => {}
        }
    }

    output
}

/// Pre-process raw markdown to convert Pandoc citations to Typst citations
/// BEFORE pulldown-cmark parses it (the parser eats the brackets).
/// `[@key]` → `@key`, `[@k1; @k2]` → `@k1 @k2`
/// Skips fenced code blocks and inline code.
fn preprocess_citations(markdown: &str) -> String {
    let mut result = String::with_capacity(markdown.len());
    let mut in_code_fence = false;

    for line in markdown.lines() {
        let trimmed = line.trim_start();
        if trimmed.starts_with("```") || trimmed.starts_with("~~~") {
            in_code_fence = !in_code_fence;
            result.push_str(line);
            result.push('\n');
            continue;
        }
        if in_code_fence {
            result.push_str(line);
            result.push('\n');
            continue;
        }

        let chars: Vec<char> = line.chars().collect();
        let mut i = 0;
        while i < chars.len() {
            // Skip inline code
            if chars[i] == '`' {
                result.push('`');
                i += 1;
                while i < chars.len() && chars[i] != '`' {
                    result.push(chars[i]);
                    i += 1;
                }
                if i < chars.len() {
                    result.push('`');
                    i += 1;
                }
                continue;
            }

            if i + 1 < chars.len() && chars[i] == '[' && chars[i + 1] == '@' {
                let start = i;
                i += 1; // skip [
                let mut buf = String::new();
                while i < chars.len() && chars[i] != ']' {
                    buf.push(chars[i]);
                    i += 1;
                }
                if i < chars.len() && chars[i] == ']' {
                    i += 1; // skip ]
                    let mut keys = Vec::new();
                    for part in buf.split(';') {
                        let part = part.trim();
                        if let Some(key) = part.strip_prefix('@') {
                            let key = key.split_whitespace().next().unwrap_or(key);
                            if !key.is_empty() {
                                keys.push(key.to_string());
                            }
                        }
                    }
                    if !keys.is_empty() {
                        for (j, key) in keys.iter().enumerate() {
                            if j > 0 { result.push(' '); }
                            result.push('@');
                            result.push_str(key);
                        }
                    } else {
                        for c in &chars[start..i] {
                            result.push(*c);
                        }
                    }
                } else {
                    for c in &chars[start..chars.len()] {
                        result.push(*c);
                    }
                    break;
                }
            } else {
                result.push(chars[i]);
                i += 1;
            }
        }
        result.push('\n');
    }

    // Preserve original trailing newline state
    if result.ends_with('\n') && !markdown.ends_with('\n') {
        result.pop();
    }

    result
}

fn escape_typst_string(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"")
}

/// Wrap converted content in a Typst template.
fn wrap_in_template(content: &str, bib_path: Option<&str>, settings: &PdfSettings) -> String {
    let template = settings.template.as_deref().unwrap_or("clean");
    let font = escape_typst_string(settings.font.as_deref().unwrap_or("STIX Two Text"));
    let font_size = settings.font_size.unwrap_or(11.0);
    let page_size = settings.page_size.as_deref().unwrap_or("a4");
    let margins = settings.margins.as_deref().unwrap_or("normal");
    let spacing = settings.spacing.as_deref().unwrap_or("normal");

    let page_setting = match page_size {
        "us-letter" => "\"us-letter\"",
        "a5" => "\"a5\"",
        _ => "\"a4\"",
    };
    let margin_setting = match margins {
        "narrow" => "(x: 1.5cm, y: 1.5cm)",
        "wide" => "(x: 3.5cm, y: 3.5cm)",
        _ => "(x: 2.5cm, y: 2.5cm)", // normal
    };

    let mut doc = String::new();

    match template {
        "academic" => {
            doc.push_str(&format!(
r#"#set page(paper: {page_setting}, margin: {margin_setting})
#set text(font: "{font}", size: {font_size}pt)
#set par(justify: true, leading: 0.55em, first-line-indent: 1em)
#set heading(numbering: "1.1  ")
#show heading.where(level: 1): it => {{ v(1em); text(size: 1.3em, weight: "bold", it); v(0.5em) }}
#show heading.where(level: 2): it => {{ v(0.8em); text(size: 1.1em, weight: "bold", it); v(0.4em) }}

"#));
        }
        "report" => {
            doc.push_str(&format!(
r#"#set page(paper: {page_setting}, margin: {margin_setting}, numbering: "1")
#set text(font: "{font}", size: {font_size}pt)
#set par(justify: true, leading: 0.65em)
#set heading(numbering: "1.1  ")
#show heading.where(level: 1): it => {{ pagebreak(weak: true); v(2em); text(size: 1.5em, weight: "bold", it); v(1em) }}

"#));
        }
        "letter" => {
            doc.push_str(&format!(
r#"#set page(paper: {page_setting}, margin: (x: 2.5cm, top: 2.5cm, bottom: 2cm))
#set text(font: "{font}", size: {font_size}pt)
#set par(justify: false, leading: 0.65em)
#set heading(numbering: none)

"#));
        }
        "compact" => {
            doc.push_str(&format!(
r#"#set page(paper: {page_setting}, margin: (x: 1.5cm, y: 1.5cm), columns: 2)
#set text(font: "{font}", size: 9pt)
#set par(justify: true, leading: 0.5em)
#set heading(numbering: none)
#show heading.where(level: 1): it => {{ text(size: 1.2em, weight: "bold", it); v(0.3em) }}

"#));
        }
        _ => {
            // "clean" — the default
            doc.push_str(&format!(
r#"#set page(paper: {page_setting}, margin: {margin_setting})
#set text(font: "{font}", size: {font_size}pt)
#set par(justify: true, leading: 0.65em)
#set heading(numbering: none)

"#));
        }
    }

    // Paragraph spacing — par(spacing) controls gap between paragraphs
    let spacing_val = match spacing {
        "compact" => "0.8em",
        "relaxed" => "2.4em",
        _ => "1.8em", // normal
    };
    doc.push_str(&format!("#set par(spacing: {})\n\n", spacing_val));

    if bib_path.is_some() {
        let style = match settings.bib_style.as_deref().unwrap_or("apa") {
            "chicago" => "chicago-author-date",
            "ieee" => "ieee",
            "harvard" => "elsevier-harvard",
            "vancouver" => "vancouver",
            other => other, // "apa" or custom CSL path
        };
        doc.push_str(&format!("#set bibliography(style: \"{}\")\n\n", escape_typst_string(style)));
    }

    doc.push_str(content);

    if let Some(bib) = bib_path {
        doc.push_str(&format!("\n\n#bibliography(\"{}\")\n", bib));
    }

    doc
}

fn parse_typst_output(stderr: &str) -> (Vec<ExportError>, Vec<ExportError>) {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    for line in stderr.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("error:") {
            let msg = trimmed.strip_prefix("error:").unwrap_or(trimmed).trim();
            let (line_num, message) = extract_line_info(msg);
            errors.push(ExportError {
                line: line_num,
                message: message.to_string(),
                severity: "error".to_string(),
            });
        } else if trimmed.starts_with("warning:") {
            let msg = trimmed.strip_prefix("warning:").unwrap_or(trimmed).trim();
            let (line_num, message) = extract_line_info(msg);
            warnings.push(ExportError {
                line: line_num,
                message: message.to_string(),
                severity: "warning".to_string(),
            });
        }
    }

    (errors, warnings)
}

fn extract_line_info(msg: &str) -> (Option<u32>, &str) {
    // Try to extract line number from patterns like "at line 42" or ":42:"
    if let Some(idx) = msg.find(":") {
        let after = &msg[idx + 1..];
        if let Some(end) = after.find(|c: char| !c.is_ascii_digit()) {
            if end > 0 {
                if let Ok(n) = after[..end].parse::<u32>() {
                    return (Some(n), msg);
                }
            }
        }
    }
    (None, msg)
}

#[tauri::command]
pub async fn export_md_to_pdf(
    md_path: String,
    bib_path: Option<String>,
    settings: Option<PdfSettings>,
    app: tauri::AppHandle,
) -> Result<ExportResult, String> {
    let settings = settings.unwrap_or_default();
    let typst_bin = find_typst(&app)
        .ok_or_else(|| "Typst not found. Install with: brew install typst".to_string())?;

    let start = std::time::Instant::now();

    // Read markdown file
    let md_content = std::fs::read_to_string(&md_path)
        .map_err(|e| format!("Failed to read {}: {}", md_path, e))?;

    // Convert to Typst
    let typst_content = markdown_to_typst(&md_content);

    // Only include bibliography if the document actually cites references
    // and the bib file has real entries
    let doc_has_citations = md_content.contains("[@");
    let effective_bib: Option<String> = if !doc_has_citations {
        None
    } else {
        bib_path.as_deref().and_then(|bp| {
            if let Ok(content) = std::fs::read_to_string(bp) {
                // Skip if the file is empty or only has comments
                let has_entries = content.lines().any(|l| l.trim_start().starts_with('@'));
                if has_entries {
                    // Use just the filename — Typst resolves relative to cwd (the .md dir)
                    let filename = Path::new(bp).file_name()?.to_string_lossy().to_string();
                    return Some(filename);
                }
            }
            None
        })
    };
    let full_doc = wrap_in_template(&typst_content, effective_bib.as_deref(), &settings);

    // Write temporary .typ file next to .md
    let md_pathbuf = std::path::PathBuf::from(&md_path);
    let typ_path = md_pathbuf.with_extension("typ");
    let pdf_path = md_pathbuf.with_extension("pdf");

    std::fs::write(&typ_path, &full_doc)
        .map_err(|e| format!("Failed to write .typ: {}", e))?;

    // If bib_path provided, copy it next to .typ for Typst to find
    // (Typst resolves bibliography paths relative to the .typ file)

    // Run typst compile
    let mut cmd = Command::new(&typst_bin);
    cmd.arg("compile");
    if let Some(font_dir) = find_font_dir(&app) {
        cmd.args(&["--font-path", &font_dir]);
    }
    cmd.args(&[&*typ_path.to_string_lossy(), &*pdf_path.to_string_lossy()]);
    cmd.current_dir(md_pathbuf.parent().unwrap_or(Path::new(".")));
    let output = cmd.output()
        .map_err(|e| format!("Failed to run typst: {}", e))?;

    let duration_ms = start.elapsed().as_millis() as u64;
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let (errors, warnings) = parse_typst_output(&stderr);

    // Clean up .typ file
    let _ = std::fs::remove_file(&typ_path);

    if output.status.success() {
        Ok(ExportResult {
            success: true,
            pdf_path: Some(pdf_path.to_string_lossy().to_string()),
            errors: vec![],
            warnings,
            duration_ms,
        })
    } else {
        Ok(ExportResult {
            success: false,
            pdf_path: None,
            errors: if errors.is_empty() {
                vec![ExportError {
                    line: None,
                    message: stderr.clone(),
                    severity: "error".to_string(),
                }]
            } else {
                errors
            },
            warnings,
            duration_ms,
        })
    }
}

#[tauri::command]
pub async fn is_typst_available(app: tauri::AppHandle) -> Result<bool, String> {
    Ok(find_typst(&app).is_some())
}
