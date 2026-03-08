<template>
  <div>
    <h1>Document Comments</h1>
    <p class="docs-subtitle">Annotate your documents with comments, then submit them to the AI for revision.</p>

    <h2>Adding a comment</h2>
    <p>
      Select text in the editor and press <kbd>Cmd/Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd>.
      A comment input appears in the margin next to the selected text. Type your annotation or
      instruction — for example, "Make this shorter," "Clarify this claim," or "Rewrite for a
      general audience."
    </p>
    <ul>
      <li><strong>Enter</strong> — saves the comment without submitting to the AI.</li>
      <li><strong>Cmd/Ctrl+Enter</strong> — saves the comment and immediately submits it to the
        AI chat for processing.</li>
    </ul>

    <h2>Comment margin</h2>
    <p>
      A 200px side panel appears alongside the editor, showing compact cards for each comment
      anchored to its position in the document. The margin is toggled via the comment icon in the
      tab bar. Each card shows the anchored text snippet and your annotation.
    </p>
    <p>
      When you have unresolved comments, a "Submit N" button appears at the top of the margin.
      Clicking it sends all unresolved comments to the AI chat as structured context.
    </p>

    <h2>Batch workflow</h2>
    <p>
      The batch workflow is the recommended approach for substantive revision:
    </p>
    <ol>
      <li>Read through your document, leaving comments wherever you want changes.</li>
      <li>When you're done annotating, click "Submit N" in the comment margin.</li>
      <li>The AI receives all comments together and addresses them coherently in a single pass,
        making edits that are consistent with each other.</li>
    </ol>
    <p>
      This is more effective than processing comments one at a time, because the AI can see all
      requested changes at once and avoid contradictions.
    </p>

    <h2>AI replies</h2>
    <p>
      The AI can reply to your comments using the <code>reply_to_comment</code> tool. Replies
      appear nested under the original comment in the margin. When the AI proposes an edit in
      response to a comment, the change goes through the standard review system — appearing as
      an inline diff that you can accept or reject.
    </p>

    <h2>Resolving and deleting</h2>
    <p>
      When a comment has been addressed, mark it as resolved. Resolved comments are hidden by
      default but can be shown with the "Show resolved" toggle. To remove a comment permanently,
      use the "..." menu on the comment card and select Delete.
    </p>

    <h2>AI as reviewer</h2>
    <p>
      The AI can proactively add comments to your document using the <code>add_comment</code>
      tool. Ask it to "review this section" or "leave comments on my draft" and it will create
      margin annotations just like a human reviewer would. You can then address its feedback
      manually or ask it to implement its own suggestions.
    </p>

    <h2>Persistence</h2>
    <p>
      All comments are saved to <code>.shoulders/comments.json</code> and persist across
      app restarts.
    </p>
  </div>
</template>
