import { useFilesStore } from '../stores/files'
import { useEditorStore } from '../stores/editor'
import { useReviewsStore } from '../stores/reviews'

/**
 * Handles AI task thread edits for DOCX files via SuperDoc's AIActions API.
 * Native SuperDoc comments are fully separate — managed by SuperDoc itself.
 */
export class DocxTaskBridge {
  constructor(superdoc, filePath) {
    this.superdoc = superdoc
    this.filePath = filePath
  }

  async applyProposedEdit(threadId, toolCallId, thread) {
    const filesStore = useFilesStore()
    const editorStore = useEditorStore()
    const reviews = useReviewsStore()

    // Find the tool call
    let tc = null
    for (const msg of thread.messages) {
      if (msg.toolCalls) {
        tc = msg.toolCalls.find(t => t.id === toolCallId)
        if (tc) break
      }
    }
    if (!tc || tc.status === 'applied') return

    const { old_string, new_string } = tc.input
    if (!old_string || !new_string) return

    // Use AIActions.literalReplace — the official SuperDoc API for atomic
    // find-and-replace. Creates a single undo step and proper tracked changes.
    const ai = editorStore.getAnyAiActions(this.filePath)
    if (!ai) {
      tc.output = 'Error: AIActions not available.'
      tc.status = 'error'
      return
    }

    try {
      const result = await ai.action.literalReplace(old_string, new_string, {
        caseSensitive: true,
        trackChanges: !reviews.directMode,
      })

      if (!result.success) {
        tc.output = 'Error: old_string not found in document. The text may have changed.'
        tc.status = 'error'
        return
      }

      // Update text cache
      const editor = this.superdoc?.activeEditor
      if (editor) {
        filesStore.fileContents[this.filePath] = editor.state.doc.textContent
      }

      tc.status = 'applied'
    } catch (e) {
      tc.output = `Error applying edit: ${e}`
      tc.status = 'error'
    }
  }

  destroy() {
    // No-op — kept for interface compatibility
  }
}
