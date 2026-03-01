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

  /**
   * Apply a proposed edit given old/new strings directly.
   * Called by tasks store which extracts inputs from Chat instance messages.
   */
  async applyProposedEditFromInput(toolCallId, old_string, new_string) {
    const filesStore = useFilesStore()
    const editorStore = useEditorStore()
    const reviews = useReviewsStore()

    const ai = editorStore.getAnyAiActions(this.filePath)
    if (!ai) {
      throw new Error('AIActions not available.')
    }

    const result = await ai.action.literalReplace(old_string, new_string, {
      caseSensitive: true,
      trackChanges: !reviews.directMode,
    })

    if (!result.success) {
      throw new Error('old_string not found in document. The text may have changed.')
    }

    // Update text cache
    const editor = this.superdoc?.activeEditor
    if (editor) {
      filesStore.fileContents[this.filePath] = editor.state.doc.textContent
    }
  }

  // Legacy method — kept for backward compatibility with any existing callers
  async applyProposedEdit(threadId, toolCallId, thread) {
    // Find the tool call in legacy format
    let tc = null
    for (const msg of (thread.messages || [])) {
      if (msg.toolCalls) {
        tc = msg.toolCalls.find(t => t.id === toolCallId)
        if (tc) break
      }
    }
    if (!tc || tc.status === 'applied') return

    const { old_string, new_string } = tc.input
    if (!old_string || !new_string) return

    try {
      await this.applyProposedEditFromInput(toolCallId, old_string, new_string)
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
