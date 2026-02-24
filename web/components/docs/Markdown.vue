<template>
  <div>
    <h1>Markdown</h1>
    <p class="docs-subtitle">Write in Markdown with formatting shortcuts, wiki links, preview, and PDF export.</p>

    <h2>Writing in Markdown</h2>
    <p>
      Markdown files (<code>.md</code>, <code>.rmd</code>, <code>.qmd</code>) open in a text editor with
      syntax highlighting, code folding, and search (<kbd>Cmd/Ctrl</kbd>+<kbd>F</kbd>). Formatting shortcuts
      let you apply common styles without typing the syntax by hand:
    </p>
    <table class="docs-table">
      <thead>
        <tr>
          <th>Format</th>
          <th>Shortcut</th>
          <th>Syntax</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Bold</td>
          <td><kbd>Cmd/Ctrl</kbd>+<kbd>B</kbd></td>
          <td><code>**text**</code></td>
        </tr>
        <tr>
          <td>Italic</td>
          <td><kbd>Cmd/Ctrl</kbd>+<kbd>I</kbd></td>
          <td><code>*text*</code></td>
        </tr>
        <tr>
          <td>Link</td>
          <td><kbd>Cmd/Ctrl</kbd>+<kbd>K</kbd></td>
          <td><code>[text](url)</code></td>
        </tr>
        <tr>
          <td>Inline code</td>
          <td><kbd>Cmd/Ctrl</kbd>+<kbd>E</kbd></td>
          <td><code>`text`</code></td>
        </tr>
      </tbody>
    </table>

    <h3>Auto-save</h3>
    <p>
      Changes are written to disk one second after you stop typing. There is no "unsaved changes"
      dialog — the file on disk always reflects what you see. Press <kbd>Cmd/Ctrl</kbd>+<kbd>S</kbd>
      to also create a version history checkpoint.
    </p>

    <h3>Word count</h3>
    <p>
      The footer shows word count and character count for the active file. When text is selected,
      counts for the selection appear alongside the document totals. Cursor position (line:column)
      is also displayed.
    </p>

    <h2>Wiki links</h2>
    <p>
      Link between files in your workspace using double-bracket syntax:
    </p>
    <table class="docs-table">
      <thead>
        <tr>
          <th>Syntax</th>
          <th>Result</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>[[filename]]</code></td>
          <td>Links to a file by name</td>
        </tr>
        <tr>
          <td><code>[[filename|display text]]</code></td>
          <td>Links with custom display text</td>
        </tr>
        <tr>
          <td><code>[[filename#heading]]</code></td>
          <td>Links to a specific heading within a file</td>
        </tr>
      </tbody>
    </table>
    <p>
      You do not need to include the file extension or path — <code>[[my notes]]</code> finds
      <code>my notes.md</code> anywhere in the directory tree. Resolved links are styled in the
      accent color; broken links appear in red.
    </p>
    <p>
      Type <code>[[</code> to trigger autocomplete from all workspace files. Click a link to open
      the target file. If the target does not exist, clicking creates it automatically.
    </p>
    <p>
      The right sidebar has a <strong>Backlinks</strong> tab showing every file that links to the
      currently active file. When you rename a file, all wiki links pointing to it across the
      workspace are updated automatically.
    </p>

    <h2>Preview</h2>
    <p>
      Click <strong>Preview</strong> in the tab bar to open a rendered HTML view in a split pane.
      The preview supports headings, lists, tables, code blocks with syntax highlighting, and
      math (KaTeX).
    </p>

    <h2>Exporting to PDF</h2>
    <p>
      Shoulders converts Markdown to PDF locally using Typst, a modern typesetting engine. No
      internet connection required.
    </p>
    <div class="docs-steps">
      <div class="docs-step">
        <span class="docs-step-number">1</span>
        <div class="docs-step-content">
          Open a Markdown file.
        </div>
      </div>
      <div class="docs-step">
        <span class="docs-step-number">2</span>
        <div class="docs-step-content">
          Click <strong>Create PDF</strong> in the tab bar. The PDF opens in a split pane next to
          your source.
        </div>
      </div>
      <div class="docs-step">
        <span class="docs-step-number">3</span>
        <div class="docs-step-content">
          The PDF regenerates automatically when you save. Edit on the left, see the result on
          the right.
        </div>
      </div>
    </div>

    <h3>Templates</h3>
    <p>
      Five built-in templates control the PDF layout:
    </p>
    <ul>
      <li><strong>Article</strong> — standard academic article format.</li>
      <li><strong>Report</strong> — longer-form document with title page.</li>
      <li><strong>Essay</strong> — clean, minimal layout for prose.</li>
      <li><strong>Letter</strong> — formal letter format.</li>
      <li><strong>Plain</strong> — minimal formatting, maximum content density.</li>
    </ul>

    <h3>PDF settings</h3>
    <p>
      Click the gear icon in the tab bar to configure per-file settings: template, font, font size,
      margins, line spacing, and citation style. Settings are saved per file.
    </p>
    <p>
      <code>[@key]</code> citations are resolved against your reference library and formatted according
      to the selected style. A bibliography is automatically generated at the end of the document.
    </p>

    <h2>Tabs and split panes</h2>
    <p>
      Open multiple files in tabs within the same pane. Drag tabs to reorder. Close with
      <kbd>Cmd/Ctrl</kbd>+<kbd>W</kbd>. Switch tabs with
      <kbd>Cmd/Ctrl</kbd>+<kbd>Option/Alt</kbd>+<kbd>Left/Right</kbd>.
    </p>
    <p>
      Split the editor vertically (<kbd>Cmd/Ctrl</kbd>+<kbd>\</kbd>) or horizontally
      (<kbd>Cmd/Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>\</kbd>). Drag the divider to adjust the ratio.
      Splits nest recursively.
    </p>
    <DocsCallout type="tip">
      A common workflow: Markdown on the left, PDF preview or a reference PDF on the right.
    </DocsCallout>

    <h2>Zoom</h2>
    <p>
      <kbd>Cmd/Ctrl</kbd>+<kbd>+</kbd> and <kbd>Cmd/Ctrl</kbd>+<kbd>-</kbd> adjust font sizes
      globally. Both the editor font and the UI font scale together.
    </p>
  </div>
</template>
