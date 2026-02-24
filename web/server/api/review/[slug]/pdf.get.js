import { eq } from 'drizzle-orm'
import { execSync } from 'child_process'
import { writeFileSync, readFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { useDb } from '../../../db/index.js'
import { reviews } from '../../../db/schema.js'
import { reviewToTypst } from '../../../utils/reviewToTypst.js'

export default defineEventHandler((event) => {
  const slug = getRouterParam(event, 'slug')
  const db = useDb()

  const review = db.select().from(reviews).where(eq(reviews.slug, slug)).get()

  if (!review) {
    throw createError({ statusCode: 404, statusMessage: 'Review not found' })
  }

  if (review.expiresAt && new Date(review.expiresAt) < new Date()) {
    throw createError({ statusCode: 410, statusMessage: 'This review has expired' })
  }

  if (review.status !== 'complete') {
    throw createError({ statusCode: 400, statusMessage: 'Review not yet complete' })
  }

  let comments = []
  try { comments = JSON.parse(review.commentsJson || '[]') } catch {}

  // Sort comments by mark position in anchored HTML
  if (review.anchoredHtml && comments.length) {
    const markOrder = {}
    const regex = /data-comment-id="([^"]+)"/g
    let match, idx = 0
    while ((match = regex.exec(review.anchoredHtml)) !== null) {
      if (!(match[1] in markOrder)) markOrder[match[1]] = idx++
    }
    comments.sort((a, b) => (markOrder[a.id] ?? Infinity) - (markOrder[b.id] ?? Infinity))
  }

  const typstContent = reviewToTypst({
    report: review.report,
    comments,
    domainHint: review.domainHint,
    filename: review.filename,
  })

  const id = randomUUID()
  const tmpInput = join(tmpdir(), `review-${id}.typ`)
  const tmpOutput = join(tmpdir(), `review-${id}.pdf`)

  try {
    const fontsDir = join(process.cwd(), 'public/fonts')

    writeFileSync(tmpInput, typstContent)
    execSync(`typst compile --font-path "${fontsDir}" "${tmpInput}" "${tmpOutput}"`, { timeout: 15000 })
    const pdf = readFileSync(tmpOutput)

    setResponseHeaders(event, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="peer-review-${slug}.pdf"`,
    })

    return pdf
  } catch (e) {
    console.error('[Review PDF] Typst compilation failed:', e.message)
    throw createError({ statusCode: 500, statusMessage: 'PDF generation failed' })
  } finally {
    try { unlinkSync(tmpInput) } catch {}
    try { unlinkSync(tmpOutput) } catch {}
  }
})
