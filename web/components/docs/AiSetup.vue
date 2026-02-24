<template>
  <div>
    <h1>Setup</h1>
    <p class="docs-subtitle">Configure AI access, models, privacy controls, and project-specific instructions.</p>

    <h2>Two ways to use AI</h2>
    <p>
      Shoulders needs access to an AI provider. There are two options — use whichever
      suits you, or both:
    </p>

    <h3>Shoulders account</h3>
    <p>
      You can sign up for a Shoulders account directly within the app (or at <a href="https://shoulde.rs" target="_blank" rel="noopener">shoulde.rs</a>)
      to use AI features without managing API keys. New accounts include $5.00 free balance.
      Requests are routed through the Shoulders proxy, which forwards them to AI providers
      on your behalf. You can subscribe or add funds for additional balance.
    </p>

    <h3>Bring your own API keys</h3>
    <p>
      Alternatively, supply your own API keys from one or more providers. Open Settings
      (<kbd>Cmd/Ctrl</kbd>+<kbd>,</kbd>) → Models:
    </p>
    <table class="docs-table">
      <thead>
        <tr>
          <th>Provider</th>
          <th>Models</th>
          <th>Used for</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Anthropic</td>
          <td>Opus 4.6, Sonnet 4.6, Haiku 4.5</td>
          <td>Chat, comments, inline suggestions</td>
        </tr>
        <tr>
          <td>OpenAI</td>
          <td>GPT-5.2, GPT-5 Mini</td>
          <td>Chat, inline suggestions</td>
        </tr>
        <tr>
          <td>Google</td>
          <td>Gemini 3.1 Pro, Gemini 3 Flash, Gemini 2.5 Flash Lite</td>
          <td>Chat, inline suggestions</td>
        </tr>
      </tbody>
    </table>
    <p>
      Keys are stored securely on your computer. They are
      sent only to the provider's API — nowhere else. You pay the provider at their
      standard rates.
    </p>
    <p>
      You can use both methods simultaneously. The model picker in the chat input shows
      all available models from your API keys and your Shoulders account.
    </p>

    <h2>Models</h2>
    <p>
      Seven models are available by default: Opus 4.6, Sonnet 4.6, and Haiku 4.5 from
      Anthropic; GPT-5.2 and GPT-5 Mini from OpenAI; Gemini 3 Pro and Gemini 3 Flash
      from Google. Which models appear depends on your configured keys and account.
    </p>
    <p>
      The model list is defined in <code>.shoulders/models.json</code>. You can add
      custom endpoints by editing this file — private or self-hosted models, institutional
      AI servers, or local language models running on your machine. Any service that
      exposes an OpenAI-compatible, Anthropic, or Google API can be added with a URL and
      API key variable.
    </p>

    <h2>Usage and costs</h2>
    <p>
      Shoulders tracks every AI request and its estimated cost. The footer bar shows
      your monthly total — click it to open Settings → Usage for a detailed breakdown.
    </p>
    <ul>
      <li><strong>Monthly breakdown</strong> — cost, token count, and call count per
        feature (chat, suggestions, comments, references) and per model.</li>
      <li><strong>Trend</strong> — a bar chart showing the last 12 months of usage.</li>
      <li><strong>Budget</strong> — set a monthly soft limit. The cost display turns
        amber when you approach it. It never blocks you from working.</li>
    </ul>
    <p>
      If you use a Shoulders account, costs are deducted per request at real model-specific rates. Your
      balance and subscription can be managed directly in the app via Settings (<kbd>Cmd/Ctrl</kbd>+<kbd>,</kbd>) → Account, or at
      <a href="https://shoulde.rs/account" target="_blank" rel="noopener">shoulde.rs/account</a>.
    </p>

    <h2>Privacy controls</h2>
    <p>
      Shoulders provides 28 AI tools across five categories (workspace, references,
      feedback, notebooks, web research). Each tool can be individually enabled or disabled in
      Settings → Tools.
    </p>
    <p>
      Four tools transmit data to third-party services beyond your AI provider:
      <code>web_search</code> and <code>fetch_url</code> (via Exa),
      <code>search_papers</code> (via OpenAlex, with Exa and CrossRef fallbacks), and
      <code>add_reference</code> (via CrossRef for DOI lookup).
      These are clearly labelled as external. A single "Disable all external tools"
      toggle removes all four at once.
    </p>
    <p>
      Disabled tools are removed from the AI's definitions entirely — the model does
      not know they exist and cannot attempt to use them.
    </p>

    <h2>Project instructions</h2>
    <p>
      Create a file called <code>_instructions.md</code> at the root of your workspace.
      Its contents are included in every AI interaction — chat, comments, and inline
      suggestions. Use it to set tone, define terminology, specify citation conventions,
      or provide project-specific context.
    </p>
    <p>
      Changes take effect immediately — no restart needed. Access the file quickly from
      the model picker dropdown in the chat input.
    </p>
    <DocsCallout type="tip">
      HTML comments in <code>_instructions.md</code> are stripped before the AI sees
      them. Use them as notes to yourself:
      <code>&lt;!-- Remind myself to update this --&gt;</code>.
    </DocsCallout>

    <h2>System prompt</h2>
    <p>
      The file <code>.shoulders/system.md</code> contains the base system prompt used
      by all AI features. It is loaded when the workspace opens. You can edit it to
      adjust the AI's default behaviour. For project-specific context,
      <code>_instructions.md</code> is usually the better choice.
    </p>
  </div>
</template>
