export default defineEventHandler((event) => {
  deleteCookie(event, 'admin_session', { path: '/' })
  return { success: true }
})
