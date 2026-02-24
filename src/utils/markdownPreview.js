import { Marked } from 'marked'
import markedKatex from 'marked-katex-extension'
import { markedHighlight } from 'marked-highlight'
import markedFootnote from 'marked-footnote'
import hljs from 'highlight.js/lib/core'
import DOMPurify from 'dompurify'
import { formatInlineCitation } from '../services/citationFormatter'
import { isFastPath } from '../services/citationStyleRegistry'

// Register commonly-used languages (selective import keeps bundle small)
import javascript from 'highlight.js/lib/languages/javascript'
import python from 'highlight.js/lib/languages/python'
import r from 'highlight.js/lib/languages/r'
import bash from 'highlight.js/lib/languages/bash'
import json from 'highlight.js/lib/languages/json'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import sql from 'highlight.js/lib/languages/sql'
import yaml from 'highlight.js/lib/languages/yaml'
import rust from 'highlight.js/lib/languages/rust'
import go from 'highlight.js/lib/languages/go'
import java from 'highlight.js/lib/languages/java'
import c from 'highlight.js/lib/languages/c'
import latex from 'highlight.js/lib/languages/latex'
import markdown from 'highlight.js/lib/languages/markdown'
import typescript from 'highlight.js/lib/languages/typescript'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('py', python)
hljs.registerLanguage('r', r)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('sh', bash)
hljs.registerLanguage('json', json)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('yml', yaml)
hljs.registerLanguage('rust', rust)
hljs.registerLanguage('go', go)
hljs.registerLanguage('java', java)
hljs.registerLanguage('c', c)
hljs.registerLanguage('latex', latex)
hljs.registerLanguage('tex', latex)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('md', markdown)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)

// Create a separate marked instance (don't pollute chat markdown)
const marked = new Marked()

// KaTeX math rendering
marked.use(markedKatex({
  throwOnError: false,
  output: 'htmlAndMathml',
}))

// Syntax highlighting
marked.use(markedHighlight({
  langPrefix: 'hljs language-',
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value
    }
    return hljs.highlightAuto(code).value
  },
}))

// Footnotes
marked.use(markedFootnote())

// Custom renderer extensions
marked.use({
  renderer: {
    // Wiki links: [[target]] → clickable link
    text(token) {
      let text = token.raw || token.text || ''
      // Wiki links
      text = text.replace(/\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g, (_, target, display) => {
        const label = display || target
        return `<a class="md-preview-wikilink" data-target="${target.trim()}">${label}</a>`
      })
      // Pandoc citations: [@key] or [@key1; @key2]
      text = text.replace(/\[([^\]]*@[a-zA-Z][\w]*[^\]]*)\]/g, (match, inner) => {
        const keys = []
        const re = /@([a-zA-Z][\w]*)/g
        let m
        while ((m = re.exec(inner)) !== null) {
          keys.push(m[1])
        }
        if (keys.length === 0) return match
        return `<span class="md-preview-citation" data-keys="${keys.join(',')}">${match}</span>`
      })
      return text
    },
  },
})

/**
 * Render markdown to sanitized HTML.
 *
 * For the 5 fast-path styles (APA, Chicago, IEEE, Harvard, Vancouver),
 * citation formatting is sync. For CSL styles, returns a promise.
 *
 * @param {string} md - Raw markdown string
 * @param {Object} [refs] - Optional references store for resolving citations
 * @param {string} [citationStyle='apa'] - Citation style ID
 * @returns {string|Promise<string>} Sanitized HTML string (or Promise for CSL styles)
 */
export function renderPreview(md, refs, citationStyle = 'apa') {
  let html = marked.parse(md || '')

  // Resolve citations if references store is provided
  if (refs) {
    // Fast path: use built-in sync formatters
    if (isFastPath(citationStyle)) {
      html = resolveCitationsFast(html, refs, citationStyle)
    } else {
      // CSL path: return a promise
      const baseHtml = html
      return resolveCitationsCSL(baseHtml, refs, citationStyle).then(resolved =>
        sanitize(resolved)
      )
    }
  }

  return sanitize(html)
}

function sanitize(html) {
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ['semantics', 'annotation', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'mfrac', 'munder', 'mover', 'munderover', 'mtable', 'mtr', 'mtd', 'mtext', 'mspace', 'math', 'menclose', 'msqrt', 'mroot', 'mpadded', 'mphantom', 'mstyle'],
    ADD_ATTR: ['data-target', 'data-keys', 'mathvariant', 'encoding', 'xmlns', 'display', 'accent', 'accentunder', 'columnalign', 'columnlines', 'columnspacing', 'rowspacing', 'rowlines', 'frame', 'separator', 'stretchy', 'symmetric', 'movablelimits', 'fence', 'lspace', 'rspace', 'linethickness', 'scriptlevel'],
  })
}

/**
 * Resolve citations using the built-in fast-path formatters (sync).
 */
function resolveCitationsFast(html, refs, style) {
  const isNumeric = style === 'ieee' || style === 'vancouver'

  let keyNumberMap = {}
  if (isNumeric) {
    let counter = 0
    const seen = new Set()
    const citationRe = /<span class="md-preview-citation" data-keys="([^"]*)">/g
    let m
    while ((m = citationRe.exec(html)) !== null) {
      for (const key of m[1].split(',')) {
        if (!seen.has(key)) {
          seen.add(key)
          keyNumberMap[key] = ++counter
        }
      }
    }
  }

  return html.replace(
    /<span class="md-preview-citation" data-keys="([^"]*)">\[([^\]]*)\]<\/span>/g,
    (_, keysStr, raw) => {
      const keys = keysStr.split(',')
      const parts = keys.map(key => {
        const ref = refs.getByKey(key)
        if (!ref) return `@${key}`
        return formatInlineCitation(ref, style, keyNumberMap[key])
      })

      let display
      if (isNumeric) {
        display = parts.join(', ')
      } else {
        const stripped = parts.map(p => p.replace(/^\(/, '').replace(/\)$/, ''))
        display = `(${stripped.join('; ')})`
      }

      return `<span class="md-preview-citation" data-keys="${keysStr}" title="${raw}">${display}</span>`
    }
  )
}

/**
 * Resolve citations using citeproc-js (async, for non-fast-path styles).
 */
async function resolveCitationsCSL(html, refs, styleId) {
  const { formatWithCSL } = await import('../services/citationFormatterCSL')

  // Collect all unique citation keys in document order
  const allKeys = []
  const seen = new Set()
  const citationRe = /<span class="md-preview-citation" data-keys="([^"]*)">/g
  let m
  while ((m = citationRe.exec(html)) !== null) {
    for (const key of m[1].split(',')) {
      if (!seen.has(key)) {
        seen.add(key)
        allKeys.push(key)
      }
    }
  }

  if (allKeys.length === 0) return html

  // Build CSL items for all cited refs
  const items = allKeys.map(key => refs.getByKey(key)).filter(Boolean)
  if (items.length === 0) return html

  // Get inline citation for each individual ref
  const inlineCache = {}
  for (const item of items) {
    const key = item._key || item.id
    try {
      inlineCache[key] = await formatWithCSL(styleId, 'inline', [item])
    } catch {
      inlineCache[key] = `@${key}`
    }
  }

  return html.replace(
    /<span class="md-preview-citation" data-keys="([^"]*)">\[([^\]]*)\]<\/span>/g,
    (_, keysStr, raw) => {
      const keys = keysStr.split(',')
      const parts = keys.map(key => inlineCache[key] || `@${key}`)
      const display = parts.join('; ')
      return `<span class="md-preview-citation" data-keys="${keysStr}" title="${raw}">${display}</span>`
    }
  )
}
