<template>
  <div>
    <h1>LaTeX</h1>
    <p class="docs-subtitle">Write and compile LaTeX documents with live preview, error navigation, and AI assistance.</p>

    <h2>Getting started</h2>
    <p>
      LaTeX compilation is powered by <a href="https://tectonic-typesetting.github.io/" target="_blank">Tectonic</a>,
      a modern, self-contained TeX engine. It is not bundled with Shoulders but can be downloaded
      with one click from Settings.
    </p>
    <div class="docs-steps">
      <div class="docs-step">
        <span class="docs-step-number">1</span>
        <div class="docs-step-content">
          Open Settings (<kbd>Cmd/Ctrl</kbd>+<kbd>,</kbd>) → System and click
          <strong>Download Tectonic</strong> (~15 MB one-time download).
        </div>
      </div>
      <div class="docs-step">
        <span class="docs-step-number">2</span>
        <div class="docs-step-content">
          Open or create a <code>.tex</code> file. The editor provides syntax highlighting
          and autocomplete for common LaTeX commands.
        </div>
      </div>
      <div class="docs-step">
        <span class="docs-step-number">3</span>
        <div class="docs-step-content">
          The document compiles automatically. The first compile may take a moment as Tectonic
          downloads the required TeX packages.
        </div>
      </div>
    </div>
    <Callout type="tip">
      If Tectonic is already installed on your system (e.g. via Homebrew or Cargo), Shoulders
      will find it automatically — no download needed.
    </Callout>

    <h2>Writing</h2>
    <p>
      The editor provides syntax highlighting for LaTeX and autocomplete for approximately 80
      common commands — document structure (<code>\section</code>, <code>\begin</code>),
      formatting (<code>\textbf</code>, <code>\emph</code>), math (<code>\frac</code>,
      <code>\sum</code>), and more. Autocomplete triggers as you type.
    </p>

    <h2>Compiling</h2>
    <p>
      The document recompiles automatically about 5 seconds after the last edit. The compiled PDF
      opens in a split pane next to your source. Each recompilation updates the PDF in place —
      you see changes as you write.
    </p>
    <p>
      The tab bar above the editor shows compile controls:
    </p>
    <ul>
      <li><strong>Compile</strong> — trigger a manual compile at any time.</li>
      <li><strong>Auto</strong> — toggle auto-compilation on or off (on by default).</li>
      <li><strong>Status</strong> — shows compile time on success, or error count on failure.</li>
    </ul>

    <h2>Navigating between source and PDF</h2>
    <p>
      SyncTeX links the source and PDF bidirectionally:
    </p>
    <ul>
      <li><strong>Forward sync</strong> — click the <strong>Sync</strong> button in the tab bar
        to jump the PDF to your current cursor position.</li>
      <li><strong>Backward sync</strong> — double-click in the PDF to jump back to the
        corresponding source line.</li>
    </ul>

    <h2>Errors</h2>
    <p>
      Compilation errors and warnings appear in a panel below the editor. Click an error to
      jump to the source line. If a compile fails, the previous PDF stays visible so you can
      still reference it while fixing the issue.
    </p>
    <p>
      The <strong>Ask AI to fix</strong> button sends the error to the AI chat, which can read
      the source file and suggest corrections.
    </p>

    <h2>Citations</h2>
    <p>
      If you use the <a href="/docs?section=references">reference library</a>, LaTeX citation
      commands work with autocomplete and visual feedback:
    </p>
    <ul>
      <li>Type <code>\cite{</code> to trigger autocomplete from your reference library.</li>
      <li>Hover over a citation key to see the full reference details.</li>
      <li>Citation keys are color-coded — valid keys in accent color, broken keys in red.</li>
      <li>A <code>references.bib</code> file is auto-generated from your library before each
        compile. You do not need to maintain a <code>.bib</code> file manually.</li>
    </ul>
    <p>
      Standard variants (<code>\citep</code>, <code>\citet</code>, <code>\citeauthor</code>, etc.)
      are also supported.
    </p>
  </div>
</template>
