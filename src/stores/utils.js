// Simple ID generator (no external dependency needed)
export function nanoid(size = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let id = ''
  for (let i = 0; i < size; i++) {
    id += chars[Math.floor(Math.random() * chars.length)]
  }
  return id
}
