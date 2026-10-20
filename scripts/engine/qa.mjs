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
  // Version 13 of the master prompt asks for the questions as H3 headings,
  // the engine's own rule asks for bold lines. Either is a question.
  const faqs = (faqSection.match(/^(\*\*.+\?\*\*|### .+\?)\s*$/gm) || []).length

  if (!title) errors.push('no H1 title')
  // The keyword has to be in the title, in English. DataForSEO hands back
  // stripped forms like "what are sales funnel", and demanding that string
  // verbatim produced an ungrammatical headline. So the test is on the words,
  // allowing a plural, an article and the verb between them, and in any order:
  // the topic is "invoice simple" but the headline is "Simple Invoice".
  //
  // It used to have to open the title as well, followed by a colon and a verb.
  // On 20 October 2026 David called the result "a POOR TITLE ... nobody cares",
  // and his own master prompt only asks for the keyword to appear naturally next
  // to a reason to care. Forcing it to the front is what made every title read
  // "Keyword: Verb Something", so the position is no longer checked.
  const filler = new Set(['a', 'an', 'the', 'is', 'are', 'was', 'were', 'do', 'does'])
  const norm = s => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
    .map(w => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w))
  // The words have to sit together, though. "Why Your Marketing Keeps
  // Stalling, and the Plan That Fixes It" holds both words of "marketing plan"
  // and is not a title about a marketing plan. Two extra words of slack covers
  // an article and a verb. The question words of "how to get more customers"
  // are not required, "Get More Customers" is the search.
  const optional = new Set([...filler, 'how', 'what', 'why', 'when', 'where', 'which', 'who', 'to'])
  const wanted = [...new Set(norm(keyword || '').filter(w => !optional.has(w)))]
  const titleWords = norm(title)
  let hasKeyword = false
  for (let i = 0; i < titleWords.length && wanted.length && !hasKeyword; i++) {
    const near = new Set(titleWords.slice(i, i + wanted.length + 2))
    hasKeyword = wanted.every(w => near.has(w))
  }
  if (keyword && !hasKeyword) {
    errors.push('title does not carry the keyword "' + keyword + '" with its words together, the title is "' + title + '"')
  }
  if (title.length > 75) warn.push('title is ' + title.length + ' characters, aim for under 70')
  if (words < 1200 || words > 1800) errors.push('word count ' + words + ', must be 1200 to 1800')
  if (h2 < 7 || h2 > 11) warn.push('H2 count ' + h2 + ', expected 7 to 11 including the FAQ heading')
  if (faqs < 5 || faqs > 7) errors.push('FAQ count ' + faqs + ', must be 5 to 7')
  if (!/^> \*\*Quick answer\*\*$/m.test(md)) errors.push('no Quick answer block')

  const emDashes = (md.match(/[—–]/g) || []).length
  if (emDashes) errors.push(emDashes + ' em or en dashes, none are allowed')

  const gov = md.match(/https?:\/\/[^\s)]*\.gov\b[^\s)]*/g) || []
  if (gov.length) errors.push('government links are banned: ' + gov.join(', '))

  // The CTA used to be demanded as a bare url in angle brackets, which is how it
  // was easy to find. Markdown renders that as the address itself, so the live
  // article carried "https://ideolab.ai/TrialBuild" in the middle of a sentence
  // while an older hand written one carried the offer's name. Now it has to be a
  // real link, and a printed address is an error rather than the requirement.
  const ctaAt = md.indexOf('](' + site.cta.url + ')')
  if (ctaAt === -1) errors.push('the offering is not a markdown link to ' + site.cta.url)
  else if (ctaAt / md.length > 0.6) errors.push('offering appears at ' + Math.round((ctaAt / md.length) * 100) + '%, must be before 60%')

  const bare = md.match(/<https?:\/\/[^>]+>/g) || []
  if (bare.length) errors.push(bare.length + ' url(s) printed as text in angle brackets, every url belongs inside a markdown link: ' + bare.join(', '))

  if (!md.includes(site.cta.url)) errors.push('the site CTA url ' + site.cta.url + ' does not appear')

  // Shahzaib asked for the paid order forms to be used, not only the trial.
  // One of them, whichever fits the article, and only one.
  const plans = site.cta.plans || []
  if (plans.length) {
    const used = plans.filter(p => md.includes(p.url))
    if (!used.length) errors.push('no paid plan link, expected one of ' + plans.map(p => p.url).join(' or '))
    if (used.length > 1) errors.push('both paid plan links appear, the article should name one: ' + used.map(p => p.url).join(', '))
    for (const p of used) {
      if (!md.includes('](' + p.url + ')')) errors.push('the ' + p.name + ' url is printed rather than linked, write it as [' + p.name + ' is ' + p.price + '](' + p.url + ')')
    }
  }

  // An older article on IdeoLab told readers a plan came with 2,500 credits and
  // another with 10,000. Neither figure appears in any knowledge file, so the
  // model made them up and they went live on the client's site.
  const credits = md.match(/[\d,]+\s+credits/gi) || []
  if (credits.length) errors.push('credit counts are not in the knowledge files and must not be stated: ' + credits.join(', '))

  const links = [...md.matchAll(/\((https?:\/\/[^)\s]+)\)|<(https?:\/\/[^>]+)>/g)].map(m => m[1] || m[2])
  const seen = new Set()
  for (const u of links) {
    if (seen.has(u)) continue
    seen.add(u)
    // A single failed fetch is usually the network, not a dead link, so try
    // three times before calling it broken.
    let status = null
    let lastErr = ''
    let gone = false
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } })
        status = r.status
        // An unpublished post answers 200 with a "This post is no longer
        // available" page, so the status alone passed it. Read the body.
        if (r.ok) { gone = /This post is no longer available/i.test(await r.text()); break }
      } catch (e) {
        lastErr = e.message.slice(0, 60)
      }
      if (attempt < 3) await new Promise(r => setTimeout(r, 3000))
    }
    if (status === null) errors.push('unreachable link ' + u + ' ' + lastErr)
    else if (status >= 400) errors.push('dead link ' + status + ' ' + u)
    else if (gone) errors.push('dead link, the post is no longer available ' + u)
  }

  return { title, words, h2, faqs, links: seen.size, errors, warn }
}
