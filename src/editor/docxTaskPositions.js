import { Extensions } from 'superdoc/super-editor'

const { Extension, Plugin, PluginKey } = Extensions

export const taskPositionsKey = new PluginKey('docxTaskPositions')

/**
 * SuperDoc extension that maps AI task thread positions through document
 * transactions. Keeps thread.range.from/to in sync as the user edits.
 *
 * @param {Function} getThreads - Returns array of threads for this file
 * @param {Function} onPositionsUpdated - Called when any position changed
 */
export function createDocxTaskPositionsExtension({ getThreads, onPositionsUpdated }) {
  return Extension.create({
    name: 'docxTaskPositions',

    addPmPlugins() {
      return [
        new Plugin({
          key: taskPositionsKey,

          state: {
            init() {
              return { version: 0 }
            },

            apply(tr, prev) {
              if (!tr.docChanged) return prev

              const threads = getThreads()
              let changed = false

              for (const t of threads) {
                if (!t.range) continue
                const nf = tr.mapping.map(t.range.from, -1)
                const nt = tr.mapping.map(t.range.to, 1)
                if (nf !== t.range.from || nt !== t.range.to) {
                  t.range.from = nf
                  t.range.to = nt
                  changed = true
                }
              }

              if (changed) {
                onPositionsUpdated()
              }

              return changed ? { version: prev.version + 1 } : prev
            },
          },
        }),
      ]
    },
  })
}
