<template>
  <div>
    <h1>Code & Notebooks</h1>
    <p class="docs-subtitle">Run R, Python, and Julia code alongside your writing. Edit Jupyter notebooks natively.</p>

    <h2>Running code from files</h2>
    <p>
      If you write code as part of your research — R scripts, Python analysis, Julia models —
      you can run it directly inside Shoulders without switching to another application.
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
          <td>Run selection (or current line)</td>
          <td><kbd>Cmd/Ctrl</kbd>+<kbd>Enter</kbd></td>
        </tr>
        <tr>
          <td>Run entire file</td>
          <td><kbd>Shift</kbd>+<kbd>Cmd/Ctrl</kbd>+<kbd>Enter</kbd></td>
        </tr>
      </tbody>
    </table>
    <p>
      The first time you run code in a file, Shoulders automatically creates a language session
      in the terminal panel: an interactive R session, a Python interpreter, or a Julia REPL.
      Subsequent executions reuse the same session.
    </p>
    <p>
      When running a selection, the cursor advances to the next line — you can step through a
      file line by line by pressing <kbd>Cmd/Ctrl</kbd>+<kbd>Enter</kbd> repeatedly.
    </p>

    <h2>Jupyter notebooks</h2>
    <p>
      Shoulders opens <code>.ipynb</code> files natively. It reads and writes the standard
      Jupyter Notebook format — the same format used by JupyterLab, VS Code, and Google Colab.
    </p>
    <p>
      Notebooks contain code cells (with syntax highlighting), markdown cells (with live
      preview), and raw cells. Use the cell toolbar or notebook toolbar to add, delete, and
      reorder cells.
    </p>
    <p>
      Cell outputs render inline: text, HTML, images, and error tracebacks with colour support.
      The notebook toolbar provides: run cell, run all, restart kernel, interrupt, and clear
      outputs. A kernel status indicator shows whether the kernel is idle, running, or has
      encountered an error.
    </p>
    <p>
      Inline suggestions (<code>++</code>) and comment threads also work inside individual
      notebook cells.
    </p>

    <h2>What you need installed</h2>
    <p>
      R, Python, or Julia must be installed on your system. Shoulders does not bundle these
      languages — it connects to whatever you already have.
    </p>
    <ul>
      <li><strong>For R</strong> — install R from <a href="https://cran.r-project.org" target="_blank" rel="noopener">cran.r-project.org</a>.
        If you use RStudio, R is likely already installed.</li>
      <li><strong>For Python</strong> — install Python from <a href="https://python.org" target="_blank" rel="noopener">python.org</a>
        or via conda/miniconda.</li>
      <li><strong>For Julia</strong> — install Julia from <a href="https://julialang.org" target="_blank" rel="noopener">julialang.org</a>.</li>
    </ul>
    <DocsCallout type="note">
      For Jupyter notebooks, you also need <code>ipykernel</code> installed in your Python
      environment: <code>pip install ipykernel</code>. Shoulders discovers installed Jupyter
      kernels automatically.
    </DocsCallout>

    <h2>Code chunks in R Markdown and Quarto</h2>
    <p>
      In <code>.rmd</code> and <code>.qmd</code> files, fenced code blocks with language tags
      (e.g., <code>```{r}</code>, <code>```{python}</code>) are recognised as executable code
      chunks. A green play button appears in the margin for each chunk — click it to send the
      code to the appropriate language session.
    </p>

    <h2>The terminal</h2>
    <p>
      Shoulders includes a built-in terminal in the right sidebar. It runs a full shell session
      — the same as your system terminal, with the same configuration and installed programs.
    </p>
    <ul>
      <li>Create multiple terminal tabs with the <strong>+</strong> button.</li>
      <li>Terminal processes persist when you switch between sidebar tabs (chat, comments, etc.).</li>
      <li>Language sessions created by <kbd>Cmd/Ctrl</kbd>+<kbd>Enter</kbd> appear as labelled
        terminal tabs (e.g., "Python", "R").</li>
      <li>Clickable URLs, auto-resize, and theme-aware colours.</li>
    </ul>

    <h2>AI and code</h2>
    <p>
      The AI chat includes tools for working with notebooks: it can read notebook contents,
      edit individual cells, run cells, add new cells, and delete cells. Cell edits from the AI
      go through the same review system as file edits — they appear as inline diffs within the
      cell, with accept and reject controls.
    </p>
  </div>
</template>
