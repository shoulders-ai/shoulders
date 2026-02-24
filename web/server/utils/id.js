import { randomBytes } from 'crypto'

export function generateId() {
  return randomBytes(8).toString('hex')
}
