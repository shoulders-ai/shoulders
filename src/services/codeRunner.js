// Code Runner — sends code from the editor to language REPLs in the right panel.
// Uses window.dispatchEvent for cross-component communication (existing pattern).

const LANGUAGE_CONFIG = {
  r: { cmd: 'R', args: ['--interactive', '--no-save'], label: 'R' },
  python: { cmd: 'python3', args: ['-i'], label: 'Python' },
  julia: { cmd: 'julia', args: [], label: 'Julia' },
}

// Extension → language key
const EXT_LANGUAGE_MAP = {
  r: 'r',
  R: 'r',
  py: 'python',
  pyw: 'python',
  jl: 'julia',
  rmd: 'r',
  Rmd: 'r',
  qmd: 'r',
}

export function getLanguageConfig(language) {
  return LANGUAGE_CONFIG[language] || null
}

export function getLanguageForFile(filePath) {
  const name = filePath.split('/').pop() || ''
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return null
  const ext = name.substring(dot + 1)
  return EXT_LANGUAGE_MAP[ext] || null
}

/**
 * Ensure a language REPL terminal exists. Dispatches event for RightPanel to handle.
 * Returns immediately — the terminal may take a moment to spawn.
 */
export function ensureSession(language) {
  window.dispatchEvent(new CustomEvent('create-language-terminal', { detail: { language } }))
}

/**
 * Send code to a language REPL. If no REPL exists, one is auto-created first.
 */
export function sendCode(code, language) {
  if (!code || !language) return
  // Ensure the REPL exists (no-op if already running)
  ensureSession(language)
  // Small delay to let the terminal spawn if needed
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('send-to-repl', { detail: { code, language } }))
  }, 100)
}

/**
 * Run an entire file by wrapping it in the language's source command.
 */
export function runFile(filePath, language) {
  if (!filePath || !language) return
  // Never source() .Rmd/.qmd files — use chunk extraction instead
  const ext = (filePath.split('/').pop() || '').split('.').pop()?.toLowerCase()
  if (ext === 'rmd' || ext === 'qmd') return
  let code
  switch (language) {
    case 'r':
      code = `source("${filePath}")`
      break
    case 'python':
      code = `exec(open("${filePath}").read())`
      break
    case 'julia':
      code = `include("${filePath}")`
      break
    default:
      return
  }
  sendCode(code, language)
}

/**
 * Render an Rmd/qmd document. Dispatched as a shell command to the language REPL.
 */
export function renderDocument(filePath) {
  const name = filePath.split('/').pop() || ''
  const ext = name.substring(name.lastIndexOf('.') + 1).toLowerCase()

  if (ext === 'qmd') {
    // Quarto render — use shell terminal, not R REPL
    window.dispatchEvent(new CustomEvent('send-to-repl', {
      detail: { code: `quarto render "${filePath}"`, language: '__shell__' }
    }))
    ensureSession('__shell__')
  } else {
    // Rmd → rmarkdown::render via R
    sendCode(`rmarkdown::render("${filePath}")`, 'r')
  }
}
