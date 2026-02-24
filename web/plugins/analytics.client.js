import { usePageAnalytics } from '~/composables/usePageAnalytics'

export default defineNuxtPlugin(() => {
  const analytics = usePageAnalytics()
  return { provide: { analytics } }
})
