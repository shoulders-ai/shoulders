import http from 'http'
import { spawn } from 'child_process'
import { jwtVerify } from 'jose'
import Database from 'better-sqlite3'

// --- Config ---

const PORT = parseInt(process.env.GIT_SERVER_PORT || '3001', 10)
const REPO_ROOT = process.env.GIT_REPO_ROOT || '/data/repos'
const JWT_SECRET = process.env.JWT_SECRET
const DATABASE_PATH = process.env.DATABASE_PATH || '/data/shoulders.db'
const GIT_HTTP_BACKEND = process.env.GIT_HTTP_BACKEND || '/usr/lib/git-core/git-http-backend'

if (!JWT_SECRET) {
  console.error('[git-server] JWT_SECRET is required')
  process.exit(1)
}

const jwtSecret = new TextEncoder().encode(JWT_SECRET)

// --- DB ---

let _db = null
function getDb() {
  if (_db) return _db
  _db = new Database(DATABASE_PATH, { readonly: true })
  _db.pragma('journal_mode = WAL')
  return _db
}

const membershipQuery = () =>
  getDb().prepare(`
    SELECT role FROM workspace_members
    WHERE workspace_id = ? AND user_id = ?
  `)

// --- Auth helpers ---

async function verifyJwt(token) {
  try {
    const { payload } = await jwtVerify(token, jwtSecret)
    return payload.sub // userId
  } catch {
    return null
  }
}

function parseRepoId(pathname) {
  // Expects: /git/{repoId}.git/info/refs  or  /git/{repoId}.git/git-receive-pack etc.
  const match = pathname.match(/^\/git\/([a-f0-9]+)\.git(\/.*)?$/)
  if (!match) return null
  return match[1]
}

function isWriteRequest(pathname, query) {
  // git push sends to git-receive-pack
  if (pathname.endsWith('/git-receive-pack')) return true
  // info/refs?service=git-receive-pack is the push discovery
  if (query && query.includes('service=git-receive-pack')) return true
  return false
}

// --- Request handler ---

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const pathname = url.pathname
  const query = url.search ? url.search.slice(1) : ''

  // Health check
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('ok')
    return
  }

  // Parse repo ID from path
  const repoId = parseRepoId(pathname)
  if (!repoId) {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not found')
    return
  }

  // --- Auth (accepts Bearer token or Basic auth with token as password) ---
  const authHeader = req.headers['authorization']
  let token = null

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7)
  } else if (authHeader && authHeader.startsWith('Basic ')) {
    // git2 sends Basic auth: base64("username:password") where password is the JWT
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString()
    const colonIdx = decoded.indexOf(':')
    if (colonIdx !== -1) token = decoded.slice(colonIdx + 1)
  }

  if (!token) {
    res.writeHead(401, {
      'Content-Type': 'text/plain',
      'WWW-Authenticate': 'Basic realm="Shoulders Git"',
    })
    res.end('Authentication required')
    return
  }
  const userId = await verifyJwt(token)
  if (!userId) {
    res.writeHead(401, { 'Content-Type': 'text/plain' })
    res.end('Invalid or expired token')
    return
  }

  // --- Membership check ---
  const member = membershipQuery().get(repoId, userId)
  if (!member) {
    res.writeHead(403, { 'Content-Type': 'text/plain' })
    res.end('Not a member of this workspace')
    return
  }

  // --- Write permission ---
  if (isWriteRequest(pathname, query)) {
    if (member.role === 'viewer') {
      res.writeHead(403, { 'Content-Type': 'text/plain' })
      res.end('Viewers cannot push to this workspace')
      return
    }
  }

  // --- Spawn git-http-backend ---
  // PATH_INFO must be relative to GIT_PROJECT_ROOT, e.g. /{repoId}.git/info/refs
  const pathInfo = pathname.replace(/^\/git/, '')

  const env = {
    GIT_PROJECT_ROOT: REPO_ROOT,
    GIT_HTTP_EXPORT_ALL: '1',
    REQUEST_METHOD: req.method,
    PATH_INFO: pathInfo,
    QUERY_STRING: query,
    CONTENT_TYPE: req.headers['content-type'] || '',
    CONTENT_LENGTH: req.headers['content-length'] || '',
    REMOTE_USER: userId,
    // Required for git-http-backend to work with HTTP/1.1
    SERVER_PROTOCOL: 'HTTP/1.1',
    SERVER_SOFTWARE: 'shoulders-git-server',
  }

  const cgi = spawn(GIT_HTTP_BACKEND, [], {
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  // Pipe request body to CGI stdin
  req.pipe(cgi.stdin)

  // Parse CGI output: headers separated from body by \r\n\r\n
  let headersParsed = false
  let headerBuffer = Buffer.alloc(0)

  cgi.stdout.on('data', (chunk) => {
    if (headersParsed) {
      res.write(chunk)
      return
    }

    headerBuffer = Buffer.concat([headerBuffer, chunk])
    const headerEnd = headerBuffer.indexOf('\r\n\r\n')
    if (headerEnd === -1) return

    // Parse CGI headers
    headersParsed = true
    const headerStr = headerBuffer.slice(0, headerEnd).toString()
    const body = headerBuffer.slice(headerEnd + 4)

    let statusCode = 200
    const headers = {}

    for (const line of headerStr.split('\r\n')) {
      const colonIdx = line.indexOf(':')
      if (colonIdx === -1) continue
      const key = line.slice(0, colonIdx).trim().toLowerCase()
      const value = line.slice(colonIdx + 1).trim()

      if (key === 'status') {
        statusCode = parseInt(value.split(' ')[0], 10)
      } else {
        headers[key] = value
      }
    }

    res.writeHead(statusCode, headers)
    if (body.length > 0) {
      res.write(body)
    }
  })

  cgi.stderr.on('data', (data) => {
    console.error('[git-http-backend]', data.toString())
  })

  cgi.on('close', (code) => {
    if (!headersParsed) {
      // CGI failed without producing output
      res.writeHead(500, { 'Content-Type': 'text/plain' })
      res.end('Internal server error')
      return
    }
    res.end()
  })

  cgi.on('error', (err) => {
    console.error('[git-server] CGI spawn error:', err)
    if (!headersParsed) {
      res.writeHead(500, { 'Content-Type': 'text/plain' })
      res.end('Internal server error')
    } else {
      res.end()
    }
  })
}

// --- Start server ---

const server = http.createServer(handleRequest)

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[git-server] Listening on 127.0.0.1:${PORT}`)
  console.log(`[git-server] Repo root: ${REPO_ROOT}`)
})
