<template>
  <div>
    <h1>Getting Started</h1>
    <p class="docs-subtitle">Download Shoulders, open a folder, and start writing.</p>

    <h2>Install</h2>
    <p>
      Shoulders is a desktop application. Download the latest version from
      the <a href="/download">download page</a> for macOS, Windows, or Linux.
      It installs as a single native binary — no runtime dependencies.
    </p>
    <p>
      On macOS, drag the app to your Applications folder and open it. On first launch,
      macOS may ask you to confirm since the app is downloaded from the internet.
      Right-click the app and select "Open" to bypass Gatekeeper.
    </p>

    <h2>Open a workspace</h2>
    <p>
      A workspace in Shoulders is just a folder. There is no proprietary project format,
      no database, no import step. Open any folder on your filesystem, and that folder
      becomes your workspace.
    </p>
    <div class="docs-steps">
      <div class="docs-step">
        <span class="docs-step-number">1</span>
        <div class="docs-step-content">
          Launch Shoulders. You will see the launcher screen with an <strong>Open Folder</strong> button.
        </div>
      </div>
      <div class="docs-step">
        <span class="docs-step-number">2</span>
        <div class="docs-step-content">
          Click it and select any folder — an existing project, a new empty directory, whatever you like.
        </div>
      </div>
      <div class="docs-step">
        <span class="docs-step-number">3</span>
        <div class="docs-step-content">
          The folder opens as your workspace. Every file inside it appears in the sidebar.
        </div>
      </div>
    </div>

    <DocsCallout type="tip">
      You can also clone an existing repository from the launcher screen. Shoulders tracks
      version history automatically when you open a workspace — every change is versioned from the start.
    </DocsCallout>

    <h2>The interface</h2>
    <p>
      The layout has three regions. All three are resizable and collapsible.
    </p>
    <ul>
      <li><strong>Left sidebar</strong> — file explorer and reference library. Toggle with <kbd>Cmd/Ctrl</kbd>+<kbd>B</kbd>.</li>
      <li><strong>Centre</strong> — the editor area. Supports multiple tabs and split panes.</li>
      <li><strong>Right sidebar</strong> — AI chat, terminals, comment threads, and backlinks. Toggle with <kbd>Cmd/Ctrl</kbd>+<kbd>J</kbd>.</li>
    </ul>
    <p>
      The footer bar shows the current git branch, review/direct mode toggle, pending AI
      edit count, word and character counts, and cursor position. A zoom control sits in the
      centre. The header bar has a search field (<kbd>Cmd/Ctrl</kbd>+<kbd>P</kbd>) and a
      settings button.
    </p>

    <h2>Create your first file</h2>
    <p>
      Click the <strong>+</strong> button at the top of the file tree, or right-click inside the
      sidebar and choose "New Document." Shoulders creates a Markdown (<code>.md</code>) file by default.
      Type a filename and press Enter.
    </p>
    <p>
      Start typing. Changes are saved to disk automatically — one second after you stop typing.
      Press <kbd>Cmd/Ctrl</kbd>+<kbd>S</kbd> to also create a version history checkpoint.
    </p>

    <h2>Set up AI features</h2>
    <p>
      AI features (inline suggestions, chat, comment threads) need access to an AI provider.
      Two options:
    </p>
    <ul>
      <li><strong>Shoulders account</strong> — create a free account at
        <a href="https://shoulde.rs" target="_blank" rel="noopener">shoulde.rs</a> (includes $5.00 free).
        No API keys to manage.</li>
      <li><strong>Your own API keys</strong> — add keys for Anthropic, OpenAI, or Google in
        Settings (<kbd>Cmd/Ctrl</kbd>+<kbd>,</kbd>) → Models.</li>
      <li><strong>Private or self-hosted models</strong> — connect to any OpenAI-compatible
        endpoint (local LLMs, institutional servers, private deployments) via custom URLs
        in <code>.shoulders/models.json</code>.</li>
    </ul>
    <p>
      See <a href="/docs?section=ai-setup">AI Setup</a> for detailed instructions.
    </p>

    <h2>Keyboard essentials</h2>
    <p>
      Five shortcuts cover most navigation:
    </p>
    <table class="docs-table">
      <thead>
        <tr>
          <th>Action</th>
          <th>Shortcut</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Quick open (files, content, references)</td>
          <td><kbd>Cmd/Ctrl</kbd>+<kbd>P</kbd></td>
        </tr>
        <tr>
          <td>Toggle left sidebar</td>
          <td><kbd>Cmd/Ctrl</kbd>+<kbd>B</kbd></td>
        </tr>
        <tr>
          <td>Toggle right sidebar</td>
          <td><kbd>Cmd/Ctrl</kbd>+<kbd>J</kbd></td>
        </tr>
        <tr>
          <td>Save and commit</td>
          <td><kbd>Cmd/Ctrl</kbd>+<kbd>S</kbd></td>
        </tr>
        <tr>
          <td>Open settings</td>
          <td><kbd>Cmd/Ctrl</kbd>+<kbd>,</kbd></td>
        </tr>
      </tbody>
    </table>
    <p>
      See the <a href="/docs?section=shortcuts">full keyboard shortcut reference</a> for everything else.
    </p>
  </div>
</template>
