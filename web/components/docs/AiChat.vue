<template>
  <div>
    <h1>AI Chat</h1>
    <p class="docs-subtitle">A conversation with an AI that can read, search, and edit your workspace.</p>

    <h2>Opening the chat</h2>
    <p>
      The chat lives in the right sidebar. Two shortcuts to reach it:
    </p>
    <ul>
      <li><kbd>Cmd/Ctrl</kbd>+<kbd>J</kbd> — toggles the right sidebar.</li>
      <li><kbd>Cmd/Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd> — opens the sidebar and focuses
        the chat input. If you have text selected in the editor, it is sent to the chat as
        context.</li>
    </ul>

    <h2>Conversations</h2>
    <p>
      You can have multiple chat sessions open as tabs. Each session has its own independent
      conversation history. Close a session tab to archive it — the conversation is saved to
      disk and can be reopened later from the history dropdown (clock icon in the tab bar).
    </p>

    <h2>Context</h2>
    <p>
      The AI automatically receives context about your workspace at the start of each
      conversation: which files are open, which file is active, the current git branch, and a
      summary of recent changes. This means the AI is aware of what you are working on without
      you needing to explain it.
    </p>

    <h3>Attaching files</h3>
    <p>
      Type <code>@</code> in the chat input to search for files in your workspace. Select a
      file to attach it to your message. The file's content is included in the conversation
      (truncated at 50KB for large files). PDFs are text-extracted before sending. You can
      attach multiple files.
    </p>

    <h3>Sending a selection</h3>
    <p>
      Select text in the editor and press <kbd>Cmd/Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd>.
      The selected text appears as a quoted chip in the chat input, along with surrounding
      context so the AI knows where the selection sits within the file.
    </p>

    <h3>Project instructions</h3>
    <p>
      If you have created an <code>_instructions.md</code> file in your workspace root, its
      contents are included in every conversation. See <a href="/docs?section=ai-setup">Setup</a>
      for details.
    </p>

    <h2>Switching models</h2>
    <p>
      The model picker in the chat input lets you choose which AI model to use. You can switch
      models mid-conversation. Available models depend on which API keys you have configured
      (see <a href="/docs?section=ai-setup">Setup</a>).
    </p>

    <h2>Token budget</h2>
    <p>
      A token count appears next to the model picker (e.g., "2.1k / 45.3k"). It turns red when
      approaching the model's context limit. When a conversation exceeds the budget, older
      messages are automatically trimmed while preserving the beginning of the conversation
      (which contains workspace context) and recent messages.
    </p>

    <h2>Session persistence</h2>
    <p>
      Conversations are saved to disk as JSON files in <code>.shoulders/chats/</code>. They
      persist across app restarts. Close a tab to archive a session. Reopen archived sessions
      from the history dropdown (clock icon, sorted by last update).
    </p>
  </div>
</template>
