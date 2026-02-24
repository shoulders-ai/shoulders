import { invoke } from '@tauri-apps/api/core'
import { useReviewsStore } from '../stores/reviews'
import { useEditorStore } from '../stores/editor'
import { useFilesStore } from '../stores/files'
import { nanoid } from '../stores/utils'
import { extractDocumentText } from './docxContext'
import { SHOULDERS_SEARCH_URL } from './apiClient'

// External tools that transmit data to third-party services
export const EXTERNAL_TOOLS = ['web_search', 'search_papers', 'fetch_url', 'add_reference']

export const TOOL_CATEGORIES = [
  {
    id: 'workspace',
    label: 'Workspace',
    defaultCollapsed: true,
    subgroups: [
      {
        label: 'Read & Browse',
        tools: [
          { name: 'read_file', description: 'Read file contents' },
          { name: 'list_files', description: 'List files and directories' },
          { name: 'search_content', description: 'Search text across files' },
        ],
      },
      {
        label: 'Create & Edit',
        tools: [
          { name: 'write_file', description: 'Create a new file' },
          { name: 'edit_file', description: 'Edit an existing file' },
          { name: 'create_file', description: 'Create an empty file' },
          { name: 'rename_file', description: 'Rename a file or directory' },
          { name: 'move_file', description: 'Move a file to another directory' },
          { name: 'duplicate_file', description: 'Duplicate a file' },
          { name: 'delete_file', description: 'Delete a file' },
        ],
      },
      {
        label: 'System',
        tools: [
          { name: 'run_command', description: 'Execute a bash command' },
        ],
      },
    ],
  },
  {
    id: 'references',
    label: 'References',
    tools: [
      { name: 'search_references', description: 'Search local library' },
      { name: 'get_reference', description: 'Get reference metadata' },
      { name: 'add_reference', description: 'Add by DOI or BibTeX', external: 'CrossRef' },
      { name: 'cite_reference', description: 'Insert citation at cursor' },
      { name: 'edit_reference', description: 'Edit reference metadata' },
    ],
  },
  {
    id: 'feedback',
    label: 'Feedback',
    tools: [
      { name: 'add_task', description: 'Create task on text' },
      { name: 'read_tasks', description: 'Read existing tasks' },
      { name: 'create_proposal', description: 'Present choice cards' },
    ],
  },
  {
    id: 'notebook',
    label: 'Notebooks',
    tools: [
      { name: 'read_notebook', description: 'Read notebook cells & outputs' },
      { name: 'edit_cell', description: 'Edit a notebook cell' },
      { name: 'run_cell', description: 'Execute a notebook cell' },
      { name: 'run_all_cells', description: 'Execute all cells' },
      { name: 'add_cell', description: 'Insert a new cell' },
      { name: 'delete_cell', description: 'Remove a cell' },
    ],
  },
  {
    id: 'web',
    label: 'Web Research',
    tools: [
      { name: 'web_search', description: 'Search the web', external: 'Exa' },
      { name: 'search_papers', description: 'Search academic papers', external: 'OpenAlex + Exa' },
      { name: 'fetch_url', description: 'Fetch web page content', external: 'Exa' },
    ],
  },
]

// Flatten all tool names from categories for lookup
function _allCategoryToolNames() {
  const names = []
  for (const cat of TOOL_CATEGORIES) {
    if (cat.tools) {
      for (const t of cat.tools) names.push(t.name)
    }
    if (cat.subgroups) {
      for (const sg of cat.subgroups) {
        for (const t of sg.tools) names.push(t.name)
      }
    }
  }
  return names
}

export function getToolDefinitions(workspace) {
  const tools = [
    {
      name: 'run_command',
      description: 'Execute a bash command in the workspace directory. Use for git, npm, build tools, etc.',
      input_schema: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The bash command to execute' },
        },
        required: ['command'],
      },
    },
    {
      name: 'read_file',
      description: 'Read the contents of a file. Supports text files, PDFs (extracts text), and DOCX (when open). Use this instead of run_command for reading files.',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path relative to workspace' },
        },
        required: ['path'],
      },
    },
    {
      name: 'write_file',
      description: 'Create a new file with the given content. Only use for NEW files — to modify existing files, use edit_file instead.',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path relative to workspace' },
          content: { type: 'string', description: 'The file content to write' },
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'edit_file',
      description: 'Edit an existing file by replacing a specific string with new content. Use this for all modifications to existing files including DOCX files (when open in the editor). The old_string must match exactly (including whitespace and indentation).',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path relative to workspace' },
          old_string: { type: 'string', description: 'The exact text to find and replace (must be unique in the file)' },
          new_string: { type: 'string', description: 'The replacement text' },
        },
        required: ['path', 'old_string', 'new_string'],
      },
    },
    {
      name: 'list_files',
      description: 'List files and directories in the workspace or a subdirectory.',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path (relative to workspace, defaults to workspace root)' },
        },
      },
    },
    {
      name: 'search_content',
      description: 'Search for text across files in the workspace (case-insensitive).',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Text to search for' },
          max_results: { type: 'number', description: 'Maximum results (default 20)' },
        },
        required: ['query'],
      },
    },
    {
      name: 'search_references',
      description: 'Search the reference library by title, author, year, key, or DOI.',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
        },
        required: ['query'],
      },
    },
    {
      name: 'get_reference',
      description: 'Get the full metadata for a reference by its citation key.',
      input_schema: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'The citation key (e.g. "vaswani2017")' },
        },
        required: ['key'],
      },
    },
    {
      name: 'add_reference',
      description: 'Add a reference to the library by DOI lookup or BibTeX import. Accepts a DOI string (e.g. "10.1234/example") or a BibTeX entry (e.g. "@article{key, ...}").',
      input_schema: {
        type: 'object',
        properties: {
          input: { type: 'string', description: 'A DOI string or BibTeX entry/entries' },
        },
        required: ['input'],
      },
    },
    {
      name: 'cite_reference',
      description: 'Insert a citation [@key] at the cursor position in the active editor.',
      input_schema: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'The citation key to insert' },
        },
        required: ['key'],
      },
    },
    {
      name: 'edit_reference',
      description: 'Edit metadata fields on an existing reference. Takes a citation key and an object of CSL-JSON fields to update (title, author, issued, DOI, abstract, container-title, volume, issue, page, _tags, etc.).',
      input_schema: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Citation key (e.g. "smith2024")' },
          updates: { type: 'object', description: 'CSL-JSON fields to update' },
        },
        required: ['key', 'updates'],
      },
    },
    // search_papers: OpenAlex → Exa → CrossRef fallback chain
    {
      name: 'search_papers',
      description: 'Search for academic papers. Returns structured metadata including titles, authors, year, DOI, citation counts, open access status, and abstracts. Use the returned DOI with add_reference to import papers to the library.',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query for academic papers' },
          num_results: { type: 'number', description: 'Number of results (default 5, max 10)' },
        },
        required: ['query'],
      },
    },
    // --- Task Injection Tools ---
    {
      name: 'add_task',
      description: 'Create a spatially-anchored task thread on a specific piece of text in a file. The task appears as a gutter dot in the editor. Optionally include a proposed edit.',
      input_schema: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'File path relative to workspace' },
          target_text: { type: 'string', description: 'The exact text to anchor the task to (must exist in the file)' },
          message: { type: 'string', description: 'The task/feedback message' },
          proposed_edit: {
            type: 'object',
            description: 'Optional proposed text replacement',
            properties: {
              old_string: { type: 'string', description: 'Text to replace' },
              new_string: { type: 'string', description: 'Replacement text' },
            },
            required: ['old_string', 'new_string'],
          },
        },
        required: ['file_path', 'target_text', 'message'],
      },
    },
    {
      name: 'read_tasks',
      description: 'Read all task threads for a file, including conversation messages and proposed edits.',
      input_schema: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'File path relative to workspace' },
        },
        required: ['file_path'],
      },
    },
    // --- Proposal Tool ---
    {
      name: 'create_proposal',
      description: 'Always use this tool when presenting external sources — never list papers, references, or URLs as inline prose. Present interactive, verifiable choice cards. Always include url for direct verification; include doi when available (auto-imports to reference library on selection). Use for: paper recommendations, reference candidates, competing approaches, methodology options. Requires 2-5 options.',
      input_schema: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'The question or prompt to display above the options' },
          options: {
            type: 'array',
            description: '2-5 options to present',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'Option title' },
                description: { type: 'string', description: 'Option description' },
                url: { type: 'string', description: 'URL for the user to verify the source (strongly recommended — always include when available)' },
                doi: { type: 'string', description: 'Optional DOI — auto-adds to library on Select, derives Open link if url omitted' },
              },
              required: ['title', 'description'],
            },
          },
        },
        required: ['prompt', 'options'],
      },
    },
    // --- File Operation Tools ---
    {
      name: 'rename_file',
      description: 'Rename a file or directory. Automatically updates wiki links.',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Current file path relative to workspace' },
          new_name: { type: 'string', description: 'New filename (not full path, just the name)' },
        },
        required: ['path', 'new_name'],
      },
    },
    {
      name: 'move_file',
      description: 'Move a file to a different directory. Automatically updates wiki links.',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Current file path relative to workspace' },
          destination: { type: 'string', description: 'Destination directory path relative to workspace' },
        },
        required: ['path', 'destination'],
      },
    },
    {
      name: 'duplicate_file',
      description: 'Create a copy of a file or directory with " (copy)" appended to the name.',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to duplicate relative to workspace' },
        },
        required: ['path'],
      },
    },
    {
      name: 'delete_file',
      description: 'Delete a file or directory. Recoverable via git history.',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to delete relative to workspace' },
        },
        required: ['path'],
      },
    },
    {
      name: 'create_file',
      description: 'Create a new empty file (markdown files get a title header). Optionally open it in the editor.',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to create relative to workspace' },
          open: { type: 'boolean', description: 'Whether to open the file in the editor (default false)' },
        },
        required: ['path'],
      },
    },

    // --- Notebook tools ---
    {
      name: 'read_notebook',
      description: 'Read a Jupyter notebook (.ipynb), returning all cells with their source code and outputs. Output includes cell indices for use with edit_cell, run_cell, etc.',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to .ipynb file relative to workspace' },
        },
        required: ['path'],
      },
    },
    {
      name: 'edit_cell',
      description: 'Edit the source code of a notebook cell by index (0-based).',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to .ipynb file' },
          index: { type: 'number', description: 'Cell index (0-based)' },
          new_source: { type: 'string', description: 'New cell source code' },
        },
        required: ['path', 'index', 'new_source'],
      },
    },
    {
      name: 'run_cell',
      description: 'Execute a specific code cell in a notebook and return the output. The notebook must be open in the editor with a connected kernel.',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to .ipynb file' },
          index: { type: 'number', description: 'Cell index (0-based)' },
        },
        required: ['path', 'index'],
      },
    },
    {
      name: 'run_all_cells',
      description: 'Execute all code cells in a notebook sequentially. Returns a summary of outputs. Stops on first error.',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to .ipynb file' },
        },
        required: ['path'],
      },
    },
    {
      name: 'add_cell',
      description: 'Insert a new cell at a position in the notebook.',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to .ipynb file' },
          index: { type: 'number', description: 'Position to insert (0 = top). Omit to append at end.' },
          type: { type: 'string', enum: ['code', 'markdown'], description: 'Cell type (default: code)' },
          source: { type: 'string', description: 'Cell source content' },
        },
        required: ['path', 'source'],
      },
    },
    {
      name: 'delete_cell',
      description: 'Delete a cell from the notebook by index (0-based).',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to .ipynb file' },
          index: { type: 'number', description: 'Cell index to delete (0-based)' },
        },
        required: ['path', 'index'],
      },
    },
  ]

  // Web research tools — always included so the AI can guide the user to enable them
  tools.push(
    {
      name: 'web_search',
      description: 'Search the web for information. Returns titles, URLs, and AI-generated summaries for each result. Requires an Exa API key (Settings > Tools) or a Shoulders account.',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query' },
          num_results: { type: 'number', description: 'Number of results to return (default 10, max 10)' },
        },
        required: ['query'],
      },
    },
    {
      name: 'fetch_url',
      description: 'Fetch the text content of one or more web pages (max 10). Returns clean extracted text. Requires an Exa API key (Settings > Tools) or a Shoulders account.',
      input_schema: {
        type: 'object',
        properties: {
          urls: {
            oneOf: [
              { type: 'string', description: 'A single URL to fetch' },
              { type: 'array', items: { type: 'string' }, description: 'Array of URLs (max 10)' },
            ],
          },
        },
        required: ['urls'],
      },
    },
  )

  // Filter out disabled tools
  const disabled = workspace?.disabledTools
  if (disabled && disabled.length > 0) {
    return tools.filter(t => !disabled.includes(t.name))
  }

  return tools
}

// Resolve Exa access: direct key or Shoulders proxy
async function _resolveSearchAccess(workspace) {
  if (workspace?.apiKeys?.EXA_API_KEY) {
    return { route: 'direct', key: workspace.apiKeys.EXA_API_KEY }
  }
  if (workspace?.shouldersAuth?.token) {
    await workspace.ensureFreshToken()
    if (workspace.shouldersAuth?.token) {
      return { route: 'shoulders', token: workspace.shouldersAuth.token }
    }
  }
  return null
}

const EXA_NOT_CONFIGURED = 'This tool is not configured yet. To enable web search and URL fetching, the user can either add an Exa API key in Settings > Tools, or sign in to a Shoulders account in Settings > Account.'

// Call Exa via direct key or Shoulders proxy. action: 'search' | 'contents'
async function _callExa(action, body, workspace) {
  const access = await _resolveSearchAccess(workspace)
  if (!access) return null

  let response
  if (access.route === 'direct') {
    response = await invoke('proxy_api_call', {
      request: {
        url: `https://api.exa.ai/${action}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': access.key },
        body: JSON.stringify(body),
      },
    })
  } else {
    response = await invoke('proxy_api_call', {
      request: {
        url: SHOULDERS_SEARCH_URL,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${access.token}` },
        body: JSON.stringify({ action, ...body }),
      },
    })
  }

  const data = JSON.parse(response)

  // Update balance + record usage if routed through Shoulders
  if (data._shoulders) {
    if (workspace.shouldersAuth) {
      workspace.shouldersAuth.credits = data._shoulders.credits
    }
    // Record in local usage DB so search costs appear in Settings > Usage
    const costCents = data._shoulders.cost_cents || 0
    if (costCents > 0) {
      const { useUsageStore } = await import('../stores/usage')
      useUsageStore().record({
        usage: { total: 0, cost: costCents / 100, input_total: 0, output: 0 },
        feature: 'search',
        provider: 'shoulders',
        modelId: action,
      })
    }
    delete data._shoulders
  }

  return data
}

// Resolve OpenAlex access: direct key or Shoulders proxy
async function _resolveOpenAlexAccess(workspace) {
  if (workspace?.apiKeys?.OPENALEX_API_KEY) {
    return { route: 'direct', key: workspace.apiKeys.OPENALEX_API_KEY }
  }
  if (workspace?.shouldersAuth?.token) {
    await workspace.ensureFreshToken()
    if (workspace.shouldersAuth?.token) {
      return { route: 'shoulders', token: workspace.shouldersAuth.token }
    }
  }
  return null
}

// Call OpenAlex via direct key or Shoulders proxy. Returns works array or null.
async function _callOpenAlex(query, numResults, workspace) {
  const access = await _resolveOpenAlexAccess(workspace)
  if (!access) return null

  const { searchWorks, slimResults } = await import('./openalex')

  if (access.route === 'direct') {
    // searchWorks already returns slim results
    return await searchWorks(query, { perPage: numResults, apiKey: access.key })
  }

  // Shoulders proxy route — server returns raw OpenAlex JSON
  const response = await invoke('proxy_api_call', {
    request: {
      url: SHOULDERS_SEARCH_URL,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${access.token}` },
      body: JSON.stringify({ action: 'openalex_search', query, per_page: numResults }),
    },
  })

  const data = JSON.parse(response)

  // Update balance + record usage if routed through Shoulders
  if (data._shoulders) {
    if (workspace.shouldersAuth) {
      workspace.shouldersAuth.credits = data._shoulders.credits
    }
    const costCents = data._shoulders.cost_cents || 0
    if (costCents > 0) {
      const { useUsageStore } = await import('../stores/usage')
      useUsageStore().record({
        usage: { total: 0, cost: costCents / 100, input_total: 0, output: 0 },
        feature: 'search',
        provider: 'shoulders',
        modelId: 'openalex_search',
      })
    }
    delete data._shoulders
  }

  // Slim raw results: reconstruct abstracts, strip institution metadata
  return slimResults(data.results)
}

export async function executeSingleTool(name, input, workspace) {
  // Guard: reject disabled tools
  if (workspace?.disabledTools?.includes(name)) {
    return `Tool "${name}" is disabled by user.`
  }

  const resolvePath = (p) => {
    if (!workspace.path) return null
    if (!p) return workspace.path

    // Resolve relative to workspace
    const resolved = p.startsWith('/')
      ? p
      : workspace.path + '/' + p

    // Normalize (resolve .., ., etc.)
    const parts = resolved.split('/')
    const normalized = []
    for (const part of parts) {
      if (part === '..') normalized.pop()
      else if (part !== '.' && part !== '') normalized.push(part)
    }
    const canonicalized = '/' + normalized.join('/')

    // Verify it's within workspace
    if (!canonicalized.startsWith(workspace.path)) {
      return null  // Path escapes workspace
    }

    return canonicalized
  }

  const PATH_ERROR = 'Error: path is outside the workspace. Only files within the project folder can be accessed.'

  switch (name) {
    case 'run_command':
      return await invoke('run_shell_command', { cwd: workspace.path, command: input.command })

    case 'read_file': {
      const readPath = resolvePath(input.path)
      if (!readPath) return PATH_ERROR
      if (readPath.endsWith('.docx')) {
        const sd = useEditorStore().getAnySuperdoc(readPath)
        if (sd?.activeEditor) {
          return extractDocumentText(sd.activeEditor.state)
        }
        return '[DOCX file not open. Open it in the editor for AI to read.]'
      }
      if (readPath.toLowerCase().endsWith('.ipynb')) {
        const raw = await invoke('read_file', { path: readPath })
        const { parseNotebook, formatNotebookAsText } = await import('../utils/notebookFormat')
        const nb = parseNotebook(raw)
        return formatNotebookAsText(nb.cells, readPath)
      }
      if (readPath.toLowerCase().endsWith('.pdf')) {
        const { extractTextFromPdf } = await import('../utils/pdfMetadata')
        const text = await extractTextFromPdf(readPath)
        const truncated = text.length > 50000
          ? text.slice(0, 50000) + '\n... [truncated at 50KB]'
          : text
        // Return structured result: text for display/OpenAI fallback, path for native PDF
        return { _pdfPath: readPath, text: truncated }
      }
      return await invoke('read_file', { path: readPath })
    }

    case 'write_file': {
      const path = resolvePath(input.path)
      if (!path) return PATH_ERROR
      const reviews = useReviewsStore()
      const filesStore = useFilesStore()

      // Read old content before writing
      let oldContent = ''
      try {
        oldContent = await invoke('read_file', { path })
      } catch (e) {
        // File doesn't exist yet — that's fine
      }

      await invoke('write_file', { path, content: input.content })

      // Record for review (unless direct mode)
      if (!reviews.directMode) {
        // Update files store cache BEFORE recording pending edit
        filesStore.fileContents[path] = input.content

        const editorStore = useEditorStore()
        editorStore.openFile(path)

        const editId = `chat-${Date.now()}-${nanoid(6)}`
        reviews.pendingEdits.push({
          id: editId,
          timestamp: new Date().toISOString(),
          tool: 'Write',
          file_path: path,
          content: input.content,
          old_content: oldContent,
          status: 'pending',
        })
        await reviews.savePendingEdits()
      }

      return `File written: ${path}`
    }

    case 'edit_file': {
      const path = resolvePath(input.path)
      if (!path) return PATH_ERROR
      const reviews = useReviewsStore()
      const filesStore = useFilesStore()

      // DOCX files: edit through SuperDoc AIActions.literalReplace (documented API)
      if (path.endsWith('.docx')) {
        const editorStore = useEditorStore()
        const ai = editorStore.getAnyAiActions(path)
        const sd = editorStore.getAnySuperdoc(path)
        if (!sd?.activeEditor) throw new Error('DOCX file must be open to edit.')
        if (!ai) throw new Error('DOCX AIActions not ready. Wait for the editor to fully load.')

        const result = await ai.action.literalReplace(input.old_string, input.new_string, {
          caseSensitive: true,
          trackChanges: !reviews.directMode,
        })

        if (!result.success) throw new Error('old_string not found in DOCX.')

        // Update text cache
        filesStore.fileContents[path] = sd.activeEditor.state.doc.textContent
        return `Edited DOCX${!reviews.directMode ? ' (tracked change)' : ''}: ${path}`
      }

      // Read current content
      const currentContent = await invoke('read_file', { path })

      if (!currentContent.includes(input.old_string)) {
        throw new Error(`old_string not found in ${path}. Make sure it matches exactly (including whitespace).`)
      }

      // Apply the replacement
      const newContent = currentContent.replace(input.old_string, input.new_string)
      await invoke('write_file', { path, content: newContent })

      // Record for review (unless direct mode)
      if (!reviews.directMode) {
        // Update files store cache BEFORE recording pending edit
        // (avoids race: editor needs new content when merge view checks)
        filesStore.fileContents[path] = newContent

        const editorStore = useEditorStore()
        editorStore.openFile(path)

        const editId = `chat-${Date.now()}-${nanoid(6)}`
        reviews.pendingEdits.push({
          id: editId,
          timestamp: new Date().toISOString(),
          tool: 'Edit',
          file_path: path,
          old_string: input.old_string,
          new_string: input.new_string,
          old_content: currentContent,
          status: 'pending',
        })
        await reviews.savePendingEdits()
      }

      return `File edited: ${path}`
    }

    case 'list_files': {
      const path = resolvePath(input.path)
      if (!path) return PATH_ERROR
      const tree = await invoke('read_dir_recursive', { path })
      const lines = []
      const flatten = (entries, prefix = '') => {
        for (const e of entries) {
          lines.push(`${prefix}${e.is_dir ? '\u{1F4C1} ' : ''}${e.name}`)
          if (e.children) flatten(e.children, prefix + '  ')
        }
      }
      flatten(tree)
      return lines.join('\n')
    }

    case 'search_content': {
      const results = await invoke('search_file_contents', {
        dir: workspace.path,
        query: input.query,
        maxResults: input.max_results || 20,
      })
      return results.map(r => `${r.path}:${r.line}: ${r.text}`).join('\n')
    }

    case 'search_references': {
      const { useReferencesStore } = await import('../stores/references')
      const refsStore = useReferencesStore()
      const matches = refsStore.searchRefs(input.query)
      if (matches.length === 0) return 'No matching references found.'
      return matches.slice(0, 20).map(r => {
        const authors = (r.author || []).map(a => a.family || '').join(', ')
        const year = r.issued?.['date-parts']?.[0]?.[0] || ''
        return `@${r._key}: ${authors} (${year}). ${r.title || 'Untitled'}. ${r.DOI ? 'DOI: ' + r.DOI : ''}`
      }).join('\n')
    }

    case 'get_reference': {
      const { useReferencesStore } = await import('../stores/references')
      const refsStore = useReferencesStore()
      const ref = refsStore.getByKey(input.key)
      if (!ref) return `Reference @${input.key} not found.`
      return JSON.stringify(ref, null, 2)
    }

    case 'add_reference': {
      const { useReferencesStore } = await import('../stores/references')
      const refsStore = useReferencesStore()
      const raw = input.input.trim()

      // Detect BibTeX: starts with @type{
      if (/^@\w+\s*\{/.test(raw)) {
        const { parseBibtex } = await import('../utils/bibtexParser')
        const entries = parseBibtex(raw)
        if (!entries || entries.length === 0) return 'Failed to parse BibTeX input.'
        const results = []
        for (const csl of entries) {
          csl._needsReview = false
          csl._matchMethod = 'bibtex'
          csl._addedAt = new Date().toISOString()
          const r = refsStore.addReference(csl)
          results.push(r.status === 'added'
            ? `Added @${r.key}: ${csl.title || 'Untitled'}`
            : `Duplicate: @${r.key}`)
        }
        return results.join('\n')
      }

      // Otherwise treat as DOI
      const { lookupByDoi } = await import('./crossref')
      const doi = raw.replace(/^https?:\/\/doi\.org\//, '').replace(/^doi:\s*/i, '')
      const csl = await lookupByDoi(doi)
      if (!csl) return `DOI not found: ${doi}`
      csl._needsReview = false
      csl._matchMethod = 'doi'
      csl._addedAt = new Date().toISOString()
      const result = refsStore.addReference(csl)
      return result.status === 'added'
        ? `Added reference @${result.key}: ${csl.title}`
        : `Duplicate: @${result.key} already exists.`
    }

    case 'cite_reference': {
      const editorStore = useEditorStore()
      const pane = editorStore.activePane
      if (!pane?.activeTab) return 'No active editor.'
      const view = editorStore.getEditorView(pane.id, pane.activeTab)
      if (!view) return 'No active text editor.'
      const isTexFile = pane.activeTab.endsWith('.tex') || pane.activeTab.endsWith('.latex')
      const cite = isTexFile ? `\\cite{${input.key}}` : `[@${input.key}]`
      const pos = view.state.selection.main.head
      view.dispatch({
        changes: { from: pos, to: pos, insert: cite },
        selection: { anchor: pos + cite.length },
      })
      return `Inserted ${cite} at cursor.`
    }

    case 'edit_reference': {
      const { useReferencesStore } = await import('../stores/references')
      const refsStore = useReferencesStore()
      if (!refsStore.getByKey(input.key)) return `Reference @${input.key} not found.`
      const ok = refsStore.updateReference(input.key, input.updates)
      if (!ok) return `Failed to update @${input.key}.`
      return `Updated @${input.updates._key || input.key}: ${Object.keys(input.updates).join(', ')}`
    }

    // --- Web Research Tools ---

    case 'web_search': {
      const numResults = Math.min(input.num_results || 10, 10)
      const data = await _callExa('search', {
        query: input.query,
        numResults,
        type: 'auto',
        useAutoprompt: true,
        summary: {
          query: 'Return: Summary (2-sentence synthesis); Key data (statistics, dates, names); Classification (Academic Study, News Article, Blog, Marketing, etc.). Fallback for missing fields: null.',
        },
      }, workspace)
      if (!data) return EXA_NOT_CONFIGURED
      if (!data.results || data.results.length === 0) return 'No results found.'
      return data.results.map((r, i) => {
        const parts = [`${i + 1}. ${r.title}`, `   URL: ${r.url}`]
        if (r.author) parts.push(`   Author: ${r.author}`)
        if (r.publishedDate) parts.push(`   Published: ${r.publishedDate}`)
        if (r.summary) parts.push(`   ${r.summary}`)
        return parts.join('\n')
      }).join('\n\n')
    }

    case 'search_papers': {
      const numResults = Math.min(input.num_results || 5, 10)
      const errors = []

      // ── Primary: OpenAlex (structured academic metadata, 450M+ works) ──
      const hasOpenAlex = await _resolveOpenAlexAccess(workspace)
      if (hasOpenAlex) {
        try {
          const works = await _callOpenAlex(input.query, numResults, workspace)
          if (works && works.length > 0) {
            return JSON.stringify(works, null, 2)
          }
        } catch (e) {
          errors.push(`OpenAlex: ${e.message || e}`)
          console.warn('[search_papers] OpenAlex failed:', e)
        }
      }

      // ── Fallback 1: Exa (semantic search) ──
      const hasExa = await _resolveSearchAccess(workspace)
      if (hasExa) {
        try {
          const data = await _callExa('search', {
            query: input.query,
            numResults,
            type: 'auto',
            category: 'research paper',
            summary: {
              query: 'If research article: title, authors, journal, abstract, peer-reviewed [yes/no/unclear], open source [yes/no/unclear]. If other: 2 sentence summary.',
            },
          }, workspace)
          if (data?.results?.length > 0) {
            const note = errors.length > 0
              ? `[Note: OpenAlex failed (${errors[0]}). Results below are from Exa semantic search and may lack citation counts or DOIs.]\n\n`
              : ''
            return note + data.results.map((r, i) => {
              const parts = [`${i + 1}. ${r.title}`, `   URL: ${r.url}`]
              if (r.author) parts.push(`   Author: ${r.author}`)
              if (r.publishedDate) parts.push(`   Published: ${r.publishedDate}`)
              if (r.summary) parts.push(`   ${r.summary}`)
              return parts.join('\n')
            }).join('\n\n')
          }
        } catch (e) {
          errors.push(`Exa: ${e.message || e}`)
          console.warn('[search_papers] Exa failed:', e)
        }
      }

      // ── Fallback 2: CrossRef (keyword search, weakest) ──
      try {
        const encoded = encodeURIComponent(input.query)
        const response = await invoke('proxy_api_call', {
          request: {
            url: `https://api.crossref.org/works?query.bibliographic=${encoded}&rows=${numResults}&select=DOI,title,author,published-print,abstract`,
            method: 'GET',
            headers: {},
            body: '',
          },
        })
        const crData = JSON.parse(response)
        const items = crData?.message?.items || []
        if (items.length > 0) {
          const note = errors.length > 0
            ? `[Note: Primary search backends failed (${errors.join('; ')}). Results below are from CrossRef keyword search and may be less relevant.]\n\n`
            : ''
          return note + items.map((item, i) => {
            const title = (item.title || ['Untitled'])[0]
            const authors = (item.author || []).map(a => a.family || a.name || '').filter(Boolean).join(', ')
            const year = item['published-print']?.['date-parts']?.[0]?.[0] || ''
            const doi = item.DOI || ''
            const abstract = (item.abstract || '').replace(/<[^>]*>/g, '').slice(0, 200)
            return `${i + 1}. ${title}\n   Authors: ${authors || 'Unknown'}\n   Year: ${year}  DOI: ${doi}\n   ${abstract ? abstract + '...' : ''}`
          }).join('\n\n')
        }
      } catch (e) {
        errors.push(`CrossRef: ${e.message || e}`)
        console.warn('[search_papers] CrossRef failed:', e)
      }

      // ── All failed ──
      if (errors.length > 0) {
        return `No papers found. Search backends encountered errors:\n${errors.map(e => `- ${e}`).join('\n')}\n\nSuggestions: Try a different query, check your internet connection, or add an OpenAlex API key in Settings > Tools.`
      }
      return 'No papers found.'
    }

    case 'fetch_url': {
      // Normalize input: accept string or array
      const urls = typeof input.urls === 'string' ? [input.urls] : (input.urls || [])
      if (urls.length === 0) throw new Error('No URLs provided.')
      if (urls.length > 10) throw new Error('Maximum 10 URLs per request.')

      // Prefer Exa /contents (handles JS-rendered pages, bot protection)
      const hasAccess = await _resolveSearchAccess(workspace)
      if (hasAccess) {
        try {
          const data = await _callExa('contents', {
            urls,
            text: { maxCharacters: 10000 },
            livecrawl: 'fallback',
          }, workspace)
          if (data.results && data.results.length > 0) {
            return data.results.map(r => {
              const parts = [`## ${r.title || 'Untitled'}`, `URL: ${r.url}`]
              if (r.author) parts.push(`Author: ${r.author}`)
              if (r.publishedDate) parts.push(`Published: ${r.publishedDate}`)
              parts.push('', r.text || 'No content available')
              return parts.join('\n')
            }).join('\n\n---\n\n')
          }
        } catch (e) { console.warn('[fetch_url] Exa failed, falling back to direct fetch:', e) }
      }

      // Fallback: Rust-based fetch (no JS rendering, may be blocked by some sites)
      if (urls.length === 1) {
        return await invoke('fetch_url_content', { url: urls[0] })
      }
      const results = []
      for (const url of urls) {
        try {
          const text = await invoke('fetch_url_content', { url })
          results.push(`## ${url}\n${text}`)
        } catch (e) {
          results.push(`## ${url}\nError: ${e}`)
        }
      }
      return results.join('\n\n---\n\n')
    }

    // --- Task Injection Tools ---

    case 'add_task': {
      const path = resolvePath(input.file_path)
      if (!path) return PATH_ERROR
      const filesStore = useFilesStore()
      const editorStore = useEditorStore()
      const { useTasksStore } = await import('../stores/tasks')
      const tasksStore = useTasksStore()

      // Get file content
      let content = filesStore.fileContents[path]
      if (!content) {
        content = await invoke('read_file', { path })
      }

      // Find target text position
      const idx = content.indexOf(input.target_text)
      if (idx === -1) throw new Error(`target_text not found in ${path}. Make sure it matches exactly.`)

      const from = idx
      const to = idx + input.target_text.length

      // Open file in editor so gutter dots appear
      editorStore.openFile(path)

      // Create thread with pre-populated messages
      const threadId = tasksStore.createThreadFromChat(
        path,
        { from, to },
        input.target_text,
        null, // use default model
        input.message,
        input.proposed_edit || null,
      )

      return `Task created on "${input.target_text.slice(0, 50)}${input.target_text.length > 50 ? '...' : ''}" in ${path.split('/').pop()}. Thread ID: ${threadId}`
    }

    case 'read_tasks': {
      const path = resolvePath(input.file_path)
      if (!path) return PATH_ERROR
      const { useTasksStore } = await import('../stores/tasks')
      const tasksStore = useTasksStore()
      const threads = tasksStore.threadsForFile(path)
      if (threads.length === 0) return `No tasks on ${path.split('/').pop()}.`
      return threads.map(t => {
        const msgs = t.messages
          .filter(m => !m._isToolResult && !m._synthetic)
          .map(m => `  [${m.role}]: ${m.content?.slice(0, 200) || ''}`)
          .join('\n')
        const edits = t.messages
          .flatMap(m => m.toolCalls || [])
          .filter(tc => tc.name === 'propose_edit')
          .map(tc => `  [proposed edit]: "${tc.input?.old_string?.slice(0, 50)}" -> "${tc.input?.new_string?.slice(0, 50)}" (${tc.status})`)
          .join('\n')
        return `Thread ${t.id} (${t.status}):\n  Selection: "${t.selectedText?.slice(0, 80)}"\n${msgs}${edits ? '\n' + edits : ''}`
      }).join('\n\n')
    }

    // --- Proposal Tool ---

    case 'create_proposal': {
      if (!input.options || input.options.length < 2 || input.options.length > 5) {
        throw new Error('create_proposal requires 2-5 options.')
      }
      return JSON.stringify({ _type: 'proposal', prompt: input.prompt, options: input.options })
    }

    // --- File Operation Tools ---

    case 'rename_file': {
      const path = resolvePath(input.path)
      if (!path) return PATH_ERROR
      const parts = path.split('/')
      parts[parts.length - 1] = input.new_name
      const newPath = parts.join('/')
      const filesStore = useFilesStore()
      await filesStore.renamePath(path, newPath)
      return `Renamed: ${path.split('/').pop()} -> ${input.new_name}`
    }

    case 'move_file': {
      const path = resolvePath(input.path)
      if (!path) return PATH_ERROR
      const destDir = resolvePath(input.destination)
      if (!destDir) return PATH_ERROR
      const filesStore = useFilesStore()
      await filesStore.movePath(path, destDir)
      const name = path.split('/').pop()
      return `Moved ${name} to ${input.destination}`
    }

    case 'duplicate_file': {
      const path = resolvePath(input.path)
      if (!path) return PATH_ERROR
      const isDir = await invoke('is_directory', { path })
      const ext = (!isDir && path.includes('.')) ? '.' + path.split('.').pop() : ''
      const base = ext ? path.slice(0, -ext.length) : path
      let copyPath = `${base} (copy)${ext}`
      let n = 2
      while (await invoke('path_exists', { path: copyPath })) {
        copyPath = `${base} (copy ${n})${ext}`
        n++
      }
      if (isDir) {
        await invoke('copy_dir', { src: path, dest: copyPath })
      } else {
        await invoke('copy_file', { src: path, dest: copyPath })
      }
      return `Duplicated: ${copyPath.split('/').pop()}`
    }

    case 'delete_file': {
      const path = resolvePath(input.path)
      if (!path) return PATH_ERROR
      const filesStore = useFilesStore()
      await filesStore.deletePath(path)
      return `Deleted: ${path.split('/').pop()}`
    }

    case 'create_file': {
      const path = resolvePath(input.path)
      if (!path) return PATH_ERROR
      // Ensure parent directory exists
      const parentDir = path.split('/').slice(0, -1).join('/')
      if (parentDir) await invoke('create_dir', { path: parentDir })
      // Determine initial content
      const name = path.split('/').pop()
      const content = name.endsWith('.md')
        ? `# ${name.replace(/\.md$/, '')}\n\n`
        : ''
      await invoke('create_file', { path, content })
      if (input.open) {
        const editorStore = useEditorStore()
        const filesStore = useFilesStore()
        filesStore.fileContents[path] = content
        editorStore.openFile(path)
      }
      return `Created: ${path.split('/').pop()}`
    }

    // ---- Notebook tools ----

    case 'read_notebook': {
      const path = resolvePath(input.path)
      if (!path) return PATH_ERROR
      const raw = await invoke('read_file', { path })
      const { parseNotebook, formatNotebookAsText } = await import('../utils/notebookFormat')
      const nb = parseNotebook(raw)
      const text = formatNotebookAsText(nb.cells, path)
      return text.length > 50000 ? text.slice(0, 50000) + '\n...[truncated]' : text
    }

    case 'edit_cell': {
      const path = resolvePath(input.path)
      if (!path) return PATH_ERROR
      const raw = await invoke('read_file', { path })
      const { parseNotebook, serializeNotebook } = await import('../utils/notebookFormat')
      const nb = parseNotebook(raw)

      if (input.index < 0 || input.index >= nb.cells.length) {
        throw new Error(`Cell index ${input.index} out of range (0-${nb.cells.length - 1})`)
      }

      const reviews = useReviewsStore()
      const cell = nb.cells[input.index]

      if (!reviews.directMode) {
        // Check for existing pending edit on this cell
        const existing = reviews.notebookEditForCell(path, cell.id)
        if (existing) {
          return `Cell ${input.index} already has a pending edit. Accept or reject it first.`
        }

        reviews.pendingEdits.push({
          id: `nb-edit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          tool: 'NotebookEditCell',
          file_path: path,
          cell_id: cell.id,
          cell_index: input.index,
          old_source: cell.source,
          new_source: input.new_source,
          status: 'pending',
        })
        await reviews.savePendingEdits()
        window.dispatchEvent(new CustomEvent('notebook-pending-edit', {
          detail: { file_path: path, cell_id: cell.id },
        }))
        return `Cell ${input.index} edit queued for review.`
      }

      nb.cells[input.index].source = input.new_source
      const newContent = serializeNotebook(nb.cells, nb.metadata, nb.nbformat, nb.nbformat_minor)
      await invoke('write_file', { path, content: newContent })

      const filesStore = useFilesStore()
      filesStore.fileContents[path] = newContent

      return `Cell ${input.index} updated.`
    }

    case 'run_cell': {
      const path = resolvePath(input.path)
      if (!path) return PATH_ERROR
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          window.removeEventListener('cell-execution-complete', handler)
          reject(new Error('Cell execution timed out (60s). Is the notebook open with a kernel connected?'))
        }, 60000)

        function handler(e) {
          if (e.detail?.path !== path || e.detail?.index !== input.index) return
          window.removeEventListener('cell-execution-complete', handler)
          clearTimeout(timeout)
          if (e.detail.error) resolve(`Error: ${e.detail.error}`)
          else resolve(e.detail.output || '(no output)')
        }

        window.addEventListener('cell-execution-complete', handler)
        window.dispatchEvent(new CustomEvent('run-notebook-cell', {
          detail: { path, index: input.index },
        }))
      })
    }

    case 'run_all_cells': {
      const path = resolvePath(input.path)
      if (!path) return PATH_ERROR
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          window.removeEventListener('all-cells-execution-complete', handler)
          reject(new Error('Notebook execution timed out (5 min). Is the notebook open?'))
        }, 300000)

        function handler(e) {
          if (e.detail?.path !== path) return
          window.removeEventListener('all-cells-execution-complete', handler)
          clearTimeout(timeout)
          resolve(e.detail.summary || 'All cells executed.')
        }

        window.addEventListener('all-cells-execution-complete', handler)
        window.dispatchEvent(new CustomEvent('run-all-notebook-cells', {
          detail: { path },
        }))
      })
    }

    case 'add_cell': {
      const path = resolvePath(input.path)
      if (!path) return PATH_ERROR
      const raw = await invoke('read_file', { path })
      const { parseNotebook, serializeNotebook, generateCellId } = await import('../utils/notebookFormat')
      const nb = parseNotebook(raw)

      const newCell = {
        id: generateCellId(),
        type: input.type || 'code',
        source: input.source || '',
        outputs: [],
        executionCount: null,
        metadata: {},
      }

      const idx = input.index != null ? Math.min(Math.max(0, input.index), nb.cells.length) : nb.cells.length
      const reviews = useReviewsStore()

      if (!reviews.directMode) {
        reviews.pendingEdits.push({
          id: `nb-add-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          tool: 'NotebookAddCell',
          file_path: path,
          cell_id: newCell.id,
          cell_index: idx,
          cell_type: newCell.type,
          cell_source: newCell.source,
          status: 'pending',
        })
        await reviews.savePendingEdits()
        window.dispatchEvent(new CustomEvent('notebook-pending-edit', {
          detail: { file_path: path, cell_id: newCell.id },
        }))
        return `New ${newCell.type} cell at index ${idx} queued for review.`
      }

      nb.cells.splice(idx, 0, newCell)

      const newContent = serializeNotebook(nb.cells, nb.metadata, nb.nbformat, nb.nbformat_minor)
      await invoke('write_file', { path, content: newContent })

      const filesStore = useFilesStore()
      filesStore.fileContents[path] = newContent

      return `Added ${newCell.type} cell at index ${idx}.`
    }

    case 'delete_cell': {
      const path = resolvePath(input.path)
      if (!path) return PATH_ERROR
      const raw = await invoke('read_file', { path })
      const { parseNotebook, serializeNotebook } = await import('../utils/notebookFormat')
      const nb = parseNotebook(raw)

      if (input.index < 0 || input.index >= nb.cells.length) {
        throw new Error(`Cell index ${input.index} out of range (0-${nb.cells.length - 1})`)
      }
      if (nb.cells.length <= 1) {
        throw new Error('Cannot delete the last cell in a notebook.')
      }

      const reviews = useReviewsStore()
      const cell = nb.cells[input.index]

      if (!reviews.directMode) {
        const existing = reviews.notebookEditForCell(path, cell.id)
        if (existing) {
          return `Cell ${input.index} already has a pending edit. Accept or reject it first.`
        }

        reviews.pendingEdits.push({
          id: `nb-del-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          tool: 'NotebookDeleteCell',
          file_path: path,
          cell_id: cell.id,
          cell_index: input.index,
          cell_source: cell.source,
          cell_type: cell.type,
          status: 'pending',
        })
        await reviews.savePendingEdits()
        window.dispatchEvent(new CustomEvent('notebook-pending-edit', {
          detail: { file_path: path, cell_id: cell.id },
        }))
        return `Delete of ${cell.type} cell at index ${input.index} queued for review.`
      }

      const deleted = nb.cells.splice(input.index, 1)[0]
      const newContent = serializeNotebook(nb.cells, nb.metadata, nb.nbformat, nb.nbformat_minor)
      await invoke('write_file', { path, content: newContent })

      const filesStore = useFilesStore()
      filesStore.fileContents[path] = newContent

      return `Deleted ${deleted.type} cell at index ${input.index}.`
    }

    default:
      return `Unknown tool: ${name}`
  }
}
