import { defineStore } from 'pinia'
import { nanoid } from './utils'

export const useToastStore = defineStore('toast', {
  state: () => ({
    toasts: [],
    _recentKeys: {},
  }),

  actions: {
    show(message, { type = 'success', duration = 3000, action = null } = {}) {
      const id = nanoid()
      this.toasts.push({ id, message, type, action })
      if (duration > 0) {
        setTimeout(() => this.dismiss(id), duration)
      }
      return id
    },

    /** Update an existing toast in-place (same position, no re-animation). */
    update(id, message, { type, action, duration } = {}) {
      const toast = this.toasts.find(t => t.id === id)
      if (!toast) return
      toast.message = message
      if (type !== undefined) toast.type = type
      toast.action = action !== undefined ? action : toast.action
      if (duration > 0) {
        setTimeout(() => this.dismiss(id), duration)
      }
    },

    /**
     * Show a toast at most once per `cooldown` ms for the given key.
     * Useful for auto-save errors to avoid toasting on every keystroke.
     */
    showOnce(key, message, options = {}, cooldown = 30000) {
      const now = Date.now()
      if (this._recentKeys[key] && now - this._recentKeys[key] < cooldown) return
      this._recentKeys[key] = now
      this.show(message, options)
    },

    dismiss(id) {
      this.toasts = this.toasts.filter(t => t.id !== id)
    },
  },
})
