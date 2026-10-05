// Nothing counts as done until the live page says so. A post created with
// published status reaches the site on its own in about a minute, with no site
// publish, so this waits rather than assuming.
import { sleep, log } from './lib.mjs'

const UA = { 'User-Agent': 'Mozilla/5.0', 'Cache-Control': 'no-cache' }

export async function verifyLive(site, slug, { tries = 6, gap = 20000 } = {}) {
  const pageUrl = site.siteUrl + site.postPath + slug + '.html'
  for (let i = 1; i <= tries; i++) {
    await sleep(gap)
    const res = await fetch(pageUrl, { headers: UA })
    const html = await res.text()
    const onPage = /blog-external-[\w.-]+/.test(html)
    const listing = await (await fetch(site.siteUrl + site.listingPath, { headers: UA })).text()
    const idx = listing.indexOf(slug)
    const card = idx > -1
    const cardImage = card && /blog-card__thumbnail/.test(listing.slice(Math.max(0, idx - 1800), idx + 300))
    log('verify', 'try ' + i + '  page ' + res.status + '  cover on page ' + onPage + '  on listing ' + card + '  cover on card ' + cardImage)
    if (res.ok && onPage && card && cardImage) return { pageUrl, ok: true }
  }
  return { pageUrl, ok: false }
}
