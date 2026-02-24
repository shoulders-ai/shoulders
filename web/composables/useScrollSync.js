import { watch, onBeforeUnmount } from 'vue'

export function useScrollSync(sourceRef, targetRef) {
  let sourceEl = null
  let targetEl = null
  let ticking = false

  const updatePosition = () => {
    if (sourceEl && targetEl) {
      targetEl.style.transform = `translateY(-${sourceEl.scrollTop}px)`
    }
    ticking = false
  }

  const handleScroll = () => {
    if (!ticking) {
      window.requestAnimationFrame(updatePosition)
      ticking = true
    }
  }

  const handleWheel = (e) => {
    if (sourceEl) {
      sourceEl.scrollTop += e.deltaY
      e.preventDefault()
    }
  }

  const cleanup = () => {
    if (sourceEl) sourceEl.removeEventListener('scroll', handleScroll)
    if (targetEl) {
      targetEl.removeEventListener('wheel', handleWheel)
      if (targetEl.parentElement) targetEl.parentElement.removeEventListener('wheel', handleWheel)
    }
  }

  watch(
    [sourceRef, targetRef],
    ([newSource, newTarget]) => {
      cleanup()
      if (newSource && newTarget) {
        sourceEl = newSource
        targetEl = newTarget
        updatePosition()
        sourceEl.addEventListener('scroll', handleScroll, { passive: true })
        targetEl.addEventListener('wheel', handleWheel, { passive: false })
        if (targetEl.parentElement) {
          targetEl.parentElement.addEventListener('wheel', handleWheel, { passive: false })
        }
      }
    },
    { immediate: true, flush: 'post' }
  )

  onBeforeUnmount(cleanup)
}
