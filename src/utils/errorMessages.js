/**
 * Shared error message utilities.
 * Parses raw API/IPC errors into user-friendly strings.
 */

/**
 * Parse a raw API error (typically from Rust proxy) into structured info.
 * Input formats:
 *   "API error 401: {\"error\":{\"message\":\"Invalid API key\"}}"
 *   "API error 429: rate limit"
 *   "Request error: connection refused"
 *   plain string
 */
export function parseApiError(rawError) {
  const str = typeof rawError === 'string' ? rawError : String(rawError || 'Unknown error')
  const result = { friendly: '', status: 0, isAuthError: false, isRateLimit: false }

  // Try to extract HTTP status code
  const statusMatch = str.match(/API error (\d{3})/)
  if (statusMatch) {
    result.status = parseInt(statusMatch[1], 10)
  }

  // Try to extract JSON error body ([\s\S] to match multiline JSON)
  let bodyMessage = ''
  const jsonMatch = str.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      bodyMessage = parsed?.error?.message || parsed?.message || parsed?.error || ''
      if (typeof bodyMessage !== 'string') bodyMessage = ''
    } catch { /* not JSON */ }
  }

  // Map by status code
  if (result.status === 401 || result.status === 403) {
    result.isAuthError = true
    result.friendly = 'Invalid API key. Update it in **Settings \u203a Models** (Cmd+,), or sign in via **Settings \u203a Account**.'
  } else if (result.status === 402) {
    result.friendly = bodyMessage || 'Insufficient balance. Add funds at [shoulde.rs/account](https://shoulde.rs/account).'
  } else if (result.status === 429) {
    result.isRateLimit = true
    result.friendly = 'Rate limit exceeded. Wait a moment and try again.'
  } else if (result.status >= 500) {
    result.friendly = 'The AI provider is experiencing issues. Try again in a few minutes.'
  } else if (/timeout|timed out/i.test(str)) {
    result.friendly = 'Request timed out. Check your connection and try again.'
  } else if (/connection|network|refused|dns/i.test(str)) {
    result.friendly = 'Could not connect to the AI provider. Check your internet connection.'
  } else if (bodyMessage) {
    result.friendly = bodyMessage.length > 200 ? bodyMessage.slice(0, 200) + '...' : bodyMessage
  } else if (result.status > 0) {
    result.friendly = `Request failed (HTTP ${result.status}). Try again.`
  } else {
    // Fallback: truncate raw string
    result.friendly = str.length > 150 ? str.slice(0, 150) + '...' : str
  }

  return result
}

/**
 * Friendly message when no API key is configured for a model.
 */
export function noApiKeyMessage(modelId) {
  const label = modelId || 'this model'
  return `No API key configured for **${label}**. Add one in **Settings \u203a Models** (Cmd+,), or sign in via **Settings \u203a Account**.`
}

/**
 * Format a raw API error into markdown for chat bubbles.
 * Adds Settings hint for auth errors.
 */
export function formatChatApiError(rawError) {
  const parsed = parseApiError(rawError)
  return `**Error:** ${parsed.friendly}`
}

/**
 * Format a Tauri invoke() error for display.
 */
export function formatInvokeError(error) {
  const str = typeof error === 'string' ? error : String(error || 'Unknown error')
  if (/connection|network|refused/i.test(str)) {
    return 'Could not reach the AI service. Check your connection.'
  }
  return `Something went wrong: ${str.length > 150 ? str.slice(0, 150) + '...' : str}`
}

/**
 * Format a file operation error for toast display.
 * @param {'save'|'load'|'restore'} operation
 * @param {string} filePath
 * @param {*} error
 */
export function formatFileError(operation, filePath, error) {
  const name = filePath ? filePath.split('/').pop() : 'file'
  const str = typeof error === 'string' ? error : String(error || '')

  let reason = ''
  if (/permission|denied|access/i.test(str)) {
    reason = 'permission denied'
  } else if (/no such file|not found|does not exist/i.test(str)) {
    reason = 'file not found'
  } else if (/disk full|no space/i.test(str)) {
    reason = 'disk full'
  } else if (/read.only/i.test(str)) {
    reason = 'file is read-only'
  }

  const verb = operation === 'save' ? 'save' : operation === 'load' ? 'load' : 'restore'
  return reason
    ? `Cannot ${verb} '${name}' \u2014 ${reason}.`
    : `Cannot ${verb} '${name}'. ${str.length > 100 ? str.slice(0, 100) + '...' : str}`
}
