<template>
  <div>
    <h1>Navigation & Settings</h1>
    <p class="docs-subtitle">Quick Open, the file tree, version history, themes, and workspace configuration.</p>

    <h2>Quick Open</h2>
    <p>
      <kbd>Cmd/Ctrl</kbd>+<kbd>P</kbd> is the fastest way to get anywhere. It opens a search
      bar in the header with three modes in one interface:
    </p>
    <ul>
      <li><strong>File names</strong> — start typing a filename for instant fuzzy matching.
        Results are ranked by relevance.</li>
      <li><strong>File contents</strong> — a full-text search runs across your entire workspace,
        showing filenames, line numbers, and matching text.</li>
      <li><strong>References</strong> — citation keys, titles, and author names from your
        reference library appear in results. Selecting a reference inserts <code>[@key]</code>
        at the cursor.</li>
    </ul>

    <h2>The file tree</h2>
    <p>
      The left sidebar shows a directory tree of your workspace. Click files to open them.
      Expand and collapse folders. The active file is highlighted.
    </p>
    <p>
      Create new files with the <strong>+</strong> button at the top, or right-click for options
      (new document, new file with a custom name, new notebook, new folder). Rename a file by
      double-clicking it or pressing <kbd>Enter</kbd>. Drag files between folders to move them.
    </p>
    <p>
      Press <kbd>Cmd/Ctrl</kbd>+<kbd>F</kbd> with the sidebar focused to filter the tree by name.
    </p>

    <h2>Version history</h2>
    <p>
      Shoulders automatically tracks the version history of your workspace. Every
      change is versioned from the start.
    </p>
    <ul>
      <li><strong>Auto-save</strong> — every 5 minutes, all changes are saved as a new version silently
        in the background. This is an invisible safety net.</li>
      <li><strong>Manual checkpoint</strong> — <kbd>Cmd/Ctrl</kbd>+<kbd>S</kbd> saves the file
        and creates a version checkpoint immediately.</li>
    </ul>
    <p>
      To browse or restore previous versions, right-click any file in the tree and select
      <strong>Version History</strong>. A panel shows every version that touched that file.
      Select a version to preview it, then click <strong>Restore</strong> to revert. Restoration
      is non-destructive — the current version remains in history.
    </p>

    <DocsCallout type="tip">
      Auto-save (writing the file to disk) happens one second after you stop typing.
      <kbd>Cmd/Ctrl</kbd>+<kbd>S</kbd> does more: it also creates a named checkpoint in your
      version history.
    </DocsCallout>

    <h2>Backing up to GitHub</h2>
    <p>
      You can connect your workspace to a GitHub repository to back up your work and sync it
      across devices. This is entirely optional.
    </p>
    <ul>
      <li><strong>Connect</strong> — go to Settings (<kbd>Cmd/Ctrl</kbd>+<kbd>,</kbd>) → GitHub to link
        your account and repository.</li>
      <li><strong>Automatic Sync</strong> — once connected, Shoulders automatically synchronises
        your changes to GitHub in the background.</li>
      <li><strong>Sync Status</strong> — a cloud icon in the footer shows your sync status. If
        there is a conflict (e.g., you edited the same file on two different computers), a dialog
        will help you choose which version to keep.</li>
    </ul>

    <h2>Themes</h2>
    <p>
      Shoulders includes eight colour themes. The theme applies to the entire interface — editor,
      sidebars, terminal, modals.
    </p>
    <ul>
      <li><strong>Tokyo Night</strong> (default) — dark with blue-purple accents.</li>
      <li><strong>Light</strong> — light background with cadet blue accents.</li>
      <li><strong>Monokai</strong> — classic dark with warm accents.</li>
      <li><strong>Nord</strong> — polar night dark with frost blue.</li>
      <li><strong>Solarized</strong> — Ethan Schoonover's dark solarised palette.</li>
      <li><strong>Humane</strong> — warm-toned dark theme.</li>
      <li><strong>One Light</strong> — Atom-inspired light theme.</li>
      <li><strong>Dracula</strong> — dark with pink-purple accents.</li>
    </ul>
    <p>
      Change the theme in Settings (<kbd>Cmd/Ctrl</kbd>+<kbd>,</kbd>) → Theme. The choice persists
      across sessions.
    </p>

    <h2>External changes</h2>
    <p>
      If files in your workspace are modified outside of Shoulders — by another editor, a git
      operation, or a sync tool — the file tree refreshes and open editors reload automatically.
    </p>
  </div>
</template>
