import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from './schema.js'

let _db = null

export function useDb() {
  if (_db) return _db

  const config = useRuntimeConfig()
  const sqlite = new Database(config.databasePath)

  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  _db = drizzle(sqlite, { schema })
  return _db
}
