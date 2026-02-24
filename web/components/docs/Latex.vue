<template>
  <div>
    <h1>LaTeX</h1>
    <p class="docs-subtitle">Write and compile LaTeX documents with live preview, error navigation, and AI assistance.</p>

    <h2>Getting started</h2>
    <p>
      LaTeX support uses a bundled Tectonic compiler — no external tools needed. Packages
      are downloaded automatically on first compile.
    </p>
    <div class="docs-steps">
      <div class="docs-step">
        <span class="docs-step-number">1</span>
        <div class="docs-step-content">
          Open or create a <code>.tex</code> file. The editor provides syntax highlighting
          and autocomplete for common LaTeX commands.
        </div>
      </div>
      <div class="docs-step">
        <span class="docs-step-number">2</span>
        <div class="docs-step-content">
          The document compiles automatically. The first compile may take a moment as Tectonic
          downloads the required packages.
        </div>
      </div>
    </div>
    <Callout type="tip">
      LaTeX compilation can be disabled in Settings (<kbd>Cmd/Ctrl</kbd>+<kbd>,</kbd>) → Environment.
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
      The document recompiles automatically 5 seconds after the last edit. The compiled PDF
      opens in a split pane next to your source. Each recompilation updates the PDF in place —
      you see changes as you write.
    </p>
    <p>
      You can also trigger a compile manually from the toolbar above the PDF viewer.
    </p>

    <h2>Navigating between source and PDF</h2>
    <p>
      SyncTeX links the source and PDF bidirectionally:
    </p>
    <ul>
      <li><strong>Forward sync</strong> — click a position in the editor to jump to the
        corresponding location in the PDF.</li>
      <li><strong>Backward sync</strong> — click in the PDF to jump back to the source line.</li>
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
