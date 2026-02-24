import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'

export function useReviewLayout(scrollContainerRef, comments, activeCommentId) {
  const positions = ref({})
  const cardHeights = ref({})
  const GAP = 12
  const CARD_HEIGHT_ESTIMATE = 120

  function registerCardHeight(id, height) {
    if (cardHeights.value[id] !== height) {
      cardHeights.value[id] = height
      requestAnimationFrame(recalculate)
    }
  }

  function recalculate() {
    const container = scrollContainerRef.value
    if (!container || !comments.value?.length) return

    const marks = container.querySelectorAll('mark[data-comment-id]')
    if (!marks.length) return

    const containerRect = container.getBoundingClientRect()
    const scrollTop = container.scrollTop

    // 1. Find anchor Y positions from DOM
    const anchors = {}
    marks.forEach(mark => {
      const id = mark.dataset.commentId
      if (!anchors[id]) {
        anchors[id] = mark.getBoundingClientRect().top - containerRect.top + scrollTop
      }
    })

    // 2. Build layout items (ordered by comment array order = document order)
    const layoutItems = comments.value.map(c => ({
      id: c.id,
      idealTop: anchors[c.id] ?? 0,
      height: cardHeights.value[c.id] || CARD_HEIGHT_ESTIMATE,
      finalTop: 0,
    }))
    if (!layoutItems.length) return

    // 3. Waterfall algorithm
    const activeId = activeCommentId.value
    const activeIndex = activeId ? layoutItems.findIndex(item => item.id === activeId) : -1

    if (activeIndex !== -1) {
      // Place active at its ideal position
      layoutItems[activeIndex].finalTop = layoutItems[activeIndex].idealTop

      // Push predecessors upward
      for (let i = activeIndex - 1; i >= 0; i--) {
        const cur = layoutItems[i]
        const next = layoutItems[i + 1]
        cur.finalTop = cur.idealTop
        if (cur.finalTop + cur.height + GAP > next.finalTop) {
          cur.finalTop = next.finalTop - cur.height - GAP
        }
      }

      // Push successors downward
      for (let i = activeIndex + 1; i < layoutItems.length; i++) {
        const cur = layoutItems[i]
        const prev = layoutItems[i - 1]
        cur.finalTop = cur.idealTop
        if (cur.finalTop < prev.finalTop + prev.height + GAP) {
          cur.finalTop = prev.finalTop + prev.height + GAP
        }
      }
    } else {
      // Simple top-down waterfall
      for (let i = 0; i < layoutItems.length; i++) {
        const cur = layoutItems[i]
        cur.finalTop = cur.idealTop
        if (i > 0) {
          const prev = layoutItems[i - 1]
          if (cur.finalTop < prev.finalTop + prev.height + GAP) {
            cur.finalTop = prev.finalTop + prev.height + GAP
          }
        }
      }
    }

    const newPositions = {}
    layoutItems.forEach(item => { newPositions[item.id] = item.finalTop })
    positions.value = newPositions
  }

  watch(comments, () => nextTick(recalculate), { deep: true })
  watch(activeCommentId, () => requestAnimationFrame(recalculate))

  let resizeObserver = null
  onMounted(() => {
    nextTick(recalculate)
    resizeObserver = new ResizeObserver(() => requestAnimationFrame(recalculate))
    if (scrollContainerRef.value) resizeObserver.observe(scrollContainerRef.value)
  })
  onBeforeUnmount(() => { if (resizeObserver) resizeObserver.disconnect() })

  return { positions, registerCardHeight, recalculate }
}
