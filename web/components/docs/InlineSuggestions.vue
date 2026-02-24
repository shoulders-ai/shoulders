<template>
  <div>
    <h1>Inline Suggestions</h1>
    <p class="docs-subtitle">AI-powered text completions that appear as ghost text at your cursor.</p>

    <h2>How it works</h2>
    <p>
      Type <code>++</code> (two plus signs quickly) anywhere in your document. The trigger
      characters are consumed — they do not appear in your text. A small loading animation
      appears at the cursor while the AI generates a completion.
    </p>
    <p>
      The completion appears as gray ghost text extending from your cursor position. It
      continues your sentence, paragraph, or code based on what surrounds the cursor.
    </p>

    <h2>Accepting and dismissing</h2>
    <p>
      The AI generates several alternative completions. The first one appears immediately.
      A small badge (e.g., "2/4") shows which alternative you are viewing.
    </p>
    <table class="docs-table">
      <thead>
        <tr>
          <th>Action</th>
          <th>Keys</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Accept the suggestion</td>
          <td><kbd>Tab</kbd>, <kbd>Enter</kbd>, or <kbd>Right</kbd></td>
        </tr>
        <tr>
          <td>Next alternative</td>
          <td><kbd>Down</kbd></td>
        </tr>
        <tr>
          <td>Previous alternative</td>
          <td><kbd>Up</kbd></td>
        </tr>
        <tr>
          <td>Dismiss</td>
          <td><kbd>Esc</kbd>, <kbd>Left</kbd>, or click elsewhere</td>
        </tr>
      </tbody>
    </table>

    <h2>What the AI sees</h2>
    <p>
      The model receives up to 5,000 characters before your cursor and 1,000 characters
      after, with smart word-boundary truncation. It also receives your system prompt and
      project instructions (<code>_instructions.md</code>) if they exist. This context is
      sufficient for the AI to continue your writing in a way that fits the surrounding text.
    </p>

    <h2>Where it works</h2>
    <p>
      Inline suggestions are available in:
    </p>
    <ul>
      <li>Markdown files</li>
      <li>Code files (Python, R, JavaScript, etc.)</li>
      <li>Word documents (<code>.docx</code>)</li>
      <li>Individual cells within Jupyter notebooks</li>
    </ul>

    <h2>Turning suggestions off</h2>
    <p>
      If you prefer not to use inline suggestions, you can disable them in
      Settings (<kbd>Cmd/Ctrl</kbd>+<kbd>,</kbd>) → Environment.
    </p>
  </div>
</template>
