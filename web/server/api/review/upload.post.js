export default defineEventHandler(() => {
  throw createError({
    statusCode: 410,
    statusMessage: 'AI peer review is no longer available',
  })
})
