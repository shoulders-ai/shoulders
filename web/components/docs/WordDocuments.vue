<template>
  <div>
    <h1>Word Documents</h1>
    <p class="docs-subtitle">Open and edit .docx files natively, with tracked changes and AI support.</p>

    <h2>Opening Word files</h2>
    <p>
      Shoulders opens <code>.docx</code> files directly — no conversion to another format, no
      import step. The file you see is the file on disk. When you save, it writes back to the
      same <code>.docx</code> file.
    </p>
    <p>
      Open a <code>.docx</code> file from the file tree, from <kbd>Cmd/Ctrl</kbd>+<kbd>P</kbd>
      (Quick Open), or by dragging it into the workspace folder.
    </p>

    <h2>Formatting</h2>
    <p>
      A toolbar above the document provides formatting controls:
    </p>
    <ul>
      <li><strong>Text styles</strong> — bold, italic, underline.</li>
      <li><strong>Headings</strong> — heading level selector (Heading 1 through 6, or paragraph).</li>
      <li><strong>Lists</strong> — bulleted and numbered lists.</li>
      <li><strong>Tables</strong> — insert and edit tables.</li>
      <li><strong>Paragraph styles</strong> — alignment, indentation.</li>
    </ul>
    <p>
      Standard keyboard shortcuts work inside Word documents: <kbd>Cmd/Ctrl</kbd>+<kbd>B</kbd>
      for bold, <kbd>Cmd/Ctrl</kbd>+<kbd>I</kbd> for italic, <kbd>Cmd/Ctrl</kbd>+<kbd>U</kbd>
      for underline.
    </p>

    <h2>Tracked changes</h2>
    <p>
      If the document contains tracked changes from Microsoft Word, they are preserved. A review
      bar appears above the document showing the number of pending changes, with options to accept
      or reject them individually or all at once.
    </p>

    <h2>AI features in Word documents</h2>
    <p>
      AI features work inside <code>.docx</code> files the same way they work in Markdown:
    </p>
    <ul>
      <li>
        <strong>Inline suggestions</strong> — type <code>++</code> to trigger ghost text completions.
        Accept with <kbd>Tab</kbd>, cycle with <kbd>Up</kbd>/<kbd>Down</kbd>, dismiss with
        <kbd>Esc</kbd>.
      </li>
      <li>
        <strong>Comment threads</strong> — select text and press <kbd>Cmd/Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd>
        to start an AI-powered comment thread on the selection.
      </li>
      <li>
        <strong>AI chat</strong> — the chat can read Word document content and propose edits.
      </li>
    </ul>

    <h2>Saving</h2>
    <p>
      Changes auto-save to disk. <kbd>Cmd/Ctrl</kbd>+<kbd>S</kbd> triggers an immediate save
      and creates a version history checkpoint. The <code>.docx</code> format is preserved — you
      can open the file in Microsoft Word, Google Docs, or any other application that reads
      <code>.docx</code> at any time.
    </p>

    <h2>Page zoom</h2>
    <p>
      The Word document toolbar includes a separate zoom control for the page view. This is
      independent of the global font zoom (<kbd>Cmd/Ctrl</kbd>+<kbd>+/-</kbd>), which adjusts
      the rest of the interface.
    </p>
  </div>
</template>
