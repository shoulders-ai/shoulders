/**
 * Citation formatting — 5 styles as pure functions.
 * No external dependencies.
 */

// --- Helpers ---

function getYear(csl) {
  return csl.issued?.['date-parts']?.[0]?.[0] || 'n.d.'
}

function getAuthors(csl) {
  return csl.author || []
}

function authorLastFirst(a) {
  if (!a.family) return a.given || ''
  return a.given ? `${a.family}, ${a.given}` : a.family
}

function authorFirstLast(a) {
  if (!a.family) return a.given || ''
  return a.given ? `${a.given} ${a.family}` : a.family
}

function authorLast(a) {
  return a.family || a.given || ''
}

function initials(a) {
  if (!a.given) return ''
  return a.given.split(/[\s-]+/).map(n => n[0] + '.').join(' ')
}

function authorLastInitials(a) {
  return `${a.family || ''}${a.given ? ', ' + initials(a) : ''}`
}

function italicize(text) {
  return `*${text}*`
}

// --- APA 7th Edition ---

function apaAuthors(authors) {
  if (!authors.length) return ''
  if (authors.length === 1) return authorLastInitials(authors[0])
  if (authors.length === 2) {
    return `${authorLastInitials(authors[0])} & ${authorLastInitials(authors[1])}`
  }
  if (authors.length <= 20) {
    const allButLast = authors.slice(0, -1).map(authorLastInitials).join(', ')
    return `${allButLast}, & ${authorLastInitials(authors[authors.length - 1])}`
  }
  const first19 = authors.slice(0, 19).map(authorLastInitials).join(', ')
  return `${first19}, ... ${authorLastInitials(authors[authors.length - 1])}`
}

function apaReference(csl) {
  const parts = []
  parts.push(apaAuthors(getAuthors(csl)))
  parts.push(`(${getYear(csl)}).`)
  parts.push(csl.title + '.')
  if (csl['container-title']) {
    parts.push(italicize(csl['container-title']) + ',')
    const vol = csl.volume ? italicize(csl.volume) : ''
    const issue = csl.issue ? `(${csl.issue})` : ''
    if (vol || issue) parts.push(`${vol}${issue}${csl.page ? ', ' + csl.page : ''}.`)
    else if (csl.page) parts.push(csl.page + '.')
  } else if (csl.publisher) {
    parts.push(csl.publisher + '.')
  }
  if (csl.DOI) parts.push(`https://doi.org/${csl.DOI}`)
  return parts.join(' ')
}

function apaInline(csl) {
  const authors = getAuthors(csl)
  const year = getYear(csl)
  if (authors.length === 0) return `(${year})`
  if (authors.length === 1) return `(${authorLast(authors[0])}, ${year})`
  if (authors.length === 2) return `(${authorLast(authors[0])} & ${authorLast(authors[1])}, ${year})`
  return `(${authorLast(authors[0])} et al., ${year})`
}

// --- Chicago Author-Date ---

function chicagoAuthors(authors) {
  if (!authors.length) return ''
  if (authors.length === 1) return authorLastFirst(authors[0])
  if (authors.length === 2) {
    return `${authorLastFirst(authors[0])} and ${authorFirstLast(authors[1])}`
  }
  if (authors.length === 3) {
    return `${authorLastFirst(authors[0])}, ${authorFirstLast(authors[1])}, and ${authorFirstLast(authors[2])}`
  }
  return `${authorLastFirst(authors[0])} et al.`
}

function chicagoReference(csl) {
  const parts = []
  parts.push(chicagoAuthors(getAuthors(csl)) + '.')
  parts.push(getYear(csl) + '.')
  parts.push(`"${csl.title}."`)
  if (csl['container-title']) {
    parts.push(italicize(csl['container-title']))
    const extras = []
    if (csl.volume) extras.push(csl.volume)
    if (csl.issue) extras.push(`no. ${csl.issue}`)
    if (extras.length) parts.push(extras.join(', '))
    if (csl.page) parts.push(`: ${csl.page}.`)
    else parts.push('.')
  } else if (csl.publisher) {
    parts.push(csl.publisher + '.')
  }
  if (csl.DOI) parts.push(`https://doi.org/${csl.DOI}.`)
  return parts.join(' ')
}

function chicagoInline(csl) {
  const authors = getAuthors(csl)
  const year = getYear(csl)
  if (authors.length === 0) return `(${year})`
  if (authors.length <= 3) {
    const names = authors.map(authorLast)
    if (names.length === 2) return `(${names[0]} and ${names[1]} ${year})`
    return `(${names.join(', ')} ${year})`
  }
  return `(${authorLast(authors[0])} et al. ${year})`
}

// --- IEEE ---

function ieeeReference(csl, num) {
  const parts = []
  const prefix = num !== undefined ? `[${num}] ` : ''
  const authors = getAuthors(csl)

  if (authors.length > 0) {
    const names = authors.map(a => `${initials(a)} ${a.family || ''}`).join(', ')
    parts.push(names + ',')
  }

  parts.push(`"${csl.title},"`)

  if (csl['container-title']) {
    parts.push(italicize(csl['container-title']) + ',')
    if (csl.volume) parts.push(`vol. ${csl.volume},`)
    if (csl.issue) parts.push(`no. ${csl.issue},`)
    if (csl.page) parts.push(`pp. ${csl.page},`)
  } else if (csl.publisher) {
    parts.push(csl.publisher + ',')
  }

  parts.push(getYear(csl) + '.')
  if (csl.DOI) parts.push(`doi: ${csl.DOI}.`)

  return prefix + parts.join(' ')
}

function ieeeInline(csl, num) {
  return num !== undefined ? `[${num}]` : '[?]'
}

// --- Harvard ---

function harvardReference(csl) {
  const parts = []
  const authors = getAuthors(csl)

  if (authors.length > 0) {
    if (authors.length <= 3) {
      parts.push(authors.map(authorLastFirst).join(', '))
    } else {
      parts.push(authorLastFirst(authors[0]) + ' et al.')
    }
  }

  parts.push(`(${getYear(csl)})`)
  parts.push(`'${csl.title}',`)

  if (csl['container-title']) {
    parts.push(italicize(csl['container-title']) + ',')
    if (csl.volume) parts.push(`${csl.volume}${csl.issue ? '(' + csl.issue + ')' : ''},`)
    if (csl.page) parts.push(`pp. ${csl.page}.`)
  } else if (csl.publisher) {
    parts.push(csl.publisher + '.')
  }

  if (csl.DOI) parts.push(`doi: ${csl.DOI}.`)
  return parts.join(' ')
}

function harvardInline(csl) {
  return apaInline(csl) // Same parenthetical format
}

// --- Vancouver ---

function vancouverReference(csl, num) {
  const parts = []
  const prefix = num !== undefined ? `${num}. ` : ''
  const authors = getAuthors(csl)

  if (authors.length > 0) {
    const names = authors.slice(0, 6).map(a => {
      const given = a.given ? a.given.split(/[\s-]+/).map(n => n[0]).join('') : ''
      return `${a.family || ''} ${given}`
    })
    if (authors.length > 6) names.push('et al')
    parts.push(names.join(', ') + '.')
  }

  parts.push(csl.title + '.')

  if (csl['container-title']) {
    parts.push(csl['container-title'] + '.')
    parts.push(`${getYear(csl)}`)
    const extras = []
    if (csl.volume) extras.push(csl.volume)
    if (csl.issue) extras.push(`(${csl.issue})`)
    if (csl.page) extras.push(`:${csl.page}`)
    if (extras.length) parts.push(extras.join('') + '.')
  } else {
    parts.push(getYear(csl) + '.')
  }

  return prefix + parts.join(' ')
}

function vancouverInline(csl, num) {
  return num !== undefined ? `(${num})` : '(?)'
}

// --- Rich reference formatters (return [{text, italic}] segments) ---

function seg(text, italic = false) { return { text, italic } }

function apaReferenceRich(csl) {
  const segs = []
  segs.push(seg(apaAuthors(getAuthors(csl)) + ' '))
  segs.push(seg(`(${getYear(csl)}). `))
  segs.push(seg((csl.title || '') + '. '))
  if (csl['container-title']) {
    segs.push(seg(csl['container-title'], true))
    const vol = csl.volume || ''
    const issue = csl.issue ? `(${csl.issue})` : ''
    if (vol || issue) {
      segs.push(seg(', '))
      if (vol) segs.push(seg(vol, true))
      segs.push(seg(issue))
      if (csl.page) segs.push(seg(`, ${csl.page}`))
      segs.push(seg('. '))
    } else {
      if (csl.page) segs.push(seg(`, ${csl.page}`))
      segs.push(seg('. '))
    }
  } else if (csl.publisher) {
    segs.push(seg(csl.publisher + '. '))
  }
  if (csl.DOI) segs.push(seg(`https://doi.org/${csl.DOI}`))
  return segs
}

function chicagoReferenceRich(csl) {
  const segs = []
  segs.push(seg(chicagoAuthors(getAuthors(csl)) + '. '))
  segs.push(seg(getYear(csl) + '. '))
  segs.push(seg(`\u201C${csl.title || ''}.\u201D `))
  if (csl['container-title']) {
    segs.push(seg(csl['container-title'], true))
    const extras = []
    if (csl.volume) extras.push(csl.volume)
    if (csl.issue) extras.push(`no. ${csl.issue}`)
    if (extras.length) segs.push(seg(' ' + extras.join(', ')))
    if (csl.page) segs.push(seg(`: ${csl.page}.`))
    else segs.push(seg('.'))
    segs.push(seg(' '))
  } else if (csl.publisher) {
    segs.push(seg(csl.publisher + '. '))
  }
  if (csl.DOI) segs.push(seg(`https://doi.org/${csl.DOI}.`))
  return segs
}

function ieeeReferenceRich(csl, num) {
  const segs = []
  if (num !== undefined) segs.push(seg(`[${num}] `))
  const authors = getAuthors(csl)
  if (authors.length > 0) {
    const names = authors.map(a => `${initials(a)} ${a.family || ''}`).join(', ')
    segs.push(seg(names + ', '))
  }
  segs.push(seg(`\u201C${csl.title || ''},\u201D `))
  if (csl['container-title']) {
    segs.push(seg(csl['container-title'], true))
    segs.push(seg(', '))
    if (csl.volume) segs.push(seg(`vol. ${csl.volume}, `))
    if (csl.issue) segs.push(seg(`no. ${csl.issue}, `))
    if (csl.page) segs.push(seg(`pp. ${csl.page}, `))
  } else if (csl.publisher) {
    segs.push(seg(csl.publisher + ', '))
  }
  segs.push(seg(getYear(csl) + '.'))
  if (csl.DOI) segs.push(seg(` doi: ${csl.DOI}.`))
  return segs
}

function harvardReferenceRich(csl) {
  const segs = []
  const authors = getAuthors(csl)
  if (authors.length > 0) {
    if (authors.length <= 3) {
      segs.push(seg(authors.map(authorLastFirst).join(', ') + ' '))
    } else {
      segs.push(seg(authorLastFirst(authors[0]) + ' et al. '))
    }
  }
  segs.push(seg(`(${getYear(csl)}) `))
  segs.push(seg(`\u2018${csl.title || ''}\u2019, `))
  if (csl['container-title']) {
    segs.push(seg(csl['container-title'], true))
    segs.push(seg(', '))
    if (csl.volume) segs.push(seg(`${csl.volume}${csl.issue ? '(' + csl.issue + ')' : ''}, `))
    if (csl.page) segs.push(seg(`pp. ${csl.page}.`))
  } else if (csl.publisher) {
    segs.push(seg(csl.publisher + '.'))
  }
  if (csl.DOI) segs.push(seg(` doi: ${csl.DOI}.`))
  return segs
}

function vancouverReferenceRich(csl, num) {
  const segs = []
  if (num !== undefined) segs.push(seg(`${num}. `))
  const authors = getAuthors(csl)
  if (authors.length > 0) {
    const names = authors.slice(0, 6).map(a => {
      const given = a.given ? a.given.split(/[\s-]+/).map(n => n[0]).join('') : ''
      return `${a.family || ''} ${given}`
    })
    if (authors.length > 6) names.push('et al')
    segs.push(seg(names.join(', ') + '. '))
  }
  segs.push(seg((csl.title || '') + '. '))
  if (csl['container-title']) {
    segs.push(seg(csl['container-title'] + '. ', false)) // Vancouver doesn't italicize
    segs.push(seg(`${getYear(csl)}`))
    const extras = []
    if (csl.volume) extras.push(csl.volume)
    if (csl.issue) extras.push(`(${csl.issue})`)
    if (csl.page) extras.push(`:${csl.page}`)
    if (extras.length) segs.push(seg(extras.join('') + '.'))
  } else {
    segs.push(seg(getYear(csl) + '.'))
  }
  return segs
}

const richStyles = {
  apa: apaReferenceRich,
  chicago: chicagoReferenceRich,
  ieee: ieeeReferenceRich,
  harvard: harvardReferenceRich,
  vancouver: vancouverReferenceRich,
}

// --- Public API ---

const styles = {
  apa: { reference: apaReference, inline: apaInline },
  chicago: { reference: chicagoReference, inline: chicagoInline },
  ieee: { reference: ieeeReference, inline: ieeeInline },
  harvard: { reference: harvardReference, inline: harvardInline },
  vancouver: { reference: vancouverReference, inline: vancouverInline },
}

/**
 * Format a single reference as a bibliography entry.
 */
export function formatReference(cslJson, style = 'apa', num) {
  const formatter = styles[style] || styles.apa
  return formatter.reference(cslJson, num)
}

/**
 * Format a single inline/parenthetical citation.
 */
export function formatInlineCitation(cslJson, style = 'apa', num) {
  const formatter = styles[style] || styles.apa
  return formatter.inline(cslJson, num)
}

/**
 * Format a single reference as rich segments: [{ text: string, italic: boolean }, ...]
 * Used by DOCX bibliography builder for real italic marks instead of *asterisks*.
 */
export function formatReferenceRich(cslJson, style = 'apa', num) {
  const formatter = richStyles[style] || richStyles.apa
  return formatter(cslJson, num)
}

/**
 * Format a full bibliography from an array of CSL-JSON objects.
 */
export function formatBibliography(cslArray, style = 'apa') {
  const isNumbered = style === 'ieee' || style === 'vancouver'

  if (isNumbered) {
    return cslArray.map((csl, i) => formatReference(csl, style, i + 1)).join('\n')
  }

  // Author-date styles: sort alphabetically by first author
  const sorted = [...cslArray].sort((a, b) => {
    const aAuth = a.author?.[0]?.family || ''
    const bAuth = b.author?.[0]?.family || ''
    if (aAuth !== bAuth) return aAuth.localeCompare(bAuth)
    const aYear = getYear(a)
    const bYear = getYear(b)
    return String(aYear).localeCompare(String(bYear))
  })

  return sorted.map(csl => formatReference(csl, style)).join('\n\n')
}
