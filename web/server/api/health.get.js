import { useDb } from '../db/index.js'

export default defineEventHandler((event) => {
  try {
    const db = useDb()
    const result = db.$client.prepare('SELECT 1 as ok').get()
    if (result?.ok !== 1) throw new Error('DB check failed')

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    }
  } catch (e) {
    console.error('[health] Check failed:', e)
    setResponseStatus(event, 503)
    return {
      status: 'error',
      message: 'Service unavailable',
    }
  }
})
