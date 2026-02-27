import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'

const GUIDANCE_BASE = join(process.cwd(), 'server/services/review/guidance')

function listCategory(category) {
  const dir = join(GUIDANCE_BASE, category)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const content = readFileSync(join(dir, f), 'utf-8')
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
      let name = f.replace('.md', '')
      let id = name
      let appliesTo = ''
      if (frontmatterMatch) {
        const fm = frontmatterMatch[1]
        const nameMatch = fm.match(/^name:\s*(.+)$/m)
        const idMatch = fm.match(/^id:\s*(.+)$/m)
        const appliesMatch = fm.match(/^applies_to:\s*"?(.+?)"?\s*$/m)
        if (nameMatch) name = nameMatch[1].trim()
        if (idMatch) id = idMatch[1].trim()
        if (appliesMatch) appliesTo = appliesMatch[1].trim()
      }
      return { id, name, filename: f, applies_to: appliesTo }
    })
}

function loadChapter(category, chapterId) {
  const dir = join(GUIDANCE_BASE, category)
  if (!existsSync(dir)) return null
  const files = readdirSync(dir).filter(f => f.endsWith('.md'))
  const match = files.find(f => f.includes(chapterId))
  if (!match) return null
  return readFileSync(join(dir, match), 'utf-8')
}

const MAX_GUIDANCE_CHARS = 300_000

export function createGuidanceTool(categories) {
  let loadedChars = 0

  return {
    name: 'getGuidance',
    description: `Load guidance documents for the review. Available categories: ${categories.join(', ')}. First call with action "list" to see available chapters, then "load" to read specific ones.`,
    input_schema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'load'], description: 'list = see available chapters, load = read a specific chapter' },
        category: { type: 'string', enum: categories, description: 'Which guidance category' },
        chapterId: { type: 'string', description: 'Chapter ID to load (required for action=load)' },
      },
      required: ['action', 'category'],
    },
    execute: async ({ action, category, chapterId }) => {
      if (action === 'list') return { chapters: listCategory(category) }
      if (action === 'load' && chapterId) {
        const content = loadChapter(category, chapterId)
        if (!content) return { error: `Chapter "${chapterId}" not found in ${category}` }
        if (loadedChars + content.length > MAX_GUIDANCE_CHARS) {
          console.log(`[GuidanceTool] Budget exceeded: ${loadedChars}/${MAX_GUIDANCE_CHARS} chars, rejected chapter "${chapterId}" (${content.length} chars)`)
          return { error: `Guidance budget exceeded (${loadedChars} of ${MAX_GUIDANCE_CHARS} chars used). You cannot load more chapters — work with the guidance you already have.` }
        }
        loadedChars += content.length
        return { content }
      }
      return { error: 'Invalid action or missing chapterId' }
    },
  }
}
