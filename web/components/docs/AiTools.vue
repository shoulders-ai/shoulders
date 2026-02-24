<template>
  <div>
    <h1>Tools & Review</h1>
    <p class="docs-subtitle">What the AI can do in your workspace, and how to review its changes.</p>

    <h2>What the AI can do</h2>
    <p>
      The AI chat has access to 28 tools, organised in five categories. Each tool can be
      individually enabled or disabled in Settings → Tools.
    </p>
    <table class="docs-table">
      <thead>
        <tr>
          <th>Category</th>
          <th>Tools</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Workspace</td>
          <td>Read files, write files, edit files, search content, list files, create/rename/move/duplicate/delete files, run commands</td>
        </tr>
        <tr>
          <td>References</td>
          <td>Search references, get reference details, add reference (DOI lookup), insert citation, edit reference</td>
        </tr>
        <tr>
          <td>Feedback</td>
          <td>Add comments, read comments, create proposals</td>
        </tr>
        <tr>
          <td>Notebooks</td>
          <td>Read notebook, edit cell, run cell, run all cells, add cell, delete cell</td>
        </tr>
        <tr>
          <td>Web research</td>
          <td>Web search, academic paper search, fetch URL content</td>
        </tr>
      </tbody>
    </table>

    <DocsCallout type="note">
      Web research tools transmit data to third-party services beyond your AI provider. They
      are clearly labelled as external in Settings. A single "Disable all external tools" toggle
      removes all three at once.
    </DocsCallout>

    <h2>Reviewing AI changes</h2>
    <p>
      When the AI modifies a file — through the chat, a comment thread proposal, or an external
      tool like Claude Code — the change is applied to disk immediately but also recorded for
      review. The change appears as an inline diff in the editor:
    </p>
    <ul>
      <li><strong>Text edits</strong> — the old text has a red strikethrough, the new text
        appears in green next to it. Accept (checkmark) and reject (X) buttons are inline.</li>
      <li><strong>Full file writes</strong> — a merge view shows the old and new content
        side by side.</li>
    </ul>
    <p>
      A review bar above the editor shows the total count of pending changes for the active file,
      with "Keep All" and "Revert All" buttons.
    </p>
    <ul>
      <li><strong>Accept</strong> — acknowledges the change. The diff decoration is removed.
        The file stays as-is (the change was already applied).</li>
      <li><strong>Reject</strong> — reverts the file to its pre-edit content. The change is
        undone on disk.</li>
    </ul>

    <h2>Direct mode</h2>
    <p>
      By default, Shoulders runs in <strong>Review mode</strong> — all AI edits are shown as
      inline diffs for you to accept or reject. If you prefer to let edits go through without
      review, toggle to <strong>Direct mode</strong> in the footer bar.
    </p>
    <p>
      Direct mode is useful for rapid iteration when you trust the AI's changes and want to
      skip the review step. You can switch between modes at any time.
    </p>

    <h2>Notebook cell review</h2>
    <p>
      AI edits to notebook cells also go through the review system:
    </p>
    <ul>
      <li><strong>Edit cell</strong> — yellow border, inline view of old vs. new source.</li>
      <li><strong>Add cell</strong> — green border, phantom cell appears at the insertion point.</li>
      <li><strong>Delete cell</strong> — red border, cell is dimmed.</li>
    </ul>
    <p>
      Accept writes the change. Reject restores the previous state.
    </p>

    <h2>Managing tool permissions</h2>
    <p>
      Go to Settings (<kbd>Cmd/Ctrl</kbd>+<kbd>,</kbd>) → Tools to see all 28 tools with their
      descriptions. Toggle individual tools on or off. Disabled tools are removed from the AI's
      definitions entirely — it cannot see or use them.
    </p>
    <p>
      See <a href="/docs?section=ai-setup">Setup → Privacy controls</a> for more on controlling
      what the AI can access.
    </p>

    <h2>Claude Code integration</h2>
    <p>
      If you use <a href="https://docs.anthropic.com/en/docs/claude-code" target="_blank" rel="noopener">Claude Code</a>
      (Anthropic's command-line AI agent) in the same workspace, Shoulders can intercept its file
      edits and route them through the review system. The intercept hook is auto-installed in your
      workspace when you open it — no manual configuration needed.
    </p>
    <p>
      Claude Code edits go through immediately (the agent does not wait for your review), but
      they appear as inline diffs in the editor. You can accept or reject them at any time.
    </p>
  </div>
</template>
