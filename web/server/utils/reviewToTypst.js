const SEVERITY_COLORS = {
  major: '#dc2626',
  minor: '#d97706',
  suggestion: '#2563eb',
}

function escapeTypst(text) {
  if (!text) return ''
  return text
    .replace(/\\/g, '\\\\')
    .replace(/#/g, '\\#')
    .replace(/\$/g, '\\$')
    .replace(/@/g, '\\@')
    .replace(/</g, '\\<')
    .replace(/>/g, '\\>')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/`/g, '\\`')
    .replace(/"/g, '\\"')
}

function markdownToTypst(md) {
  if (!md) return ''
  return md
    // Escape Typst-special chars that don't conflict with markdown syntax
    .replace(/\\/g, '\\\\')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\$/g, '\\$')
    .replace(/@/g, '\\@')
    .replace(/</g, '\\<')
    .replace(/>/g, '\\>')
    .replace(/`/g, '\\`')
    .replace(/"/g, '\\"')
    // Markdown → Typst conversions
    .replace(/^#{5} (.+)$/gm, '===== $1')
    .replace(/^#{4} (.+)$/gm, '==== $1')
    .replace(/^#{3} (.+)$/gm, '=== $1')
    .replace(/^#{2} (.+)$/gm, '== $1')
    .replace(/^# (.+)$/gm, '= $1')
    .replace(/#/g, '\\#')
    // Bold/italic: use placeholders to avoid collision
    .replace(/\*\*(.+?)\*\*/g, '\x00BOLD\x01$1\x00/BOLD\x01')
    .replace(/\*(.+?)\*/g, '_$1_')
    .replace(/\x00BOLD\x01(.+?)\x00\/BOLD\x01/g, '*$1*')
}

export function reviewToTypst({ report, comments, domainHint, filename }) {
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  // Severity summary
  const counts = { major: 0, minor: 0, suggestion: 0 }
  for (const c of (comments || [])) {
    if (c.severity in counts) counts[c.severity]++
  }
  const summaryParts = []
  if (counts.major) summaryParts.push(`${counts.major} major issue${counts.major !== 1 ? 's' : ''}`)
  if (counts.minor) summaryParts.push(`${counts.minor} minor issue${counts.minor !== 1 ? 's' : ''}`)
  if (counts.suggestion) summaryParts.push(`${counts.suggestion} suggestion${counts.suggestion !== 1 ? 's' : ''}`)
  const summaryLine = summaryParts.join(' · ')

  const filenameShortened = filename.length > 38 ? filename.slice(0, 32) + (filename.length > 32 ? '...' : '') : filename;

  const meta = [filenameShortened, date].filter(Boolean).join('  |  ')

  let typ = `
#set page(
  margin: (x: 3cm, y: 3cm),
  header: align(right, text(size: 8pt, fill: luma(150))[AI Review — Shoulders]),
  footer: align(center, text(size: 8pt, fill: luma(150))[#context counter(page).display("1 / 1", both: true)]),
)
#set text(font: "Open Sans", size: 10.5pt)
#set par(leading: 0.65em, justify: true)
#set heading(numbering: none)
#show heading.where(level: 1): it => { v(0.4em); text(size: 14pt, weight: "bold")[#it.body]; v(0.2em) }
#show heading.where(level: 2): it => { v(0.6em); text(size: 12pt, weight: "bold")[#it.body]; v(0.15em) }
#show heading.where(level: 3): it => { v(0.6em); text(size: 11pt, weight: "bold")[#it.body]; v(0.1em) }

#align(center)[
  #text(font: "Crimson Text", size: 20pt, weight: "bold")[Shoulders AI Review]
  #v(0.5em)
  #text(size: 10pt, fill: luma(100))[${escapeTypst(meta)}]
  #v(0.3em)
  #text(size: 10pt, fill: luma(120))[${escapeTypst(summaryLine)}]
]

#v(1.5em)
#line(length: 100%, stroke: 0.5pt + luma(200))
#v(1.5em)
`

  // Report section
  if (report) {
    typ += markdownToTypst(report)
    typ += '\n\n'
  }

  // Comments section
  if (comments?.length) {
    typ += '#pagebreak()\n\n'
    typ += '= Inline Comments\n\n'
    typ += '#v(0.5em)\n\n'

    // Sort comments by the order they were passed (already sorted by caller)
    for (const c of comments) {
      const color = SEVERITY_COLORS[c.severity] || SEVERITY_COLORS.suggestion
      typ += `#block(
  fill: luma(248),
  inset: (x: 14pt, y: 10pt),
  radius: 3pt,
  width: 100%,
  below: 10pt,
)[
  #text(size: 9pt, weight: "bold", fill: luma(120))[${escapeTypst(String(c.number))}.]
  #text(size: 9pt, weight: "bold", fill: rgb("${color}"))[${escapeTypst(c.severity)}]
  #text(size: 9pt, fill: luma(120))[ — ${escapeTypst(c.reviewer)}]
  #v(4pt)
  #text(size: 9pt, style: "italic", fill: luma(120))[${escapeTypst(`"${c.text_snippet}"`)}]
  #v(4pt)
  #text(size: 10pt)[${escapeTypst(c.content)}]
]\n\n`
    }
  }

  return typ
}
