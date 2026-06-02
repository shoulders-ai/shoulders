// ─── Cross-platform path helpers ────────────────────────────────────
//
// The Rust backend emits forward-slash paths on every platform (see
// fs_commands.rs `norm_path`), and `workspace.path` is normalized to forward
// slashes in the workspace store. These helpers keep the rest of the frontend
// on that single convention so paths compare and key consistently on Windows
// (drive letters, "\" separators) as well as POSIX. Windows fs APIs and
// libgit2 both accept "/", so emitting "/" is always safe.

/** Convert backslash separators to forward slashes. */
export function toForwardSlash(p) {
  return typeof p === "string" ? p.replace(/\\/g, "/") : p;
}

/**
 * True if `p` (any separator) is an absolute path: POSIX "/...", a Windows
 * drive path ("C:\..." / "C:/..."), or a UNC path ("\\host" / "//host").
 */
export function isAbsolutePath(p) {
  if (!p) return false;
  return /^\//.test(p) || /^[a-zA-Z]:[\\/]/.test(p) || /^\\\\/.test(p);
}

/**
 * Collapse "." / ".." segments while preserving the path root.
 * Roots: POSIX "/", Windows drive "C:", or UNC "//host". Always returns a
 * forward-slash path.
 */
export function canonicalize(path) {
  const p = toForwardSlash(path);

  // UNC: keep the leading "//" prefix.
  if (p.startsWith("//")) {
    const out = [];
    for (const part of p.slice(2).split("/")) {
      if (part === "..") out.pop();
      else if (part !== "." && part !== "") out.push(part);
    }
    return "//" + out.join("/");
  }

  const driveMatch = p.match(/^[a-zA-Z]:/);
  const drive = driveMatch ? driveMatch[0] : "";
  const out = [];
  for (const part of (drive ? p.slice(drive.length) : p).split("/")) {
    if (part === "..") out.pop();
    else if (part !== "." && part !== "") out.push(part);
  }
  return drive ? drive + "/" + out.join("/") : "/" + out.join("/");
}

/**
 * Resolve a (possibly relative) path against the workspace root AND verify it
 * stays inside the workspace. Returns a forward-slash absolute path, or null
 * if `base` is missing or the path escapes the workspace.
 *
 * Use this for any path that comes from an untrusted source (e.g. AI tool
 * calls) and must be confined to the workspace.
 */
export function resolveWorkspacePath(p, base) {
  if (!base) return null;
  const root = canonicalize(toForwardSlash(base).replace(/\/+$/, ""));
  if (!p) return root;

  const cand = toForwardSlash(p);
  // Absolute = POSIX "/...", Windows drive "C:/...", or UNC "//host/...".
  const abs = /^\//.test(cand) || /^[a-zA-Z]:\//.test(cand);
  const resolved = canonicalize(abs ? cand : root + "/" + cand);

  // Windows paths are case-insensitive; detect via a drive-letter prefix.
  const ci = /^[a-zA-Z]:/.test(root);
  const a = ci ? resolved.toLowerCase() : resolved;
  const b = ci ? root.toLowerCase() : root;

  // Must be the workspace root itself or strictly within it (the trailing
  // "/" guard stops "/proj" from matching "/proj-evil").
  if (a !== b && !a.startsWith(b + "/")) return null;

  // Adopt the workspace root's canonical casing for the in-root prefix so map
  // keys (fileContents, pendingEdits) stay consistent with the OS-cased file
  // tree regardless of how the caller cased the drive/segments on Windows.
  return root + resolved.slice(root.length);
}

/**
 * Resolve a (possibly relative) path against a base directory WITHOUT a
 * containment check. For opening / displaying / exporting paths that may
 * legitimately point outside the workspace. Returns a forward-slash path.
 * Passes falsy input through unchanged.
 */
export function resolveAbsPath(p, base) {
  if (!p) return p;
  const cand = toForwardSlash(p);
  if (isAbsolutePath(cand)) return cand;
  return toForwardSlash(base || "").replace(/\/+$/, "") + "/" + cand;
}
