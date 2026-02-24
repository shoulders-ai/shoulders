import { marked } from 'marked'
import DOMPurify from 'dompurify'

// Custom renderer for code blocks (language label + copy button) and links
const renderer = new marked.Renderer()

renderer.code = function ({ text, lang }) {
  const label = lang ? `<span class="chat-code-lang">${lang}</span>` : ''
  return `<pre class="chat-code-block">${label}<code>${text}</code></pre>`
}

renderer.link = function ({ href, text }) {
  return `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`
}

marked.setOptions({
  renderer,
  gfm: true,
  breaks: true,
})

// Strip img tags with external src URLs (keep data: and blob: only)
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'IMG') {
    const src = node.getAttribute('src') || ''
    if (!src.startsWith('data:') && !src.startsWith('blob:')) {
      node.remove()
    }
  }
})

// DOMPurify config: allow safe HTML + target attribute on links
const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'del', 'code', 'pre', 'blockquote',
    'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr',
    'div', 'span', 'button', 'svg', 'rect', 'path', 'img',
  ],
  ALLOWED_ATTR: [
    'href', 'target', 'rel', 'class', 'title',
    'width', 'height', 'viewBox', 'fill', 'stroke', 'stroke-width',
    'x', 'y', 'rx', 'd', 'src', 'alt',
  ],
  ALLOW_DATA_ATTR: false,
}

/**
 * Render markdown content to sanitized HTML.
 * Strips <file-ref>, <context>, <selection> tags before parsing.
 */
export function renderMarkdown(content) {
  if (!content) return ''
  let text = content
    .replace(/<file-ref[\s\S]*?<\/file-ref>/g, '')
    .replace(/<context[\s\S]*?<\/context>/g, '')
    .replace(/<selection[\s\S]*?<\/selection>/g, '')
    .trim()
  if (!text) return ''
  const html = marked.parse(text)
  return DOMPurify.sanitize(html, PURIFY_CONFIG)
}

// Human-readable tool labels
export const TOOL_LABELS = {
  read_file: 'Read',
  write_file: 'Write',
  edit_file: 'Edit',
  run_command: 'Run',
  search_content: 'Search',
  list_files: 'List',
  search_references: 'Search refs',
  get_reference: 'Get ref',
  add_reference: 'Add ref',
  cite_reference: 'Cite',
  edit_reference: 'Edit ref',
  create_proposal: 'Proposal',
  propose_edit: 'Propose edit',
  web_search: 'Web search',
  search_papers: 'Search papers',
  fetch_url: 'Fetch URL',
  add_task: 'Task',
  read_tasks: 'Read tasks',
  rename_file: 'Rename',
  move_file: 'Move',
  duplicate_file: 'Duplicate',
  delete_file: 'Delete',
  create_file: 'Create',
  read_notebook: 'Read notebook',
  edit_cell: 'Edit cell',
  run_cell: 'Run cell',
  run_all_cells: 'Run all cells',
  add_cell: 'Add cell',
  delete_cell: 'Delete cell',
}

/**
 * Check if a tool call is reading a skill file.
 */
export function isSkillRead(name, input) {
  if (name !== 'read_file' || !input?.path) return false
  return input.path.includes('.project/skills/') && input.path.endsWith('/SKILL.md')
}

/**
 * Extract a human-readable skill name from a skill file path.
 * e.g. ".project/skills/shoulders-meta/SKILL.md" → "Shoulders Manual"
 */
export function getSkillDisplayName(input) {
  if (!input?.path) return 'Skill'
  const parts = input.path.split('/')
  const skillIdx = parts.indexOf('skills')
  if (skillIdx < 0 || skillIdx + 1 >= parts.length) return 'Skill'
  const folderName = parts[skillIdx + 1]
  return folderName
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * Extract human-readable context from a tool call's input.
 */
export function getToolContext(name, input) {
  if (!input) return ''
  // Skill reads get a friendly display name
  if (isSkillRead(name, input)) return getSkillDisplayName(input)
  switch (name) {
    case 'read_file':
    case 'write_file':
    case 'edit_file':
    case 'rename_file':
    case 'move_file':
    case 'duplicate_file':
    case 'delete_file':
    case 'create_file':
      return input.path ? input.path.split('/').pop() : ''
    case 'run_command':
      return input.command ? (input.command.length > 40 ? input.command.slice(0, 40) + '...' : input.command) : ''
    case 'search_content':
    case 'web_search':
    case 'search_papers':
    case 'search_references':
      return input.query || input.pattern || ''
    case 'list_files':
      return input.path ? input.path.split('/').pop() || '/' : ''
    case 'get_reference':
    case 'cite_reference':
    case 'edit_reference':
      return input.key || ''
    case 'add_reference':
      return input.input ? input.input.slice(0, 30) : ''
    case 'fetch_url':
      return typeof input.urls === 'string' ? input.urls.split('/').pop() || '' : ''
    case 'add_task':
      return input.target_text ? input.target_text.slice(0, 30) + '...' : ''
    case 'read_tasks':
      return input.file_path ? input.file_path.split('/').pop() : ''
    case 'read_notebook':
    case 'edit_cell':
    case 'run_cell':
    case 'run_all_cells':
    case 'add_cell':
    case 'delete_cell':
      return input.path ? input.path.split('/').pop() : ''
    default:
      return ''
  }
}

/**
 * Icon category for a tool name.
 * Callers may override with isSkillRead() check for 'sparkle'.
 */
export function getToolIcon(name) {
  switch (name) {
    case 'read_file':
    case 'fetch_url':
      return 'eye'
    case 'write_file':
    case 'create_file':
    case 'duplicate_file':
      return 'file-plus'
    case 'edit_file':
    case 'rename_file':
    case 'edit_cell':
    case 'propose_edit':
      return 'pencil'
    case 'list_files':
    case 'move_file':
      return 'folder'
    case 'run_command':
    case 'run_cell':
    case 'run_all_cells':
      return 'terminal'
    case 'search_content':
    case 'web_search':
    case 'search_papers':
      return 'search'
    case 'search_references':
    case 'get_reference':
    case 'add_reference':
    case 'cite_reference':
    case 'edit_reference':
      return 'book'
    default:
      return 'file'
  }
}
