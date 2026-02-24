import { useEditorStore } from '../stores/editor'
import { useFilesStore } from '../stores/files'
import { gitDiffSummary, gitBranch } from './git'

/**
 * Builds a compact <workspace-meta> block from editor + git state.
 * Injected into the first user message (not system prompt — preserves caching).
 */
export async function buildWorkspaceMeta(workspacePath) {
  if (!workspacePath) return ''

  const editorStore = useEditorStore()
  const parts = []

  // Open tabs (relative paths)
  const openFiles = [...editorStore.allOpenFiles]
  if (openFiles.length > 0) {
    const relative = openFiles.map(f => f.startsWith(workspacePath)
      ? f.slice(workspacePath.length + 1)
      : f)
    parts.push(`Open tabs: ${relative.join(', ')}`)
  }

  // Active tab
  const activeTab = editorStore.activeTab
  if (activeTab) {
    const rel = activeTab.startsWith(workspacePath)
      ? activeTab.slice(workspacePath.length + 1)
      : activeTab
    parts.push(`Active tab: ${rel}`)
  }

  // File tree (abbreviated, 2 levels deep, max 40 entries)
  const filesStore = useFilesStore()
  if (filesStore.tree.length > 0) {
    const lines = []
    const walk = (entries, depth, prefix) => {
      if (depth > 2 || lines.length > 40) return
      for (const entry of entries) {
        if (lines.length > 40) break
        const name = entry.name + (entry.is_dir ? '/' : '')
        lines.push(prefix + name)
        if (entry.is_dir && entry.children && depth < 2) {
          walk(entry.children, depth + 1, prefix + '  ')
        }
      }
    }
    walk(filesStore.tree, 0, '')
    if (lines.length > 0) {
      let tree = 'Workspace files:\n' + lines.join('\n')
      if (lines.length > 40) tree += '\n  ... (truncated)'
      parts.push(tree)
    }
  }

  // Reference library summary
  try {
    const { useReferencesStore } = await import('../stores/references')
    const refsStore = useReferencesStore()
    if (refsStore.library.length > 0) {
      const count = refsStore.library.length
      const recent = refsStore.sortedLibrary.slice(0, 15)
      const lines = recent.map(r => {
        const author = r.author?.[0]?.family || 'Unknown'
        const year = r.issued?.['date-parts']?.[0]?.[0] || ''
        const pdf = r._pdfFile ? ` [PDF: ${r._pdfFile}]` : ''
        return `@${r._key}${pdf} — ${author}${year ? ' ' + year : ''}: ${(r.title || '').slice(0, 60)}`
      })
      let section = `Reference library (${count} total):\n` + lines.join('\n')
      if (count > 15) section += `\n  ... and ${count - 15} more (use search_references tool)`
      parts.push(section)
    }
  } catch {
    // References store not initialized — skip
  }

  // Git info
  try {
    const branch = await gitBranch(workspacePath)
    if (branch) parts.push(`Branch: ${branch}`)

    const diff = await gitDiffSummary(workspacePath)
    if (diff && (diff.stat || diff.diffs.length > 0)) {
      // Filter out .shoulders/ config directory noise
      const filteredDiffs = diff.diffs.filter(d => !d.file.startsWith('.shoulders/'))
      let filteredStat = diff.stat
      if (filteredStat) {
        filteredStat = filteredStat.split('\n')
          .filter(line => !line.trimStart().startsWith('.shoulders/'))
          .join('\n')
      }

      if (filteredStat || filteredDiffs.length > 0) {
        let gitSection = 'Recent changes:\n'
        if (filteredStat) gitSection += filteredStat + '\n'
        for (const d of filteredDiffs) {
          gitSection += `\n--- ${d.file}\n${d.diff}`
        }
        parts.push(gitSection.trimEnd())
      }
    }
  } catch {
    // No git or error — skip
  }

  if (parts.length === 0) return ''

  return `<workspace-meta>
This is auto-generated workspace context. It may or may not be relevant to the user's query.

${parts.join('\n\n')}
</workspace-meta>`
}
