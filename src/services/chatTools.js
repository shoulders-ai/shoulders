import { invoke } from '@tauri-apps/api/core'
import { tool } from 'ai'
import { z } from 'zod'
import { useReviewsStore } from '../stores/reviews'
import { useEditorStore } from '../stores/editor'
import { useFilesStore } from '../stores/files'
import { nanoid } from '../stores/utils'
import { extractDocumentText, extractBlockList } from './docxContext'
import { SHOULDERS_SEARCH_URL } from './apiClient'
import { isMultimodalImage, isPdf, getMimeType } from '../utils/fileTypes'

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
          { name: 'write_file', description: 'Create or overwrite a file' },
          { name: 'edit_file', description: 'Edit an existing file' },
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
      { name: 'add_comment', description: 'Add comment to text' },
      { name: 'reply_to_comment', description: 'Reply to a comment' },
      { name: 'resolve_comment', description: 'Resolve a comment' },
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

// ─── Typographic Fuzzy Match ─────────────────────────────────────────
//
// LLMs normalize typographic characters when generating tool arguments:
//   "curly quotes" → "straight quotes", em dash → hyphen, … → ...
// This builds a regex from old_string that matches both ASCII and Unicode variants,
// so edit_file succeeds even when the LLM substitutes typographic lookalikes.

function _buildTypographicRegex(str) {
  let pattern = ''
  let i = 0
  while (i < str.length) {
    // Multi-char sequences first (order matters)
    if (str[i] === '.' && str[i + 1] === '.' && str[i + 2] === '.') {
      pattern += '(?:\\.\\.\\.|\u2026)'
      i += 3
      continue
    }
    if (str[i] === '-' && str[i + 1] === '-') {
      pattern += '(?:--|[\u2013\u2014])'
      i += 2
      continue
    }
    const c = str[i]
    switch (c) {
      case '"':  pattern += '[\u201C\u201D\u201E\u00AB\u00BB"]'; break
      case "'":  pattern += "[\u2018\u2019\u201A\u2039\u203A']"; break
      case '-':  pattern += '[-\u2013\u2014]'; break
      case ' ':  pattern += '[\u00A0 ]'; break
      default:   pattern += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }
    i++
  }
  return new RegExp(pattern)
}

// ─── Path Security ──────────────────────────────────────────────────

function _resolvePath(p, workspace) {
  if (!workspace.path) return null
  if (!p) return workspace.path

  const resolved = p.startsWith('/')
    ? p
    : workspace.path + '/' + p

  const parts = resolved.split('/')
  const normalized = []
  for (const part of parts) {
    if (part === '..') normalized.pop()
    else if (part !== '.' && part !== '') normalized.push(part)
  }
  const canonicalized = '/' + normalized.join('/')

  if (!canonicalized.startsWith(workspace.path)) return null
  return canonicalized
}

const PATH_ERROR = 'Error: path is outside the workspace. Only files within the project folder can be accessed.'

// ─── Search Helpers ──────────────────────────────────────────────────

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
        modelId: action,
      })
    }
    delete data._shoulders
  }

  return data
}

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

async function _callOpenAlex(query, numResults, workspace) {
  const access = await _resolveOpenAlexAccess(workspace)
  if (!access) return null

  const { searchWorks, slimResults } = await import('./openalex')

  if (access.route === 'direct') {
    return await searchWorks(query, { perPage: numResults, apiKey: access.key })
  }

  const response = await invoke('proxy_api_call', {
    request: {
      url: SHOULDERS_SEARCH_URL,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${access.token}` },
      body: JSON.stringify({ action: 'openalex_search', query, per_page: numResults }),
    },
  })

  const data = JSON.parse(response)

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

  return slimResults(data.results)
}


// ─── AI SDK Tools ────────────────────────────────────────────────────

/**
 * Get all AI SDK tools for the workspace.
 * Returns an object of { toolName: tool({ ... }) } that AI SDK can consume directly.
 *
 * @param {object} workspace - Workspace store instance
 * @returns {object} Named tools for AI SDK
 */
export function getAiTools(workspace) {
  const disabled = workspace?.disabledTools || []

  const allTools = {

    // ── Workspace Tools ─────────────────────────────────────────────

    run_command: tool({
      description: 'Execute a bash command in the workspace directory. Use for git, npm, build tools, etc.',
      inputSchema: z.object({
        command: z.string().describe('The bash command to execute'),
      }),
      execute: async ({ command }) => {
        return await invoke('run_shell_command', { cwd: workspace.path, command })
      },
    }),

    read_file: tool({
      description: 'Read the contents of a file. Supports text files, images (visual analysis via AI), PDFs (native document understanding), and DOCX (when open). For .docx files, returns numbered paragraphs (¶1, ¶2 …) — use these numbers with edit_file. Use this instead of run_command for reading files.',
      inputSchema: z.object({
        path: z.string().describe('File path relative to workspace'),
      }),
      execute: async ({ path }) => {
        const readPath = _resolvePath(path, workspace)
        if (!readPath) return PATH_ERROR

        if (readPath.endsWith('.docx')) {
          const sd = useEditorStore().getAnySuperdoc(readPath)
          if (sd?.activeEditor) {
            const blocks = extractBlockList(sd.activeEditor.state)
            if (!blocks.length) return '[DOCX file is empty or has no readable paragraphs.]'
            return blocks.map(b => `¶${b.num}: ${b.text}`).join('\n')
          }
          return '[DOCX file not open. Open it in the editor for AI to read.]'
        }

        if (readPath.toLowerCase().endsWith('.ipynb')) {
          const raw = await invoke('read_file', { path: readPath })
          const { parseNotebook, formatNotebookAsText } = await import('../utils/notebookFormat')
          const nb = parseNotebook(raw)
          return formatNotebookAsText(nb.cells, readPath)
        }

        // PDF: read as base64 for native document understanding
        if (isPdf(readPath)) {
          try {
            const base64 = await invoke('read_file_base64', { path: readPath })
            // ~32MB base64 limit (roughly 24MB file)
            if (base64.length > 32 * 1024 * 1024) {
              return `[PDF file too large for native analysis (${Math.round(base64.length / 1024 / 1024)}MB). Try a smaller document.]`
            }
            return { _type: 'pdf', base64, filename: readPath.split('/').pop() }
          } catch (e) {
            return `[Error reading PDF: ${e}]`
          }
        }

        // Images: read as base64 for visual understanding
        if (isMultimodalImage(readPath)) {
          try {
            const base64 = await invoke('read_file_base64', { path: readPath })
            // ~20MB base64 limit
            if (base64.length > 20 * 1024 * 1024) {
              return `[Image too large for visual analysis (${Math.round(base64.length / 1024 / 1024)}MB). Try a smaller image.]`
            }
            const mediaType = getMimeType(readPath)
            return { _type: 'image', base64, filename: readPath.split('/').pop(), mediaType }
          } catch (e) {
            return `[Error reading image: ${e}]`
          }
        }

        // Non-multimodal images (svg, bmp, ico): text description
        if (/\.(svg|bmp|ico)$/i.test(readPath)) {
          const ext = readPath.split('.').pop().toLowerCase()
          if (ext === 'svg') {
            // SVG is text-based, read as text
            return await invoke('read_file', { path: readPath })
          }
          return `[${ext.toUpperCase()} image format is not supported for visual analysis. Supported formats: PNG, JPG, GIF, WebP.]`
        }

        const content = await invoke('read_file', { path: readPath })

        // Append any active comments on this file
        const { useCommentsStore } = await import('../stores/comments')
        const commentsStore = useCommentsStore()
        const unresolved = commentsStore.unresolvedForFile(readPath)
        if (unresolved.length) {
          const lines = content.split('\n')
          let commentBlock = '\n\n<document-comments>\n'
          for (const c of unresolved) {
            const lineNum = content.substring(0, c.range.from).split('\n').length
            commentBlock += `  <comment id="${c.id}" line="${lineNum}" author="${c.author}">`
            commentBlock += c.text
            for (const r of c.replies) {
              commentBlock += `\n    <reply author="${r.author}">${r.text}</reply>`
            }
            commentBlock += '</comment>\n'
          }
          commentBlock += '</document-comments>'
          return content + commentBlock
        }

        return content
      },
      toModelOutput({ output }) {
        // Image with base64: send as image-data content for native vision
        if (output?._type === 'image' && output.base64) {
          return {
            type: 'content',
            value: [{ type: 'image-data', data: output.base64, mediaType: output.mediaType }],
          }
        }
        // PDF with base64: text placeholder (native PDF injected via prepareStep)
        if (output?._type === 'pdf' && output.base64) {
          return {
            type: 'text',
            value: `PDF file "${output.filename}" has been read. The full document is attached for your analysis.`,
          }
        }
        // Default: let AI SDK handle strings and objects normally
        if (typeof output === 'string') return { type: 'text', value: output }
        return { type: 'json', value: output ?? null }
      },
    }),

    write_file: tool({
      description: 'Create a new file or overwrite an existing one. For modifications to existing files, prefer edit_file instead.',
      inputSchema: z.object({
        path: z.string().describe('File path relative to workspace'),
        content: z.string().describe('The file content to write'),
      }),
      execute: async ({ path, content }) => {
        const resolved = _resolvePath(path, workspace)
        if (!resolved) return PATH_ERROR

        const reviews = useReviewsStore()
        const filesStore = useFilesStore()

        // Ensure parent directory exists
        const parentDir = resolved.split('/').slice(0, -1).join('/')
        if (parentDir) await invoke('create_dir', { path: parentDir })

        let oldContent = null
        try { oldContent = await invoke('read_file', { path: resolved }) } catch {}

        await invoke('write_file', { path: resolved, content })

        if (!reviews.directMode) {
          filesStore.fileContents[resolved] = content
          const editorStore = useEditorStore()
          editorStore.openFile(resolved)

          const editId = `chat-${Date.now()}-${nanoid(6)}`
          reviews.pendingEdits.push({
            id: editId,
            timestamp: new Date().toISOString(),
            tool: 'Write',
            file_path: resolved,
            content,
            old_content: oldContent,
            status: 'pending',
          })
          await reviews.savePendingEdits()
        }

        return `File written: ${resolved}`
      },
    }),

    edit_file: tool({
      description: 'Edit an existing file. For text files: provide old_string (exact match) and new_string. For .docx files: use paragraph_number (from read_file output) and new_content instead — old_string/new_string do not work on DOCX.',
      inputSchema: z.object({
        path: z.string().describe('File path relative to workspace'),
        old_string: z.string().optional().describe('Text files: exact string to replace (must be unique in the file)'),
        new_string: z.string().optional().describe('Text files: replacement text'),
        paragraph_number: z.number().int().optional().describe('DOCX only: paragraph number from read_file output (¶N)'),
        new_content: z.string().optional().describe('DOCX only: replacement text for the paragraph'),
      }),
      execute: async ({ path, old_string, new_string, paragraph_number, new_content }) => {
        const resolved = _resolvePath(path, workspace)
        if (!resolved) return PATH_ERROR

        const reviews = useReviewsStore()
        const filesStore = useFilesStore()

        // DOCX files: paragraph-based replacement via SuperDoc
        if (resolved.endsWith('.docx')) {
          // Guard against the old string-match approach being used for DOCX
          if (old_string !== undefined || new_string !== undefined) {
            return 'Error: DOCX files use paragraph addressing, not string matching. Call read_file first to get paragraph numbers (¶1, ¶2…), then call edit_file with paragraph_number and new_content.'
          }
          if (paragraph_number === undefined || new_content === undefined) {
            return 'Error: DOCX files require paragraph_number and new_content. Call read_file first to see the document structure.'
          }

          const sd = useEditorStore().getAnySuperdoc(resolved)
          if (!sd?.activeEditor) return 'Error: DOCX file must be open in the editor to edit.'

          const blocks = extractBlockList(sd.activeEditor.state)
          const target = blocks.find(b => b.num === paragraph_number)
          if (!target) {
            return `Error: Paragraph ${paragraph_number} not found (document has ${blocks.length} paragraphs). Re-read the file — paragraph numbers change after edits.`
          }

          // Use suggesting mode to create a tracked change when review is active
          const prevMode = sd._documentMode ?? 'editing'
          if (!reviews.directMode) sd.setDocumentMode('suggesting')
          try {
            sd.activeEditor.commands.replaceNodeWithHTML(target.node, `<p>${new_content}</p>`)
          } finally {
            if (!reviews.directMode) sd.setDocumentMode(prevMode)
          }

          filesStore.fileContents[resolved] = extractDocumentText(sd.activeEditor.state)
          return `Edited DOCX paragraph ${paragraph_number}${!reviews.directMode ? ' (tracked change — review in editor)' : ''}: ${resolved}`
        }

        if (old_string === undefined || new_string === undefined) {
          return 'Error: old_string and new_string are required for text files.'
        }

        const currentContent = await invoke('read_file', { path: resolved })
        const fuzzyRegex = _buildTypographicRegex(old_string)
        if (!fuzzyRegex.test(currentContent)) {
          throw new Error(`old_string not found in ${resolved}. Make sure it matches exactly (including whitespace).`)
        }

        // Use a function replacement to prevent $ patterns in new_string being interpreted as backreferences
        const newContent = currentContent.replace(fuzzyRegex, () => new_string)
        await invoke('write_file', { path: resolved, content: newContent })

        if (!reviews.directMode) {
          filesStore.fileContents[resolved] = newContent
          const editorStore = useEditorStore()
          editorStore.openFile(resolved)

          const editId = `chat-${Date.now()}-${nanoid(6)}`
          reviews.pendingEdits.push({
            id: editId,
            timestamp: new Date().toISOString(),
            tool: 'Edit',
            file_path: resolved,
            old_string,
            new_string,
            old_content: currentContent,
            status: 'pending',
          })
          await reviews.savePendingEdits()
        }

        return `File edited: ${resolved}`
      },
    }),

    list_files: tool({
      description: 'List files and directories in the workspace or a subdirectory.',
      inputSchema: z.object({
        path: z.string().optional().describe('Directory path (relative to workspace, defaults to workspace root)'),
      }),
      execute: async ({ path }) => {
        const resolved = _resolvePath(path, workspace)
        if (!resolved) return PATH_ERROR
        const tree = await invoke('read_dir_recursive', { path: resolved })
        const lines = []
        const flatten = (entries, prefix = '') => {
          for (let i = 0; i < entries.length; i++) {
            const e = entries[i]
            const last = i === entries.length - 1
            const connector = prefix + (last ? '└── ' : '├── ')
            let line = `${connector}${e.name}${e.is_dir ? '/' : ''}`
            if (e.modified) {
              line += `  (${new Date(e.modified * 1000).toISOString().slice(0, 10)})`
            }
            lines.push(line)
            if (e.children) {
              flatten(e.children, prefix + (last ? '    ' : '│   '))
            }
          }
        }
        flatten(tree)
        return lines.join('\n')
      },
    }),

    search_content: tool({
      description: 'Search for text across files in the workspace (case-insensitive). Open .docx files are searched from their cached text; closed .docx files are not searchable.',
      inputSchema: z.object({
        query: z.string().describe('Text to search for'),
        max_results: z.number().optional().describe('Maximum results (default 20)'),
      }),
      execute: async ({ query, max_results }) => {
        const limit = max_results || 20
        const results = await invoke('search_file_contents', {
          dir: workspace.path,
          query,
          maxResults: limit,
        })
        const hits = results.map(r => `${r.path}:${r.line}: ${r.text}`)

        // Also search open DOCX files from their cached text content
        // (DOCX is binary — Rust cannot search it; the cache holds extracted plain text)
        const filesStore = useFilesStore()
        const queryLower = query.toLowerCase()
        for (const [p, content] of Object.entries(filesStore.fileContents)) {
          if (!p.endsWith('.docx') || typeof content !== 'string') continue
          content.split('\n').forEach((line, i) => {
            if (line.toLowerCase().includes(queryLower))
              hits.push(`${p}:${i + 1}: ${line.trim()}`)
          })
        }

        return hits.slice(0, limit).join('\n') || 'No results found.'
      },
    }),

    // ── Reference Tools ─────────────────────────────────────────────

    search_references: tool({
      description: 'Search the reference library by title, author, year, key, or DOI.',
      inputSchema: z.object({
        query: z.string().describe('Search query'),
      }),
      execute: async ({ query }) => {
        const { useReferencesStore } = await import('../stores/references')
        const refsStore = useReferencesStore()
        const matches = refsStore.searchRefs(query)
        if (matches.length === 0) return 'No matching references found.'
        return matches.slice(0, 20).map(r => {
          const authors = (r.author || []).map(a => a.family || '').join(', ')
          const year = r.issued?.['date-parts']?.[0]?.[0] || ''
          return `@${r._key}: ${authors} (${year}). ${r.title || 'Untitled'}. ${r.DOI ? 'DOI: ' + r.DOI : ''}`
        }).join('\n')
      },
    }),

    get_reference: tool({
      description: 'Get the full metadata for a reference by its citation key.',
      inputSchema: z.object({
        key: z.string().describe('The citation key (e.g. "vaswani2017")'),
      }),
      execute: async ({ key }) => {
        const { useReferencesStore } = await import('../stores/references')
        const refsStore = useReferencesStore()
        const ref = refsStore.getByKey(key)
        if (!ref) return `Reference @${key} not found.`
        return JSON.stringify(ref, null, 2)
      },
    }),

    add_reference: tool({
      description: 'Add a reference to the library by DOI lookup or BibTeX import. Accepts a DOI string (e.g. "10.1234/example") or a BibTeX entry (e.g. "@article{key, ...}").',
      inputSchema: z.object({
        input: z.string().describe('A DOI string or BibTeX entry/entries'),
      }),
      execute: async ({ input: raw }) => {
        const { useReferencesStore } = await import('../stores/references')
        const refsStore = useReferencesStore()
        const trimmed = raw.trim()

        if (/^@\w+\s*\{/.test(trimmed)) {
          const { parseBibtex } = await import('../utils/bibtexParser')
          const entries = parseBibtex(trimmed)
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

        const { lookupByDoi } = await import('./crossref')
        const doi = trimmed.replace(/^https?:\/\/doi\.org\//, '').replace(/^doi:\s*/i, '')
        const csl = await lookupByDoi(doi)
        if (!csl) return `DOI not found: ${doi}`
        csl._needsReview = false
        csl._matchMethod = 'doi'
        csl._addedAt = new Date().toISOString()
        const result = refsStore.addReference(csl)
        return result.status === 'added'
          ? `Added reference @${result.key}: ${csl.title}`
          : `Duplicate: @${result.key} already exists.`
      },
    }),

    cite_reference: tool({
      description: 'Insert a citation [@key] at the cursor position in the active editor.',
      inputSchema: z.object({
        key: z.string().describe('The citation key to insert'),
      }),
      execute: async ({ key }) => {
        const editorStore = useEditorStore()
        const pane = editorStore.activePane
        if (!pane?.activeTab) return 'No active editor.'
        const view = editorStore.getEditorView(pane.id, pane.activeTab)
        if (!view) return 'No active text editor.'
        const isTexFile = pane.activeTab.endsWith('.tex') || pane.activeTab.endsWith('.latex')
        const cite = isTexFile ? `\\cite{${key}}` : `[@${key}]`
        const pos = view.state.selection.main.head
        view.dispatch({
          changes: { from: pos, to: pos, insert: cite },
          selection: { anchor: pos + cite.length },
        })
        return `Inserted ${cite} at cursor.`
      },
    }),

    edit_reference: tool({
      description: 'Edit metadata fields on an existing reference. Takes a citation key and an object of CSL-JSON fields to update (title, author, issued, DOI, abstract, container-title, volume, issue, page, _tags, etc.).',
      inputSchema: z.object({
        key: z.string().describe('Citation key (e.g. "smith2024")'),
        updates: z.record(z.string(), z.any()).describe('CSL-JSON fields to update'),
      }),
      execute: async ({ key, updates }) => {
        const { useReferencesStore } = await import('../stores/references')
        const refsStore = useReferencesStore()
        if (!refsStore.getByKey(key)) return `Reference @${key} not found.`
        const ok = refsStore.updateReference(key, updates)
        if (!ok) return `Failed to update @${key}.`
        return `Updated @${updates._key || key}: ${Object.keys(updates).join(', ')}`
      },
    }),

    // ── Web Research Tools ──────────────────────────────────────────

    web_search: tool({
      description: 'Search the web for information. Returns titles, URLs, and AI-generated summaries for each result. Requires an Exa API key (Settings > Tools) or a Shoulders account.',
      inputSchema: z.object({
        query: z.string().describe('The search query'),
        num_results: z.number().optional().describe('Number of results to return (default 10, max 10)'),
      }),
      execute: async ({ query, num_results }) => {
        const numResults = Math.min(num_results || 10, 10)
        const data = await _callExa('search', {
          query,
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
      },
    }),

    search_papers: tool({
      description: 'Search for academic papers. Returns structured metadata including titles, authors, year, DOI, citation counts, open access status, and abstracts. Use the returned DOI with add_reference to import papers to the library.',
      inputSchema: z.object({
        query: z.string().describe('The search query for academic papers'),
        num_results: z.number().optional().describe('Number of results (default 5, max 10)'),
      }),
      execute: async ({ query, num_results }) => {
        const numResults = Math.min(num_results || 5, 10)
        const errors = []

        // Primary: OpenAlex
        const hasOpenAlex = await _resolveOpenAlexAccess(workspace)
        if (hasOpenAlex) {
          try {
            const works = await _callOpenAlex(query, numResults, workspace)
            if (works && works.length > 0) {
              return JSON.stringify(works, null, 2)
            }
          } catch (e) {
            errors.push(`OpenAlex: ${e.message || e}`)
            console.warn('[search_papers] OpenAlex failed:', e)
          }
        }

        // Fallback 1: Exa
        const hasExa = await _resolveSearchAccess(workspace)
        if (hasExa) {
          try {
            const data = await _callExa('search', {
              query,
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

        // Fallback 2: CrossRef
        try {
          const encoded = encodeURIComponent(query)
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

        if (errors.length > 0) {
          return `No papers found. Search backends encountered errors:\n${errors.map(e => `- ${e}`).join('\n')}\n\nSuggestions: Try a different query, check your internet connection, or add an OpenAlex API key in Settings > Tools.`
        }
        return 'No papers found.'
      },
    }),

    fetch_url: tool({
      description: 'Fetch the text content of one or more web pages (max 10). Returns clean extracted text. Requires an Exa API key (Settings > Tools) or a Shoulders account.',
      inputSchema: z.object({
        urls: z.union([
          z.string().describe('A single URL to fetch'),
          z.array(z.string()).describe('Array of URLs (max 10)'),
        ]),
      }),
      execute: async ({ urls: rawUrls }) => {
        const urls = typeof rawUrls === 'string' ? [rawUrls] : (rawUrls || [])
        if (urls.length === 0) throw new Error('No URLs provided.')
        if (urls.length > 10) throw new Error('Maximum 10 URLs per request.')

        // Try Exa first (fast, rich results)
        const hasAccess = await _resolveSearchAccess(workspace)
        if (hasAccess) {
          try {
            const data = await _callExa('contents', {
              urls,
              text: { maxCharacters: 10000 },
              livecrawl: 'fallback',
            }, workspace)
            if (data?.results?.length > 0) {
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

        // Fallback: direct fetch with timeout
        const fetchWithTimeout = (url) => Promise.race([
          invoke('fetch_url_content', { url }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Fetch timed out after 15s')), 15000)),
        ])

        if (urls.length === 1) {
          try { return await fetchWithTimeout(urls[0]) }
          catch (e) { return `Error fetching ${urls[0]}: ${e.message || e}` }
        }
        const results = []
        for (const url of urls) {
          try {
            const text = await fetchWithTimeout(url)
            results.push(`## ${url}\n${text}`)
          } catch (e) {
            results.push(`## ${url}\nError: ${e}`)
          }
        }
        return results.join('\n\n---\n\n')
      },
    }),

    // ── Comment Tools ─────────────────────────────────────────────

    add_comment: tool({
      description: 'Add a comment annotation to a specific text in a document. Use this when reviewing a document to leave feedback, suggestions, or questions at specific locations. The comment appears in the document margin.',
      inputSchema: z.object({
        file_path: z.string().describe('Path to the file to comment on'),
        anchor_text: z.string().describe('The exact text in the document to anchor the comment to. Must match text in the file exactly.'),
        text: z.string().describe('The comment text — your feedback, suggestion, or question'),
        proposed_edit: z.object({
          old_text: z.string().describe('The text to replace'),
          new_text: z.string().describe('The replacement text'),
        }).optional().describe('Optional: propose a specific text edit along with the comment'),
      }),
      execute: async ({ file_path, anchor_text, text, proposed_edit }) => {
        const resolved = _resolvePath(file_path, workspace)
        if (!resolved) return PATH_ERROR
        const { useCommentsStore } = await import('../stores/comments')
        const commentsStore = useCommentsStore()

        // Read file to find anchor position
        const content = await invoke('read_file', { path: resolved })
        const anchorIdx = content.indexOf(anchor_text)
        if (anchorIdx === -1) {
          return `Error: Could not find the text "${anchor_text.substring(0, 50)}..." in the file.`
        }

        const range = { from: anchorIdx, to: anchorIdx + anchor_text.length }
        const proposedEdit = proposed_edit
          ? { oldText: proposed_edit.old_text, newText: proposed_edit.new_text }
          : null

        commentsStore.createComment(resolved, range, anchor_text, text, 'ai', null, proposedEdit)

        return `Comment added at "${anchor_text.substring(0, 30)}...". The user can see it in the document margin.`
      },
    }),

    reply_to_comment: tool({
      description: 'Reply to an existing comment on a document. Use this to respond to user feedback, answer questions, or suggest edits.',
      inputSchema: z.object({
        comment_id: z.string().describe('The ID of the comment to reply to'),
        text: z.string().describe('Your reply text'),
        proposed_edit: z.object({
          old_text: z.string().describe('The text to replace'),
          new_text: z.string().describe('The replacement text'),
        }).optional().describe('Optional: propose a specific text edit as part of your reply'),
      }),
      execute: async (args) => {
        const { comment_id, text, proposed_edit } = args
        const { useCommentsStore } = await import('../stores/comments')
        const commentsStore = useCommentsStore()

        const comment = commentsStore.comments.find(c => c.id === comment_id)
        if (!comment) {
          return `Error: Comment ${comment_id} not found.`
        }

        const proposedEdit = proposed_edit
          ? { oldText: proposed_edit.old_text, newText: proposed_edit.new_text }
          : null

        commentsStore.addReply(comment_id, {
          author: 'ai',
          text,
          proposedEdit,
        })

        return `Reply added to comment ${comment_id.substring(0, 12)}...`
      },
    }),

    resolve_comment: tool({
      description: 'Mark a comment as resolved after addressing it. Use this after you have made the requested changes or answered the question.',
      inputSchema: z.object({
        comment_id: z.string().describe('The ID of the comment to resolve'),
      }),
      execute: async ({ comment_id }) => {
        const { useCommentsStore } = await import('../stores/comments')
        const commentsStore = useCommentsStore()

        const comment = commentsStore.comments.find(c => c.id === comment_id)
        if (!comment) {
          return `Error: Comment ${comment_id} not found.`
        }

        commentsStore.resolveComment(comment_id)
        return `Comment ${comment_id.substring(0, 12)}... resolved.`
      },
    }),

    // ── Proposal Tool ───────────────────────────────────────────────

    create_proposal: tool({
      description: 'Always use this tool when presenting external sources — never list papers, references, or URLs as inline prose. Present interactive, verifiable choice cards. Always include url for direct verification; include doi when available (auto-imports to reference library on selection). Use for: paper recommendations, reference candidates, competing approaches, methodology options. Requires 2-5 options.',
      inputSchema: z.object({
        prompt: z.string().describe('The question or prompt to display above the options'),
        options: z.array(z.object({
          title: z.string().describe('Option title'),
          description: z.string().describe('Option description'),
          url: z.string().optional().describe('URL for the user to verify the source (strongly recommended — always include when available)'),
          doi: z.string().optional().describe('Optional DOI — auto-adds to library on Select, derives Open link if url omitted'),
        })).min(2).max(5).describe('2-5 options to present'),
      }),
      execute: async ({ prompt, options }) => {
        return JSON.stringify({ _type: 'proposal', prompt, options })
      },
    }),

    // ── File Operation Tools ────────────────────────────────────────

    rename_file: tool({
      description: 'Rename a file or directory. Automatically updates wiki links.',
      inputSchema: z.object({
        path: z.string().describe('Current file path relative to workspace'),
        new_name: z.string().describe('New filename (not full path, just the name)'),
      }),
      execute: async ({ path, new_name }) => {
        const resolved = _resolvePath(path, workspace)
        if (!resolved) return PATH_ERROR
        const parts = resolved.split('/')
        parts[parts.length - 1] = new_name
        const newPath = parts.join('/')
        const filesStore = useFilesStore()
        await filesStore.renamePath(resolved, newPath)
        return `Renamed: ${resolved.split('/').pop()} -> ${new_name}`
      },
    }),

    move_file: tool({
      description: 'Move a file to a different directory. Automatically updates wiki links.',
      inputSchema: z.object({
        path: z.string().describe('Current file path relative to workspace'),
        destination: z.string().describe('Destination directory path relative to workspace'),
      }),
      execute: async ({ path, destination }) => {
        const resolved = _resolvePath(path, workspace)
        if (!resolved) return PATH_ERROR
        const destDir = _resolvePath(destination, workspace)
        if (!destDir) return PATH_ERROR
        const filesStore = useFilesStore()
        await filesStore.movePath(resolved, destDir)
        const name = resolved.split('/').pop()
        return `Moved ${name} to ${destination}`
      },
    }),

    duplicate_file: tool({
      description: 'Create a copy of a file or directory with " (copy)" appended to the name.',
      inputSchema: z.object({
        path: z.string().describe('File path to duplicate relative to workspace'),
      }),
      execute: async ({ path }) => {
        const resolved = _resolvePath(path, workspace)
        if (!resolved) return PATH_ERROR
        const isDir = await invoke('is_directory', { path: resolved })
        const ext = (!isDir && resolved.includes('.')) ? '.' + resolved.split('.').pop() : ''
        const base = ext ? resolved.slice(0, -ext.length) : resolved
        let copyPath = `${base} (copy)${ext}`
        let n = 2
        while (await invoke('path_exists', { path: copyPath })) {
          copyPath = `${base} (copy ${n})${ext}`
          n++
        }
        if (isDir) {
          await invoke('copy_dir', { src: resolved, dest: copyPath })
        } else {
          await invoke('copy_file', { src: resolved, dest: copyPath })
        }
        return `Duplicated: ${copyPath.split('/').pop()}`
      },
    }),

    delete_file: tool({
      description: 'Delete a file or directory. Recoverable via git history.',
      inputSchema: z.object({
        path: z.string().describe('File path to delete relative to workspace'),
      }),
      execute: async ({ path }) => {
        const resolved = _resolvePath(path, workspace)
        if (!resolved) return PATH_ERROR
        const filesStore = useFilesStore()
        await filesStore.deletePath(resolved)
        return `Deleted: ${resolved.split('/').pop()}`
      },
    }),

    // ── Notebook Tools ──────────────────────────────────────────────

    read_notebook: tool({
      description: 'Read a Jupyter notebook (.ipynb), returning all cells with their source code and outputs. Output includes cell indices for use with edit_cell, run_cell, etc.',
      inputSchema: z.object({
        path: z.string().describe('Path to .ipynb file relative to workspace'),
      }),
      execute: async ({ path }) => {
        const resolved = _resolvePath(path, workspace)
        if (!resolved) return PATH_ERROR
        const raw = await invoke('read_file', { path: resolved })
        const { parseNotebook, formatNotebookAsText } = await import('../utils/notebookFormat')
        const nb = parseNotebook(raw)
        const text = formatNotebookAsText(nb.cells, resolved)
        return text.length > 50000 ? text.slice(0, 50000) + '\n...[truncated]' : text
      },
    }),

    edit_cell: tool({
      description: 'Edit the source code of a notebook cell by index (0-based).',
      inputSchema: z.object({
        path: z.string().describe('Path to .ipynb file'),
        index: z.number().describe('Cell index (0-based)'),
        new_source: z.string().describe('New cell source code'),
      }),
      execute: async ({ path, index, new_source }) => {
        const resolved = _resolvePath(path, workspace)
        if (!resolved) return PATH_ERROR
        const raw = await invoke('read_file', { path: resolved })
        const { parseNotebook, serializeNotebook } = await import('../utils/notebookFormat')
        const nb = parseNotebook(raw)

        if (index < 0 || index >= nb.cells.length) {
          throw new Error(`Cell index ${index} out of range (0-${nb.cells.length - 1})`)
        }

        const reviews = useReviewsStore()
        const cell = nb.cells[index]

        if (!reviews.directMode) {
          const existing = reviews.notebookEditForCell(resolved, cell.id)
          if (existing) return `Cell ${index} already has a pending edit. Accept or reject it first.`

          reviews.pendingEdits.push({
            id: `nb-edit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            tool: 'NotebookEditCell',
            file_path: resolved,
            cell_id: cell.id,
            cell_index: index,
            old_source: cell.source,
            new_source,
            status: 'pending',
          })
          await reviews.savePendingEdits()
          window.dispatchEvent(new CustomEvent('notebook-pending-edit', {
            detail: { file_path: resolved, cell_id: cell.id },
          }))
          return `Cell ${index} edit queued for review.`
        }

        nb.cells[index].source = new_source
        const newContent = serializeNotebook(nb.cells, nb.metadata, nb.nbformat, nb.nbformat_minor)
        await invoke('write_file', { path: resolved, content: newContent })

        const filesStore = useFilesStore()
        filesStore.fileContents[resolved] = newContent
        return `Cell ${index} updated.`
      },
    }),

    run_cell: tool({
      description: 'Execute a specific code cell in a notebook and return the output. The notebook must be open in the editor with a connected kernel.',
      inputSchema: z.object({
        path: z.string().describe('Path to .ipynb file'),
        index: z.number().describe('Cell index (0-based)'),
      }),
      execute: async ({ path, index }) => {
        const resolved = _resolvePath(path, workspace)
        if (!resolved) return PATH_ERROR
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            window.removeEventListener('cell-execution-complete', handler)
            reject(new Error('Cell execution timed out (60s). Is the notebook open with a kernel connected?'))
          }, 60000)

          function handler(e) {
            if (e.detail?.path !== resolved || e.detail?.index !== index) return
            window.removeEventListener('cell-execution-complete', handler)
            clearTimeout(timeout)
            if (e.detail.error) resolve(`Error: ${e.detail.error}`)
            else resolve(e.detail.output || '(no output)')
          }

          window.addEventListener('cell-execution-complete', handler)
          window.dispatchEvent(new CustomEvent('run-notebook-cell', {
            detail: { path: resolved, index },
          }))
        })
      },
    }),

    run_all_cells: tool({
      description: 'Execute all code cells in a notebook sequentially. Returns a summary of outputs. Stops on first error.',
      inputSchema: z.object({
        path: z.string().describe('Path to .ipynb file'),
      }),
      execute: async ({ path }) => {
        const resolved = _resolvePath(path, workspace)
        if (!resolved) return PATH_ERROR
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            window.removeEventListener('all-cells-execution-complete', handler)
            reject(new Error('Notebook execution timed out (5 min). Is the notebook open?'))
          }, 300000)

          function handler(e) {
            if (e.detail?.path !== resolved) return
            window.removeEventListener('all-cells-execution-complete', handler)
            clearTimeout(timeout)
            resolve(e.detail.summary || 'All cells executed.')
          }

          window.addEventListener('all-cells-execution-complete', handler)
          window.dispatchEvent(new CustomEvent('run-all-notebook-cells', {
            detail: { path: resolved },
          }))
        })
      },
    }),

    add_cell: tool({
      description: 'Insert a new cell at a position in the notebook.',
      inputSchema: z.object({
        path: z.string().describe('Path to .ipynb file'),
        index: z.number().optional().describe('Position to insert (0 = top). Omit to append at end.'),
        type: z.enum(['code', 'markdown']).optional().describe('Cell type (default: code)'),
        source: z.string().describe('Cell source content'),
      }),
      execute: async ({ path, index, type, source }) => {
        const resolved = _resolvePath(path, workspace)
        if (!resolved) return PATH_ERROR
        const raw = await invoke('read_file', { path: resolved })
        const { parseNotebook, serializeNotebook, generateCellId } = await import('../utils/notebookFormat')
        const nb = parseNotebook(raw)

        const newCell = {
          id: generateCellId(),
          type: type || 'code',
          source: source || '',
          outputs: [],
          executionCount: null,
          metadata: {},
        }

        const idx = index != null ? Math.min(Math.max(0, index), nb.cells.length) : nb.cells.length
        const reviews = useReviewsStore()

        if (!reviews.directMode) {
          reviews.pendingEdits.push({
            id: `nb-add-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            tool: 'NotebookAddCell',
            file_path: resolved,
            cell_id: newCell.id,
            cell_index: idx,
            cell_type: newCell.type,
            cell_source: newCell.source,
            status: 'pending',
          })
          await reviews.savePendingEdits()
          window.dispatchEvent(new CustomEvent('notebook-pending-edit', {
            detail: { file_path: resolved, cell_id: newCell.id },
          }))
          return `New ${newCell.type} cell at index ${idx} queued for review.`
        }

        nb.cells.splice(idx, 0, newCell)
        const newContent = serializeNotebook(nb.cells, nb.metadata, nb.nbformat, nb.nbformat_minor)
        await invoke('write_file', { path: resolved, content: newContent })

        const filesStore = useFilesStore()
        filesStore.fileContents[resolved] = newContent
        return `Added ${newCell.type} cell at index ${idx}.`
      },
    }),

    delete_cell: tool({
      description: 'Delete a cell from the notebook by index (0-based).',
      inputSchema: z.object({
        path: z.string().describe('Path to .ipynb file'),
        index: z.number().describe('Cell index to delete (0-based)'),
      }),
      execute: async ({ path, index }) => {
        const resolved = _resolvePath(path, workspace)
        if (!resolved) return PATH_ERROR
        const raw = await invoke('read_file', { path: resolved })
        const { parseNotebook, serializeNotebook } = await import('../utils/notebookFormat')
        const nb = parseNotebook(raw)

        if (index < 0 || index >= nb.cells.length) {
          throw new Error(`Cell index ${index} out of range (0-${nb.cells.length - 1})`)
        }
        if (nb.cells.length <= 1) {
          throw new Error('Cannot delete the last cell in a notebook.')
        }

        const reviews = useReviewsStore()
        const cell = nb.cells[index]

        if (!reviews.directMode) {
          const existing = reviews.notebookEditForCell(resolved, cell.id)
          if (existing) return `Cell ${index} already has a pending edit. Accept or reject it first.`

          reviews.pendingEdits.push({
            id: `nb-del-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            tool: 'NotebookDeleteCell',
            file_path: resolved,
            cell_id: cell.id,
            cell_index: index,
            cell_source: cell.source,
            cell_type: cell.type,
            status: 'pending',
          })
          await reviews.savePendingEdits()
          window.dispatchEvent(new CustomEvent('notebook-pending-edit', {
            detail: { file_path: resolved, cell_id: cell.id },
          }))
          return `Delete of ${cell.type} cell at index ${index} queued for review.`
        }

        const deleted = nb.cells.splice(index, 1)[0]
        const newContent = serializeNotebook(nb.cells, nb.metadata, nb.nbformat, nb.nbformat_minor)
        await invoke('write_file', { path: resolved, content: newContent })

        const filesStore = useFilesStore()
        filesStore.fileContents[resolved] = newContent
        return `Deleted ${deleted.type} cell at index ${index}.`
      },
    }),

    // ── Canvas Tools ────────────────────────────────────────────────

    read_canvas: tool({
      description: 'Read the full graph structure of the currently open canvas (nodes, edges, content summaries). Only works when a .canvas file is active.',
      inputSchema: z.object({}),
      execute: async () => {
        const { useCanvasStore } = await import('../stores/canvas')
        const canvasStore = useCanvasStore()
        if (!canvasStore._editor) return 'No canvas is currently open.'
        const { buildGraphSummary } = await import('./canvasMessages')
        const nodes = canvasStore._editor.getNodes()
        const edges = canvasStore._editor.getEdges()
        return buildGraphSummary(nodes, edges)
      },
    }),

    add_node: tool({
      description: 'Add a node to the canvas. Only works when a .canvas file is active.',
      inputSchema: z.object({
        type: z.enum(['text', 'prompt', 'file']).describe('Node type'),
        content: z.string().describe('Node content (text/prompt) or file path (file)'),
        x: z.number().optional().describe('X position (default 0)'),
        y: z.number().optional().describe('Y position (default 0)'),
        connect_to: z.string().optional().describe('Optional node ID to connect this node to (creates edge from connect_to → new node)'),
        title: z.string().optional().describe('Optional title for text nodes'),
      }),
      execute: async ({ type, content, x, y, connect_to, title }) => {
        const { useCanvasStore } = await import('../stores/canvas')
        const canvasStore = useCanvasStore()
        if (!canvasStore._editor) return 'No canvas is currently open.'
        const pos = { x: x || 0, y: y || 0 }
        let newId
        if (type === 'text') {
          newId = canvasStore._editor.addTextNode(pos, { content, title: title || null })
        } else if (type === 'prompt') {
          newId = canvasStore._editor.addPromptNode(pos, { content })
        } else if (type === 'file') {
          newId = canvasStore._editor.addFileNode(pos, { filePath: content, preview: content.split('/').pop() })
        } else {
          return `Unknown node type: ${type}`
        }
        if (connect_to && newId) {
          const edges = canvasStore._editor.getEdges()
          const { nanoid: nid } = await import('../stores/utils')
          edges.push({ id: `e_${nid(8)}`, source: connect_to, target: newId, type: 'smoothstep' })
          canvasStore._editor.scheduleSave()
        }
        return `Created ${type} node: ${newId}`
      },
    }),

    edit_node: tool({
      description: 'Modify content of an existing node on the canvas.',
      inputSchema: z.object({
        node_id: z.string().describe('The node ID to edit'),
        content: z.string().optional().describe('New content for the node'),
        title: z.string().optional().nullable().describe('New title (null to remove)'),
      }),
      execute: async ({ node_id, content, title }) => {
        const { useCanvasStore } = await import('../stores/canvas')
        const canvasStore = useCanvasStore()
        if (!canvasStore._editor) return 'No canvas is currently open.'
        const nodes = canvasStore._editor.getNodes()
        const node = nodes.find(n => n.id === node_id)
        if (!node) return `Node not found: ${node_id}`
        const patch = {}
        if (content !== undefined) patch.content = content
        if (title !== undefined) patch.title = title
        canvasStore._editor.updateNodeData(node_id, patch)
        canvasStore._editor.scheduleSave()
        return `Updated node ${node_id}`
      },
    }),

    delete_node: tool({
      description: 'Remove a node and its connected edges from the canvas.',
      inputSchema: z.object({
        node_id: z.string().describe('The node ID to delete'),
      }),
      execute: async ({ node_id }) => {
        const { useCanvasStore } = await import('../stores/canvas')
        const canvasStore = useCanvasStore()
        if (!canvasStore._editor) return 'No canvas is currently open.'
        const nodes = canvasStore._editor.getNodes()
        const edges = canvasStore._editor.getEdges()
        const idx = nodes.findIndex(n => n.id === node_id)
        if (idx === -1) return `Node not found: ${node_id}`
        canvasStore.pushSnapshot(nodes, edges)
        const filtered = edges.filter(e => e.source !== node_id && e.target !== node_id)
        edges.splice(0, edges.length, ...filtered)
        nodes.splice(idx, 1)
        canvasStore._editor.scheduleSave()
        return `Deleted node ${node_id}`
      },
    }),

    move_node: tool({
      description: 'Reposition a node on the canvas.',
      inputSchema: z.object({
        node_id: z.string().describe('The node ID to move'),
        x: z.number().describe('New X position'),
        y: z.number().describe('New Y position'),
      }),
      execute: async ({ node_id, x, y }) => {
        const { useCanvasStore } = await import('../stores/canvas')
        const canvasStore = useCanvasStore()
        if (!canvasStore._editor) return 'No canvas is currently open.'
        const nodes = canvasStore._editor.getNodes()
        const node = nodes.find(n => n.id === node_id)
        if (!node) return `Node not found: ${node_id}`
        node.position = { x, y }
        canvasStore._editor.scheduleSave()
        return `Moved node ${node_id} to (${x}, ${y})`
      },
    }),

    add_edge: tool({
      description: 'Connect two nodes on the canvas with a directed edge.',
      inputSchema: z.object({
        source: z.string().describe('Source node ID'),
        target: z.string().describe('Target node ID'),
      }),
      execute: async ({ source, target }) => {
        const { useCanvasStore } = await import('../stores/canvas')
        const canvasStore = useCanvasStore()
        if (!canvasStore._editor) return 'No canvas is currently open.'
        const nodes = canvasStore._editor.getNodes()
        const edges = canvasStore._editor.getEdges()
        if (!nodes.find(n => n.id === source)) return `Source node not found: ${source}`
        if (!nodes.find(n => n.id === target)) return `Target node not found: ${target}`
        const { nanoid: nid } = await import('../stores/utils')
        const edgeId = `e_${nid(8)}`
        canvasStore.pushSnapshot(nodes, edges)
        edges.push({ id: edgeId, source, target, type: 'smoothstep' })
        canvasStore._editor.scheduleSave()
        return `Created edge ${edgeId}: ${source} → ${target}`
      },
    }),

    remove_edge: tool({
      description: 'Remove an edge (connection) from the canvas.',
      inputSchema: z.object({
        edge_id: z.string().describe('The edge ID to remove'),
      }),
      execute: async ({ edge_id }) => {
        const { useCanvasStore } = await import('../stores/canvas')
        const canvasStore = useCanvasStore()
        if (!canvasStore._editor) return 'No canvas is currently open.'
        const edges = canvasStore._editor.getEdges()
        const idx = edges.findIndex(e => e.id === edge_id)
        if (idx === -1) return `Edge not found: ${edge_id}`
        canvasStore.pushSnapshot(canvasStore._editor.getNodes(), edges)
        edges.splice(idx, 1)
        canvasStore._editor.scheduleSave()
        return `Removed edge ${edge_id}`
      },
    }),
  }

  // Filter out disabled tools
  if (disabled.length > 0) {
    const filtered = {}
    for (const [name, t] of Object.entries(allTools)) {
      if (!disabled.includes(name)) filtered[name] = t
    }
    return filtered
  }

  return allTools
}


// ─── Legacy Exports (backward compat during migration) ───────────────

/**
 * @deprecated Use getAiTools() instead. Kept for callers not yet migrated.
 */
export function getToolDefinitions(workspace) {
  const tools = Object.entries(getAiTools(workspace))
  return tools.map(([name, t]) => ({
    name,
    description: t.description,
    input_schema: t.inputSchema ? _zodToJsonSchema(t.inputSchema) : { type: 'object', properties: {} },
  }))
}

/**
 * @deprecated Use getAiTools() instead. Kept for callers not yet migrated.
 */
export async function executeSingleTool(name, input, workspace) {
  if (workspace?.disabledTools?.includes(name)) {
    return `Tool "${name}" is disabled by user.`
  }
  const tools = getAiTools(workspace)
  const t = tools[name]
  if (!t) return `Unknown tool: ${name}`
  try {
    return await t.execute(input)
  } catch (e) {
    throw e
  }
}

/**
 * Minimal zod-to-JSON-Schema for legacy compat.
 * The AI SDK handles this internally for its own purposes.
 */
function _zodToJsonSchema(schema) {
  try {
    // Zod v4 has a built-in toJsonSchema
    if (typeof schema.toJsonSchema === 'function') {
      return schema.toJsonSchema()
    }
    // Fallback: return a generic object schema
    return { type: 'object', properties: {} }
  } catch {
    return { type: 'object', properties: {} }
  }
}
