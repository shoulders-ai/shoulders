<template>
  <div>
    <h1>Tasks</h1>
    <p class="docs-subtitle">AI-powered task threads anchored to specific text selections.</p>

    <h2>Creating a task</h2>
    <p>
      Select text in the editor and press <kbd>Cmd/Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd>.
      A task panel opens in the right sidebar with the selected text as context. Type your
      question or instruction and send.
    </p>
    <p>
      Tasks are useful for localised questions: "clarify this paragraph," "strengthen this
      argument," "rewrite this for a general audience," or "check whether this claim is
      supported by the cited reference."
    </p>

    <h2>Conversation</h2>
    <p>
      Each task thread supports multi-turn conversation. The AI sees the selected text as
      its primary context and can also use research tools — reading other files, searching your
      workspace, or looking up references — to gather additional information before responding.
    </p>

    <h2>Proposed edits</h2>
    <p>
      The AI can propose changes to the selected text. Proposals show the old and new text
      side by side with an "Apply" button. Applying a proposal inserts the change into your
      document as an inline diff — you can accept or reject it, just like any other AI edit.
    </p>

    <h2>Gutter indicators</h2>
    <p>
      Colored dots appear in the editor margin next to lines that have task threads:
    </p>
    <ul>
      <li><strong>Neutral</strong> — thread is idle.</li>
      <li><strong>Pulsing</strong> — AI is generating a response.</li>
      <li><strong>Red</strong> — an error occurred.</li>
    </ul>
    <p>
      The task text range is underlined in the editor. Ranges update automatically as the
      document is edited.
    </p>

    <h2>Resolving and navigating</h2>
    <p>
      When a thread has served its purpose, mark it as resolved. Resolved threads move to the
      bottom of the list and are grayed out. You can also delete threads entirely.
    </p>
    <p>
      Click "Jump to" in a thread to scroll the editor to the anchored selection. This is
      useful when you have several threads across a long document.
    </p>

    <h2>Notebook cell tasks</h2>
    <p>
      In Jupyter notebooks, task threads can be attached to specific cells. The AI receives
      cell-specific context (source code, cell type, outputs, language) and can propose edits
      directly to cell source. A badge on the cell indicates the number of active threads.
    </p>

    <h2>Persistence</h2>
    <p>
      All task threads are saved to <code>.shoulders/tasks.json</code> and persist across
      app restarts.
    </p>
  </div>
</template>
