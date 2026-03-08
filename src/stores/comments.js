import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { nanoid } from './utils'
import { useWorkspaceStore } from './workspace'

let _saveTimer = null
const SAVE_DEBOUNCE = 1000

export const useCommentsStore = defineStore('comments', () => {
  // ─── State ────────────────────────────────────────────────────────
  const comments = ref([])
  const activeCommentId = ref(null)
  const marginVisible = ref({})
  const showResolved = ref(false)
  const editStatuses = ref({}) // "commentId:replyId" → { status, error? }

  // ─── Getters ──────────────────────────────────────────────────────
  function commentsForFile(filePath) {
    return comments.value
      .filter(c => c.filePath === filePath)
      .sort((a, b) => a.range.from - b.range.from)
  }

  function unresolvedForFile(filePath) {
    return comments.value
      .filter(c => c.filePath === filePath && c.status === 'active')
      .sort((a, b) => a.range.from - b.range.from)
  }

  function unresolvedCount(filePath) {
    return comments.value.filter(c => c.filePath === filePath && c.status === 'active').length
  }

  const activeComment = computed(() =>
    comments.value.find(c => c.id === activeCommentId.value) || null
  )

  // ─── Actions ──────────────────────────────────────────────────────

  function createComment(filePath, range, anchorText, text, author = 'user', fileRefs = null, proposedEdit = null) {
    const now = new Date().toISOString()
    const comment = {
      id: `comment-${nanoid()}`,
      filePath,
      range: { from: range.from, to: range.to },
      anchorText,
      author,
      text,
      replies: [],
      proposedEdit: proposedEdit || null,
      status: 'active',
      fileRefs: fileRefs || null,
      createdAt: now,
      updatedAt: now,
    }
    comments.value.push(comment)
    _save()
    return comment
  }

  function addReply(commentId, { author, text, proposedEdit = null, fileRefs = null }) {
    const comment = comments.value.find(c => c.id === commentId)
    if (!comment) return

    const reply = {
      id: `reply-${nanoid()}`,
      author,
      text,
      proposedEdit: proposedEdit || null,
      fileRefs: fileRefs || null,
      timestamp: new Date().toISOString(),
    }
    comment.replies.push(reply)
    comment.updatedAt = new Date().toISOString()
    _save()
    return reply
  }

  function resolveComment(commentId) {
    const comment = comments.value.find(c => c.id === commentId)
    if (!comment) return
    comment.status = 'resolved'
    comment.updatedAt = new Date().toISOString()
    if (activeCommentId.value === commentId) {
      activeCommentId.value = null
    }
    _save()
  }

  function unresolveComment(commentId) {
    const comment = comments.value.find(c => c.id === commentId)
    if (!comment) return
    comment.status = 'active'
    comment.updatedAt = new Date().toISOString()
    _save()
  }

  function deleteComment(commentId) {
    const idx = comments.value.findIndex(c => c.id === commentId)
    if (idx === -1) return
    comments.value.splice(idx, 1)
    if (activeCommentId.value === commentId) {
      activeCommentId.value = null
    }
    _save()
  }

  function updateRange(commentId, from, to) {
    const comment = comments.value.find(c => c.id === commentId)
    if (!comment) return
    comment.range = { from, to }
    _debouncedSave()
  }

  function setActiveComment(commentId) {
    activeCommentId.value = commentId
  }

  function isMarginVisible(filePath) {
    if (filePath in marginVisible.value) return marginVisible.value[filePath]
    return commentsForFile(filePath).length > 0
  }

  function toggleMargin(filePath) {
    if (!filePath) return
    marginVisible.value[filePath] = !isMarginVisible(filePath)
  }

  // ─── Apply Proposed Edit ──────────────────────────────────────────

  async function applyProposedEdit(commentId, replyId = null) {
    const comment = comments.value.find(c => c.id === commentId)
    if (!comment) return

    const statusKey = replyId ? `${commentId}:${replyId}` : `${commentId}:`

    // Check if already applied
    if (editStatuses.value[statusKey]?.status === 'applied') return

    // Find the proposed edit
    let proposedEdit = null
    if (replyId) {
      const reply = comment.replies.find(r => r.id === replyId)
      proposedEdit = reply?.proposedEdit
    } else {
      proposedEdit = comment.proposedEdit
    }

    if (!proposedEdit || !proposedEdit.oldText || !proposedEdit.newText) {
      editStatuses.value[statusKey] = { status: 'error', error: 'No proposed edit found.' }
      return
    }

    const { useFilesStore } = await import('./files')
    const { useEditorStore } = await import('./editor')
    const filesStore = useFilesStore()
    const editorStore = useEditorStore()

    try {
      editStatuses.value[statusKey] = { status: 'pending' }

      const currentContent = await invoke('read_file', { path: comment.filePath })

      if (!currentContent.includes(proposedEdit.oldText)) {
        editStatuses.value[statusKey] = { status: 'error', error: 'oldText not found in file. The text may have changed.' }
        return
      }

      const newContent = currentContent.replace(proposedEdit.oldText, proposedEdit.newText)
      await invoke('write_file', { path: comment.filePath, content: newContent })

      // Update files store before triggering editor refresh
      filesStore.fileContents[comment.filePath] = newContent
      editorStore.openFile(comment.filePath)

      // Update the comment range to cover the new text
      const editStart = currentContent.indexOf(proposedEdit.oldText)
      if (editStart !== -1) {
        comment.range = { from: editStart, to: editStart + proposedEdit.newText.length }
      }

      editStatuses.value[statusKey] = { status: 'applied' }
      comment.updatedAt = new Date().toISOString()
      _save()
    } catch (e) {
      editStatuses.value[statusKey] = { status: 'error', error: `Error applying edit: ${e}` }
    }
  }

  function getEditStatus(commentId, replyId = null) {
    const key = replyId ? `${commentId}:${replyId}` : `${commentId}:`
    return editStatuses.value[key] || null
  }

  // ─── Persistence ──────────────────────────────────────────────────

  async function _save() {
    const workspace = useWorkspaceStore()
    if (!workspace.shouldersDir) return

    try {
      await invoke('write_file', {
        path: `${workspace.shouldersDir}/comments.json`,
        content: JSON.stringify(comments.value, null, 2),
      })
    } catch (e) {
      console.warn('Failed to save comments:', e)
    }
  }

  function _debouncedSave() {
    if (_saveTimer) clearTimeout(_saveTimer)
    _saveTimer = setTimeout(() => {
      _saveTimer = null
      _save()
    }, SAVE_DEBOUNCE)
  }

  async function loadComments() {
    const workspace = useWorkspaceStore()
    if (!workspace.shouldersDir) return

    comments.value = []
    activeCommentId.value = null
    editStatuses.value = {}

    const filePath = `${workspace.shouldersDir}/comments.json`
    try {
      const exists = await invoke('path_exists', { path: filePath })
      if (!exists) return

      const content = await invoke('read_file', { path: filePath })
      const data = JSON.parse(content)
      if (!Array.isArray(data)) return

      comments.value = data
    } catch (e) {
      console.warn('Failed to load comments:', e)
    }
  }

  // ─── Submit to Chat ──────────────────────────────────────────────

  async function submitToChat(filePath) {
    const unresolved = unresolvedForFile(filePath)
    if (!unresolved.length) return

    const workspace = useWorkspaceStore()
    const { useFilesStore } = await import('./files')
    const { useChatStore } = await import('./chat')
    const { useEditorStore } = await import('./editor')
    const filesStore = useFilesStore()
    const chatStore = useChatStore()
    const editorStore = useEditorStore()

    const relativePath = workspace?.path
      ? filePath.replace(workspace.path + '/', '')
      : filePath

    // Read file content (includes comments automatically via the @file ref system)
    let fileContent = ''
    try {
      fileContent = filesStore.fileContents[filePath] || await invoke('read_file', { path: filePath })
    } catch {}

    // Build comment summary to append to the file content
    let commentBlock = '\n\n<document-comments>\n'
    for (const c of unresolved) {
      const lineNum = fileContent ? fileContent.substring(0, c.range.from).split('\n').length : '?'
      commentBlock += `  <comment id="${c.id}" line="${lineNum}" author="${c.author}" anchor-text="${_escapeXml(c.anchorText)}">`
      commentBlock += _escapeXml(c.text)
      for (const r of c.replies) {
        commentBlock += `\n    <reply author="${r.author}">${_escapeXml(r.text)}</reply>`
      }
      commentBlock += '</comment>\n'
    }
    commentBlock += '</document-comments>'

    const fileRef = {
      path: filePath,
      content: fileContent + commentBlock,
    }

    // Open a chat tab and auto-send the message
    const n = unresolved.length
    const userText = `Please review and address the ${n === 1 ? 'comment' : n + ' comments'} on ${relativePath}.`

    // Open or reuse a chat tab
    editorStore.openChatBeside()
    // Wait for async component mount, then find the active chat session
    await new Promise(r => setTimeout(r, 200))

    const sid = chatStore.activeSessionId
    if (sid) {
      chatStore.sendMessage(sid, {
        text: userText,
        fileRefs: [fileRef],
      })
    }
  }

  function _escapeXml(str) {
    if (!str) return ''
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  // ─── Public API ─────────────────────────────────────────────────
  return {
    // State
    comments,
    activeCommentId,
    isMarginVisible,
    showResolved,
    editStatuses,

    // Getters
    commentsForFile,
    unresolvedForFile,
    unresolvedCount,
    activeComment,

    // Actions
    createComment,
    addReply,
    resolveComment,
    unresolveComment,
    deleteComment,
    updateRange,
    setActiveComment,
    toggleMargin,

    // Edit application
    applyProposedEdit,
    getEditStatus,

    // Persistence
    loadComments,

    // Chat integration
    submitToChat,
  }
})
