export default {
  schema: './server/db/schema.js',
  out: './server/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_PATH || './data/shoulders.db',
  },
}
