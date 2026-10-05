// Every rule that has ever cost us a rewrite, checked before anything is posted.
// A failure here stops the run. Nothing is published on a warning.
export async function qa(md, { site, keyword }) {
  const errors = []
  const warn = []
  const title = (md.match(/^# (.+)$/m) || [])[1] || ''
  const body = md.replace(/^# .+$/m, '')
  const words = body.split(/\s+/).filter(Boolean).length
  const h2 = (md.match(/^## /gm) || []).length
  const faqSection = md.split(/^## /m).slice(-1)[0] || ''
  const faqs = (faqSection.match(/^\*\*.+\?\*\*$/gm) || []).length

  if (!title) errors.push('no H1 title')
  if (keyword && !title.toLowerCase().startsWith(keyword.toLowerCase())) {
    errors.push('title does not open with the exact keyword "' + keyword + '"')
  }
  if (words < 1200 || words > 1800) errors.push('word count ' + words + ', must be 1200 to 1800')
  if (h2 < 7 || h2 > 11) warn.push('H2 count ' + h2 + ', expected 7 to 11 including the FAQ heading')
  if (faqs < 5 || faqs > 7) errors.push('FAQ count ' + faqs + ', must be 5 to 7')
  if (!/^> \*\*Quick answer\*\*$/m.test(md)) errors.push('no Quick answer block')

  const emDashes = (md.match(/[—–]/g) || []).length
  if (emDashes) errors.push(emDashes + ' em or en dashes, none are allowed')

  const gov = md.match(/https?:\/\/[^\s)]*\.gov\b[^\s)]*/g) || []
  if (gov.length) errors.push('government links are banned: ' + gov.join(', '))

  const rawCta = md.search(/<https?:\/\/[^>]+>/)
  if (rawCta === -1) errors.push('no raw CTA url in angle brackets')
  else if (rawCta / md.length > 0.6) errors.push('offering appears at ' + Math.round((rawCta / md.length) * 100) + '%, must be before 60%')

  if (!md.includes(site.cta.url)) errors.push('the site CTA url ' + site.cta.url + ' does not appear')

  const links = [...md.matchAll(/\((https?:\/\/[^)\s]+)\)|<(https?:\/\/[^>]+)>/g)].map(m => m[1] || m[2])
  const seen = new Set()
  for (const u of links) {
    if (seen.has(u)) continue
    seen.add(u)
    // A single failed fetch is usually the network, not a dead link, so try
    // three times before calling it broken.
    let status = null
    let lastErr = ''
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } })
        status = r.status
        if (r.ok) break
      } catch (e) {
        lastErr = e.message.slice(0, 60)
      }
      if (attempt < 3) await new Promise(r => setTimeout(r, 3000))
    }
    if (status === null) errors.push('unreachable link ' + u + ' ' + lastErr)
    else if (status >= 400) errors.push('dead link ' + status + ' ' + u)
  }

  return { title, words, h2, faqs, links: seen.size, errors, warn }
}
