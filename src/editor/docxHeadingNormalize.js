/**
 * SuperDoc extension: reset heading style to Normal on Enter.
 *
 * When the cursor is at the end of a Heading paragraph and the user presses
 * Enter, SuperDoc continues the heading style on the new line. This extension
 * detects the newly created empty heading paragraph and resets it to Normal
 * using SuperDoc's setStyleById command.
 *
 * Note: run-level formatting (bold, font size) from the heading may persist
 * on the first typed character. Fully clearing SuperDoc's internal stored
 * style mechanism is not yet solved.
 */
import { Extensions } from 'superdoc/super-editor'

const { Extension } = Extensions

export function createHeadingNormalizeExtension() {
  let prevDocSize = 0

  return Extension.create({
    name: 'docxHeadingNormalize',

    onUpdate({ editor }) {
      const curSize = editor.state.doc.content.size
      const grew = curSize > prevDocSize
      prevDocSize = curSize

      if (!grew) return

      const { from } = editor.state.selection
      const $pos = editor.state.doc.resolve(from)

      for (let depth = $pos.depth; depth >= 0; depth--) {
        const node = $pos.node(depth)
        if (node.type.name !== 'paragraph') continue

        const styleId = node.attrs?.paragraphProperties?.styleId || ''
        if (!styleId.match(/^Heading\d+$/i)) return

        // Only reset if the paragraph is empty (just created by Enter split)
        if (node.textContent.trim() !== '') return

        editor.commands.setStyleById('Normal')
        return
      }
    },
  })
}
