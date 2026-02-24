import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const docsDir = path.join(__dirname, '../components/docs')
const outputFile = path.join(__dirname, '../public/search-index.json')

// A mapping of component filenames to their URL section IDs
// We infer this from how the docs.vue router works
const fileToSectionMap = {
  'GettingStarted.vue': 'getting-started',
  'Markdown.vue': 'markdown',
  'WordDocuments.vue': 'word',
  'Latex.vue': 'latex',
  'References.vue': 'references',
  'AiSetup.vue': 'ai-setup',
  'InlineSuggestions.vue': 'inline-suggestions',
  'AiChat.vue': 'ai-chat',
  'AiTasks.vue': 'ai-tasks',
  'AiTools.vue': 'ai-tools',
  'CodeAndNotebooks.vue': 'code',
  'NavigationSettings.vue': 'navigation',
  'KeyboardShortcuts.vue': 'shortcuts',
  'Privacy.vue': 'privacy',
}

function parseVueFile(filePath, filename) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const sectionId = fileToSectionMap[filename]
  
  if (!sectionId) return []

  const templateMatch = content.match(/<template>([\s\S]*?)<\/template>/)
  if (!templateMatch) return []
  let html = templateMatch[1]

  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')

  const blocks = []
  let currentBlock = null
  
  const tagRegex = /<(h[1-3]|p|li|td)[^>]*>([\s\S]*?)<\/\1>/gi
  let match

  while ((match = tagRegex.exec(html)) !== null) {
    const tag = match[1].toLowerCase()
    let text = match[2]

    // Clean up HTML tags inside the text
    text = text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

    // Exclude very short strings, likely formatting artifacts
    if (!text || text.length < 3) continue

    if (tag.startsWith('h')) {
      currentBlock = {
        id: `${sectionId}-${blocks.length}`,
        section: sectionId,
        title: text,
        content: '',
        url: `/docs?section=${sectionId}`
      }
      blocks.push(currentBlock)
    } else {
      if (!currentBlock) {
        currentBlock = {
          id: `${sectionId}-${blocks.length}`,
          section: sectionId,
          title: filename.replace('.vue', ''),
          content: '',
          url: `/docs?section=${sectionId}`
        }
        blocks.push(currentBlock)
      }
      // Append text to the current block's content
      currentBlock.content += (currentBlock.content ? ' ' : '') + text
    }
  }

  return blocks
}

function generateIndex() {
  console.log('Generating search index...')
  let allBlocks = []

  const files = fs.readdirSync(docsDir)
  files.forEach(filename => {
    if (filename.endsWith('.vue')) {
      const filePath = path.join(docsDir, filename)
      const blocks = parseVueFile(filePath, filename)
      allBlocks = allBlocks.concat(blocks)
    }
  })

  const publicDir = path.dirname(outputFile)
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true })
  }

  fs.writeFileSync(outputFile, JSON.stringify(allBlocks, null, 2))
  console.log(`Successfully generated search index with ${allBlocks.length} searchable blocks.`)
  console.log(`Saved to: ${outputFile}`)
}

generateIndex()
