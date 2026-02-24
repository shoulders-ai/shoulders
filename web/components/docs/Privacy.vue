<template>
  <div>
    <h1>Privacy & Data</h1>
    <p class="docs-subtitle">Where your data lives, what leaves your machine, and how to control it.</p>

    <h2>Your files stay on your machine</h2>
    <p>
      Shoulders is a desktop application. Your files live on your local filesystem — no cloud
      database, no sync layer, no proprietary storage. The app is fully functional offline
      for all non-AI features: editing, file management, version history, references, terminal,
      and PDF export.
    </p>

    <h2>What connects to the internet</h2>
    <p>
      The only network traffic Shoulders generates:
    </p>

    <h3>AI requests</h3>
    <p>
      When you use inline suggestions, chat, or comments, the relevant context is sent to
      the AI provider you configured (Anthropic, OpenAI, or Google). Requests go directly
      from your machine to the provider. Shoulders forwards them through a local proxy
      only to handle browser restrictions — it does not store or inspect them.
    </p>

    <h3>Reference lookups</h3>
    <p>
      When you import a reference by DOI, Shoulders queries CrossRef to fetch metadata.
      The DOI is the only data sent.
    </p>

    <h3>External AI tools</h3>
    <p>
      Three optional tools (<code>web_search</code>, <code>search_papers</code>,
      <code>fetch_url</code>) transmit data to third-party services when the AI uses them.
      These are labelled as external in Settings and can be disabled individually or all
      at once.
    </p>

    <h3>Shoulders account</h3>
    <p>
      If you use a Shoulders account instead of your own API keys, AI requests are routed
      through the Shoulders proxy. Usage costs are tracked. Request and response content is
      not stored. This is entirely optional.
    </p>

    <h3>Telemetry</h3>
    <p>
      Shoulders collects anonymous usage telemetry to improve the product — things like which
      features are used and which themes are popular. No file contents, no personal data, just
      aggregate patterns. You can opt out in Settings.
    </p>

    <h2>Controlling what is shared</h2>
    <p>
      Every AI tool (28 total) can be individually enabled or disabled in
      Settings → Tools. External tools are clearly labelled. Disabled tools are removed
      from the AI entirely — the model does not know they exist.
    </p>

    <hr />

    <p>
      For the full legal documents:
    </p>
    <ul>
      <li><a href="/privacy">Privacy Policy</a></li>
      <li><a href="/terms">Terms of Service</a></li>
    </ul>
  </div>
</template>
