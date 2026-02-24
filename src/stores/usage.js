import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/core'
import { formatCost } from '../services/tokenUsage'
import { useToastStore } from './toast'

function getCurrentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export const useUsageStore = defineStore('usage', {
  state: () => ({
    monthData: null,     // { total_cost, calls, by_feature, by_model }
    selectedMonth: getCurrentMonth(),
    trendData: [],       // [{ month, cost, calls, shoulders_cost }] — newest first
    dailyData: [],       // [{ date, cost, calls, shoulders_cost }] — for selected month, ascending
    monthlyLimit: 0,     // USD, 0 = no limit
    showInFooter: true,
    showCostEstimates: false, // opt-in: show dollar estimates for direct API key usage
    sessionTotals: {},   // { [sessionId]: cost }
  }),

  getters: {
    totalCost: (state) => state.monthData?.total_cost || 0,
    formattedTotal() { return formatCost(this.totalCost) },
    isNearBudget() { return this.monthlyLimit > 0 && this.directCost >= this.monthlyLimit * 0.8 },
    isOverBudget() { return this.monthlyLimit > 0 && this.directCost >= this.monthlyLimit },
    byFeature: (state) => state.monthData?.by_feature || [],
    byModel: (state) => state.monthData?.by_model || [],
    totalCalls: (state) => state.monthData?.calls || 0,
    sessionCost: (state) => (id) => state.sessionTotals[id] || 0,

    shouldersCost: (state) => state.monthData?.shoulders_cost || 0,
    directCost: (state) => state.monthData?.direct_cost || 0,
    shouldersCalls: (state) => state.monthData?.shoulders_calls || 0,
    directCalls: (state) => state.monthData?.direct_calls || 0,
    totalInputTokens: (state) => state.monthData?.total_input_tokens || 0,
    totalOutputTokens: (state) => state.monthData?.total_output_tokens || 0,

    isCurrentMonth() { return this.selectedMonth === getCurrentMonth() },
    allTimeCost: (state) => state.trendData.reduce((sum, e) => sum + e.cost, 0),
    allTimeCalls: (state) => state.trendData.reduce((sum, e) => sum + e.calls, 0),
    allTimeShouldersCost: (state) => state.trendData.reduce((sum, e) => sum + (e.shoulders_cost || 0), 0),
    monthCount: (state) => state.trendData.length,

    selectedMonthLabel() {
      const [y, m] = this.selectedMonth.split('-').map(Number)
      const d = new Date(y, m - 1, 1)
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    },
  },

  actions: {
    async record({ usage, feature, provider, modelId, sessionId }) {
      if (!usage || (usage.total === 0 && !usage.cost)) return
      const { useWorkspaceStore } = await import('./workspace')
      const workspace = useWorkspaceStore()
      try {
        await invoke('usage_record', {
          workspace: workspace.path || null,
          feature,
          provider,
          model: modelId || 'unknown',
          inputTokens: usage.input_total || 0,
          outputTokens: usage.output || 0,
          cacheRead: usage.input_cache_hit || 0,
          cacheWrite: usage.input_cache_write || 0,
          cost: usage.cost || 0,
          sessionId: sessionId || null,
        })
      } catch (e) {
        console.warn('[usage] Failed to record:', e)
      }
      // Refresh current view (non-blocking)
      if (this.isCurrentMonth) {
        this.loadMonth().then(() => this.checkBudgetThresholds())
        this.loadDailyTrend()
      }
      this.loadTrend()
    },

    async loadMonth() {
      const { useWorkspaceStore } = await import('./workspace')
      const workspace = useWorkspaceStore()
      try {
        this.monthData = await invoke('usage_query_month', {
          month: this.selectedMonth,
          workspace: workspace.path || null,
        })
      } catch (e) {
        console.warn('[usage] Failed to load month data:', e)
      }
    },

    async loadTrend() {
      const { useWorkspaceStore } = await import('./workspace')
      const workspace = useWorkspaceStore()
      try {
        this.trendData = await invoke('usage_query_monthly_trend', {
          count: 12,
          workspace: workspace.path || null,
        })
      } catch (e) {
        console.warn('[usage] Failed to load trend:', e)
      }
    },

    async loadDailyTrend() {
      const { useWorkspaceStore } = await import('./workspace')
      const workspace = useWorkspaceStore()
      try {
        this.dailyData = await invoke('usage_query_daily_trend', {
          month: this.selectedMonth,
          workspace: workspace.path || null,
        })
      } catch (e) {
        console.warn('[usage] Failed to load daily trend:', e)
      }
    },

    navigateMonth(delta) {
      const [year, month] = this.selectedMonth.split('-').map(Number)
      const d = new Date(year, month - 1 + delta, 1)
      const now = new Date()
      // Don't navigate past current month
      if (d.getFullYear() > now.getFullYear() ||
          (d.getFullYear() === now.getFullYear() && d.getMonth() > now.getMonth())) {
        return
      }
      this.selectedMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      this.loadMonth()
      this.loadDailyTrend()
    },

    goToCurrentMonth() {
      this.selectedMonth = getCurrentMonth()
      this.loadMonth()
      this.loadDailyTrend()
    },

    goToMonth(ym) {
      this.selectedMonth = ym
      this.loadMonth()
      this.loadDailyTrend()
    },

    async loadSettings() {
      try {
        const limit = await invoke('usage_get_setting', { key: 'monthly_limit' })
        this.monthlyLimit = limit ? parseFloat(limit) || 0 : 0

        const show = await invoke('usage_get_setting', { key: 'show_footer_cost' })
        this.showInFooter = show !== 'false'

        const estimates = await invoke('usage_get_setting', { key: 'show_cost_estimates' })
        this.showCostEstimates = estimates === 'true'
      } catch (e) {
        console.warn('[usage] Failed to load settings:', e)
      }

      // Auto-clear stale budget if user has no direct API keys
      if (this.monthlyLimit > 0) {
        const { useWorkspaceStore } = await import('./workspace')
        const keys = useWorkspaceStore().apiKeys || {}
        const hasDirectKeys = !!(keys.ANTHROPIC_API_KEY || keys.OPENAI_API_KEY || keys.GOOGLE_API_KEY)
        if (!hasDirectKeys) {
          this.monthlyLimit = 0
          await invoke('usage_set_setting', { key: 'monthly_limit', value: '0' }).catch(() => {})
        }
      }
    },

    async setMonthlyLimit(usd) {
      this.monthlyLimit = usd
      try {
        await invoke('usage_set_setting', { key: 'monthly_limit', value: String(usd) })
      } catch (e) {
        console.warn('[usage] Failed to save monthly limit:', e)
      }
    },

    async setShowInFooter(val) {
      this.showInFooter = val
      try {
        await invoke('usage_set_setting', { key: 'show_footer_cost', value: String(val) })
      } catch (e) {
        console.warn('[usage] Failed to save footer setting:', e)
      }
    },

    async setShowCostEstimates(val) {
      this.showCostEstimates = val
      try {
        await invoke('usage_set_setting', { key: 'show_cost_estimates', value: String(val) })
      } catch (e) {
        console.warn('[usage] Failed to save cost estimates setting:', e)
      }
    },

    checkBudgetThresholds() {
      if (this.monthlyLimit <= 0) return
      const toast = useToastStore()
      const spent = formatCost(this.directCost)
      const limit = '$' + this.monthlyLimit.toFixed(0)
      if (this.isOverBudget) {
        toast.showOnce('budget-over', `Monthly budget of ${limit} reached (${spent} spent). Change your budget in Settings > Models to continue using AI features.`, { type: 'error', duration: 6000 }, Infinity)
      } else if (this.isNearBudget) {
        toast.showOnce('budget-near', `Approaching monthly budget — ${spent} of ${limit}`, { type: 'warning', duration: 4000 }, Infinity)
      }
    },

    rebuildSessionTotals(sessions) {
      const totals = {}
      for (const session of sessions) {
        let cost = 0
        for (const msg of session.messages || []) {
          if (msg.usage?.cost) cost += msg.usage.cost
        }
        if (cost > 0) totals[session.id] = cost
      }
      this.sessionTotals = totals
    },
  },
})
