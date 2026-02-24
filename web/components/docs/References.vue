<template>
  <div>
    <h1>References & Citations</h1>
    <p class="docs-subtitle">Import references, cite them in your documents, and export bibliographies.</p>

    <h2>The reference library</h2>
    <p>
      References are stored in a standard format compatible with Pandoc, Zotero, Mendeley, and
      most citation tools (CSL-JSON). The library lives in
      <code>.project/references/library.json</code> — a plain, portable JSON file.
    </p>
    <p>
      The reference panel appears in the left sidebar below the file explorer. Both panels
      are independently collapsible. The reference list supports search, sort (by date added,
      author, year, or title), and filter (All, Cited, Not Cited).
    </p>

    <h2>Importing references</h2>
    <p>
      There are several ways to add references. In all cases, click the import button in the
      reference panel and paste or drop your input.
    </p>

    <h3>DOI</h3>
    <p>
      Paste a DOI (e.g., <code>10.1038/s41586-024-07386-0</code>). Metadata is fetched from
      CrossRef automatically. A citation key is generated in <code>authorYear</code> format.
      You can also paste multiple DOIs, one per line — each is looked up individually.
    </p>

    <h3>Paste any text</h3>
    <p>
      Paste a reference in any format — a title, a citation from a bibliography, an incomplete
      reference string. Shoulders searches CrossRef by title to find a match. If that fails,
      the text is sent to a fast AI model to extract author, title, year, and DOI, then
      verified against CrossRef. This is the most flexible import method: paste whatever you
      have and Shoulders handles the rest.
    </p>

    <h3>BibTeX, RIS, or CSL-JSON</h3>
    <p>
      Paste structured reference data in any of these standard formats. BibTeX entries
      (<code>@article{...}</code>) are the easiest way to import from Zotero or other
      reference managers. RIS is available from most academic databases (Web of Science,
      Scopus, PubMed). The parser is resilient — one malformed entry does not break the batch.
    </p>

    <h3>PDF drag-and-drop</h3>
    <p>
      Drag a PDF file onto the reference panel. Shoulders extracts metadata automatically:
      first by scanning the PDF for a DOI, then (if none is found) by using AI to extract
      title, authors, and year from the first pages. Results are verified against CrossRef.
      The PDF is stored alongside the reference and its full text is indexed for search.
    </p>

    <h3>Duplicate detection</h3>
    <p>
      During import, Shoulders checks for duplicates by DOI and by title similarity.
      Duplicates are flagged — you see a count and can choose to skip them.
    </p>

    <h2>Citing in documents</h2>
    <p>
      Shoulders uses Pandoc-compatible citation syntax:
    </p>
    <table class="docs-table">
      <thead>
        <tr>
          <th>Syntax</th>
          <th>Renders as</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>[@smith2020]</code></td>
          <td>Single citation</td>
        </tr>
        <tr>
          <td><code>[@smith2020; @jones2021; @lee2019]</code></td>
          <td>Citation group</td>
        </tr>
        <tr>
          <td><code>[see @smith2020, p. 42]</code></td>
          <td>Citation with prefix and locator</td>
        </tr>
      </tbody>
    </table>
    <p>
      This syntax works natively with Pandoc, Quarto, R Markdown, Hugo, Jekyll, and many
      other Markdown processors. No conversion needed.
    </p>

    <h3>Autocomplete</h3>
    <p>
      Type <code>@</code> inside square brackets to trigger citation autocomplete. The dropdown
      shows matching references by author, year, and title. Press Enter to insert. Type
      <code>;</code> to add more references to a group.
    </p>

    <h3>Visual feedback</h3>
    <p>
      Citation keys in the editor are colour-coded: valid keys appear in the accent colour,
      broken keys (not in library) appear in red. Hover over any citation to see a tooltip
      with the full reference. Click a citation to open a popover for editing: add or remove
      keys, add locators (e.g., "p. 42"), and search your library.
    </p>

    <h3>LaTeX citations</h3>
    <p>
      In <code>.tex</code> files, <code>\cite{key}</code> syntax (and variants like
      <code>\citep</code>, <code>\citet</code>) is supported with the same autocomplete, hover
      tooltips, and colour-coding. A <code>references.bib</code> file is auto-generated
      before each LaTeX compile.
    </p>

    <h2>Citation styles</h2>
    <p>
      Shoulders includes 30 built-in citation styles covering most academic disciplines:
    </p>
    <ul>
      <li><strong>Author-date</strong> — APA 7th, APA 6th, Chicago Author-Date, Harvard,
        Elsevier Harvard, ASA, DIN 1505-2, GB/T 7714.</li>
      <li><strong>Numeric</strong> — IEEE, Vancouver, Nature, Science, Cell, PLOS ONE,
        ACS, AMA, AIP, AMS, BMJ, The Lancet, PNAS, Springer LNCS, Annual Reviews,
        Royal Society of Chemistry, Elsevier.</li>
      <li><strong>Note</strong> — Chicago Notes & Bibliography, MLA 9th, OSCOLA, Bluebook,
        MHRA.</li>
    </ul>
    <p>
      Select the style in the PDF settings popover (gear icon in the tab bar).
    </p>
    <p>
      You can also import custom CSL styles. Click "Add custom style" in the reference panel
      or drag a <code>.csl</code> file onto it. Custom styles are stored in
      <code>.project/styles/</code> and appear alongside the built-in options. CSL files are
      available from the <a href="https://www.zotero.org/styles" target="_blank" rel="noopener">Zotero Style Repository</a>,
      which hosts thousands of journal-specific styles.
    </p>

    <h2>Quick Open</h2>
    <p>
      <kbd>Cmd/Ctrl</kbd>+<kbd>P</kbd> includes a References section in the results.
      Selecting a reference inserts <code>[@key]</code> at the cursor position.
    </p>

    <h2>Exporting</h2>
    <p>
      Right-click a reference to copy its BibTeX entry or citation key. Bulk export
      (all references, cited only, or filtered) is available as BibTeX or RIS.
    </p>

    <h2>AI integration</h2>
    <p>
      The AI chat can interact with your reference library:
    </p>
    <ul>
      <li><strong>Search references</strong> — search by title, author, key, or DOI.</li>
      <li><strong>Get reference</strong> — retrieve full metadata for a key.</li>
      <li><strong>Add reference</strong> — add a new reference by DOI.</li>
      <li><strong>Insert citation</strong> — insert a citation at the cursor.</li>
      <li><strong>Read attached PDFs</strong> — the AI can read the full text of PDFs stored
        in your reference library, making it possible to ask questions about specific papers,
        compare findings across sources, or summarise key arguments.</li>
      <li><strong>Search papers</strong> — search OpenAlex (450M+ academic works) for papers
        by topic. Returns titles, authors, citation counts, DOIs, and open access links.
        Falls back to Exa and CrossRef if needed. External tool — can be disabled in
        Settings → Tools.</li>
    </ul>
  </div>
</template>
