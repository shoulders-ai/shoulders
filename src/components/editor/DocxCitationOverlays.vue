<template>
  <!-- No visible template — we inject spans directly into the SuperDoc painted DOM -->
</template>

<script setup>
/**
 * DocxCitationOverlays — renders citation text into SuperDoc's painted layer.
 *
 * SuperDoc's layout engine only renders known node types. Our custom `citation`
 * ProseMirror node is invisible in the painted layer. This component injects
 * styled <span> elements as inline siblings of leaf text runs inside
 * superdoc-line containers.
 *
 * DOM structure (confirmed via diagnostics):
 *   superdoc-page  (position: relative)
 *     superdoc-fragment  (position: absolute)
 *       superdoc-line  (position: relative)
 *         SPAN  (position: static, display: inline)  ← leaf text runs
 *         [our overlay inserted here as inline sibling]
 *         SPAN  (position: static, display: inline)
 */
import { watch, onMounted, onUnmounted } from 'vue'
import { findAllCitations } from '../../editor/docxCitations'
import { formatInlineCitation } from '../../services/citationFormatter'
import { useReferencesStore } from '../../stores/references'

const props = defineProps({
  wrapperEl: { type: Object, default: null },
  superdoc: { type: Object, default: null },
  onCitationClick: { type: Function, default: null },
  zoteroCitations: { type: Array, default: () => [] },
})

const referencesStore = useReferencesStore()

const OVERLAY_CLASS = 'citation-overlay-injected'

let observer = null
let resizeObserver = null
let debounceTimeout = null
let isInjecting = false
let expectedCount = 0
let lastInjectTime = 0
let documentClickHandler = null
let documentMousedownHandler = null

// ─── Formatting ───────────────────────────────────────────────

function formatCitationText(attrs) {
  const style = referencesStore.citationStyle || 'apa'
  const cites = attrs?.cites || []
  if (!cites.length) return '[?]'

  const isNumbered = style === 'ieee' || style === 'vancouver'
  const parts = cites.map(cite => {
    const ref = referencesStore.getByKey(cite.key)
    if (!ref) return cite.key
    const inline = formatInlineCitation(ref, style)
    return inline.replace(/^\(/, '').replace(/\)$/, '').replace(/^\[/, '').replace(/\]$/, '')
  })

  const separator = isNumbered ? ', ' : '; '
  const joined = parts.join(separator)
  return isNumbered ? `[${joined}]` : `(${joined})`
}

// ─── Painted DOM helpers ──────────────────────────────────────

/**
 * Get LEAF painted spans — the innermost text runs in SuperDoc's painted DOM.
 * These are display:inline within superdoc-line containers, so inserting
 * a sibling makes it flow naturally with the text.
 *
 * A span is a leaf if it has data-pm-start/end but no such descendants.
 */
function getLeafPaintedSpans(container) {
  const allSpans = Array.from(container.querySelectorAll('[data-pm-start][data-pm-end]'))
    .filter(el => !el.classList.contains(OVERLAY_CLASS))

  return allSpans
    .filter(el => !el.querySelector('[data-pm-start][data-pm-end]'))
    .map(el => ({
      el,
      pmStart: parseInt(el.dataset.pmStart),
      pmEnd: parseInt(el.dataset.pmEnd),
    }))
    .filter(s => !isNaN(s.pmStart) && !isNaN(s.pmEnd))
    .sort((a, b) => a.pmStart - b.pmStart || b.pmEnd - a.pmEnd)
}

/** Find the leaf span with the highest pmEnd that is ≤ targetPos */
function findLeafBefore(spans, targetPos) {
  let best = null
  for (const s of spans) {
    if (s.pmEnd <= targetPos) {
      if (!best || s.pmEnd > best.pmEnd) best = s
    }
  }
  return best
}

/** Find the leaf span with the lowest pmStart that is > targetPos */
function findLeafAfter(spans, targetPos) {
  let best = null
  for (const s of spans) {
    if (s.pmStart > targetPos) {
      if (!best || s.pmStart < best.pmStart) best = s
    }
  }
  return best
}

/** Walk up from an element to find its superdoc-line container */
function findLineContainer(el) {
  let node = el
  while (node) {
    if (node.classList?.contains('superdoc-line')) return node
    node = node.parentNode
  }
  return null
}

// ─── Injection ────────────────────────────────────────────────

/**
 * Create an inline overlay span that flows with neighboring text.
 * Copies font styles from the neighbor span to blend seamlessly.
 */
function createOverlaySpan(text, neighborSpan) {
  const span = document.createElement('span')
  span.className = OVERLAY_CLASS
  span.textContent = text

  if (neighborSpan) {
    const style = window.getComputedStyle(neighborSpan)
    span.style.fontFamily = style.fontFamily
    span.style.fontSize = style.fontSize
    span.style.lineHeight = style.lineHeight
  }
  // Visual distinction + ensure clickability above SuperDoc's editing surface
  span.style.color = 'var(--accent-color, #4a7cbb)'
  span.style.cursor = 'pointer'
  span.style.userSelect = 'none'
  span.style.webkitUserSelect = 'none'
  span.style.pointerEvents = 'auto'
  span.style.position = 'relative'
  span.style.zIndex = '200000' // above superdoc-line's 100000

  return span
}

/**
 * Inject overlays for citation nodes found in the PM document.
 * Inserts each overlay as an inline sibling of a leaf text span
 * within the same superdoc-line container.
 */
function injectFromCitationNodes(container, citations, leafSpans) {
  let injected = 0

  for (const { node, pos } of citations) {
    const before = findLeafBefore(leafSpans, pos)
    const after = findLeafAfter(leafSpans, pos)

    if (!before && !after) continue

    // Determine insertion point based on which superdoc-line the neighbors are in.
    // Same line → insert after the preceding leaf (natural reading position).
    // Different lines → citation is at a line break; insert before the following
    // leaf so it appears at the start of the new line.
    let anchorEl, insertBeforeAnchor

    if (before && after) {
      const beforeLine = findLineContainer(before.el)
      const afterLine = findLineContainer(after.el)

      if (beforeLine && afterLine && beforeLine !== afterLine) {
        anchorEl = after.el
        insertBeforeAnchor = true
      } else {
        anchorEl = before.el
        insertBeforeAnchor = false
      }
    } else if (before) {
      anchorEl = before.el
      insertBeforeAnchor = false
    } else {
      anchorEl = after.el
      insertBeforeAnchor = true
    }

    if (!anchorEl?.parentNode) continue

    const text = formatCitationText(node.attrs)
    const overlay = createOverlaySpan(text, anchorEl)
    overlay.dataset.citationId = node.attrs.citationId

    if (insertBeforeAnchor) {
      anchorEl.parentNode.insertBefore(overlay, anchorEl)
    } else {
      anchorEl.parentNode.insertBefore(overlay, anchorEl.nextSibling)
    }

    // No per-element handlers here — document-level capture handlers
    // (installed in onMounted) intercept events before SuperDoc can.

    injected++
  }

  return injected
}

// ─── Core ─────────────────────────────────────────────────────

function injectOverlays() {
  const container = props.wrapperEl
  const editor = props.superdoc?.activeEditor
  if (!container) return

  isInjecting = true
  lastInjectTime = Date.now()

  try {
    // Clean all existing overlays before re-injection
    container.querySelectorAll('.' + OVERLAY_CLASS).forEach(el => el.remove())

    const leafSpans = getLeafPaintedSpans(container)
    if (!leafSpans.length) {
      expectedCount = 0
      return
    }

    if (editor) {
      const citations = findAllCitations(editor.state.doc)
      if (citations.length) {
        expectedCount = injectFromCitationNodes(container, citations, leafSpans)
        return
      }
    }

    expectedCount = 0
  } finally {
    isInjecting = false
  }
}

// ─── Hit testing ─────────────────────────────────────────────

/**
 * Find a citation overlay at the given screen coordinates.
 * Uses elementsFromPoint() to look through SuperDoc's invisible editing surface
 * and find our overlay buried in the painted layer beneath.
 */
function findOverlayAtPoint(x, y) {
  const elements = document.elementsFromPoint(x, y)
  for (const el of elements) {
    if (el.classList?.contains(OVERLAY_CLASS)) return el
    const parent = el.closest?.('.' + OVERLAY_CLASS)
    if (parent) return parent
  }
  return null
}

// ─── Scheduling ───────────────────────────────────────────────

function scheduleInject(delay = 100) {
  if (debounceTimeout) clearTimeout(debounceTimeout)
  debounceTimeout = setTimeout(() => {
    requestAnimationFrame(injectOverlays)
  }, delay)
}

function onContentChanged() {
  scheduleInject(200)
}

// ─── Lifecycle ────────────────────────────────────────────────

onMounted(() => {
  const container = props.wrapperEl
  if (!container) return

  // Document-level capture-phase handlers.
  // SuperDoc has an invisible editing surface on top of the painted layer.
  // e.target is that surface, NOT our overlay. We use elementsFromPoint()
  // to check ALL elements at the click position (including buried overlays).
  documentMousedownHandler = (e) => {
    const overlay = findOverlayAtPoint(e.clientX, e.clientY)
    if (!overlay) return
    e.stopPropagation()
    e.preventDefault()
  }
  documentClickHandler = (e) => {
    const overlay = findOverlayAtPoint(e.clientX, e.clientY)
    if (!overlay) return
    e.stopPropagation()
    e.preventDefault()

    const citationId = overlay.dataset.citationId

    const editor = props.superdoc?.activeEditor
    if (!editor) return

    const fresh = findAllCitations(editor.state.doc)
      .find(c => c.node.attrs.citationId === citationId)
    if (fresh) {
      props.onCitationClick?.(fresh.node, fresh.pos, e)
    }
  }
  document.addEventListener('mousedown', documentMousedownHandler, true)
  document.addEventListener('click', documentClickHandler, true)

  // MutationObserver: SuperDoc repaints recreate line containers, removing our
  // injected overlays. Detect when overlay count drops and re-inject.
  // Throttled to 300ms to prevent loops during strip/restore save cycles.
  observer = new MutationObserver(() => {
    if (isInjecting) return
    if (Date.now() - lastInjectTime < 300) return

    const current = container.querySelectorAll('.' + OVERLAY_CLASS).length
    if (current < expectedCount) {
      scheduleInject(150)
    }
  })
  observer.observe(container, { childList: true, subtree: true })

  container.addEventListener('docx-content-changed', onContentChanged)

  resizeObserver = new ResizeObserver(() => scheduleInject(150))
  resizeObserver.observe(container)

  // Initial injection after SuperDoc paints (needs time to create painted DOM)
  scheduleInject(500)
})

onUnmounted(() => {
  if (documentMousedownHandler) {
    document.removeEventListener('mousedown', documentMousedownHandler, true)
    documentMousedownHandler = null
  }
  if (documentClickHandler) {
    document.removeEventListener('click', documentClickHandler, true)
    documentClickHandler = null
  }
  const container = props.wrapperEl
  if (container) {
    container.removeEventListener('docx-content-changed', onContentChanged)
    container.querySelectorAll('.' + OVERLAY_CLASS).forEach(el => el.remove())
  }
  if (observer) { observer.disconnect(); observer = null }
  if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null }
  if (debounceTimeout) clearTimeout(debounceTimeout)
})

watch(() => referencesStore.citationStyle, () => scheduleInject(50))
watch(() => props.superdoc?.activeEditor, () => scheduleInject(500))
</script>
