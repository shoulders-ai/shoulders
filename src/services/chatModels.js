export function getContextWindow(modelId, workspace) {
  const config = workspace.modelsConfig
  if (!config) return 200000
  const model = config.models?.find(m => m.id === modelId) || config.models?.[0]
  return model?.contextWindow || 200000
}


export function getThinkingConfig(apiModel, provider, thinkingLevel) {
  // Explicit opt-out: model entry has thinking: 'none'
  if (thinkingLevel === 'none') return null

  if (provider === 'anthropic' || provider === 'shoulders') {
    if (/claude-(opus|sonnet)-4-6/.test(apiModel)) {
      return { mode: 'adaptive', effort: thinkingLevel || 'medium' }
    }
    if (/claude-(opus|sonnet)-4/.test(apiModel)) {
      return { mode: 'manual', budgetTokens: 10000 }
    }
  }
  if (provider === 'openai') {
    if (/gpt-5|o\d/.test(apiModel)) {
      return { mode: 'openai', effort: thinkingLevel || 'medium' }
    }
  }
  if (provider === 'google') {
    if (/gemini-3/.test(apiModel) && !/lite/.test(apiModel)) {
      return { mode: 'google', level: thinkingLevel || 'high' }
    }
    if (/gemini-2\.5/.test(apiModel) && !/lite/.test(apiModel)) {
      return { mode: 'google25', budget: 8192 }
    }
  }
  return null
}

export function modelHasAccess(modelConfig, providerConfig, workspace) {
  const keyEnv = providerConfig?.apiKeyEnv
  const key = keyEnv ? workspace.apiKeys?.[keyEnv] : null
  const hasDirectKey = key && !key.includes('your-')
  const hasProxyAccess = !!workspace.shouldersAuth?.token
  return hasDirectKey || hasProxyAccess
}
