import { useDb } from '../../../db/index.js'
import { workspaces, workspaceMembers, workspaceInvites } from '../../../db/schema.js'
import { generateId } from '../../../utils/id.js'
import { randomBytes } from 'crypto'
import { execSync } from 'child_process'
import { existsSync, mkdirSync } from 'fs'

function getRepoRoot() {
  const config = useRuntimeConfig()
  return process.env.GIT_REPO_ROOT || config.gitRepoRoot || '/data/repos'
}

function generateInviteToken() {
  return randomBytes(12).toString('hex') // 24-char hex token
}

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const config = useRuntimeConfig()
  const { name } = await readBody(event)

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Workspace name is required' })
  }

  if (name.length > 200) {
    throw createError({ statusCode: 400, statusMessage: 'Workspace name must be 200 characters or fewer' })
  }

  const db = useDb()
  const now = Math.floor(Date.now() / 1000)
  const workspaceId = generateId()
  const inviteToken = generateInviteToken()

  // Create bare git repo on disk
  const repoRoot = getRepoRoot()
  const repoPath = `${repoRoot}/${workspaceId}.git`
  if (!existsSync(repoRoot)) {
    mkdirSync(repoRoot, { recursive: true })
  }
  try {
    execSync(`git init --bare "${repoPath}"`, { stdio: 'pipe' })
    // Enable HTTP push (required for git-http-backend)
    execSync(`git -C "${repoPath}" config http.receivepack true`, { stdio: 'pipe' })
  } catch (e) {
    console.error('[workspaces] Failed to create bare repo:', e.message)
    throw createError({ statusCode: 500, statusMessage: 'Failed to initialize workspace repository' })
  }

  // Create workspace row
  db.insert(workspaces).values({
    id: workspaceId,
    name: name.trim(),
    ownerId: user.id,
    createdAt: now,
    updatedAt: now,
  }).run()

  // Add creator as admin member
  db.insert(workspaceMembers).values({
    id: generateId(),
    workspaceId,
    userId: user.id,
    role: 'admin',
    joinedAt: now,
  }).run()

  // Create default invite
  db.insert(workspaceInvites).values({
    id: generateId(),
    workspaceId,
    token: inviteToken,
    createdBy: user.id,
    createdAt: now,
    expiresAt: null,
  }).run()

  return {
    id: workspaceId,
    name: name.trim(),
    gitUrl: `${config.gitServerUrl}/git/${workspaceId}.git`,
    inviteToken,
  }
})
