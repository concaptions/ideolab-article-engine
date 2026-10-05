// Keyword selection. Volumes come from DataForSEO, nothing is assumed.
// A seed is only returned if it has a real volume and the site does not already
// have a post whose slug starts with that keyword.
import { env, api, log } from './lib.mjs'

export async function volumes(keywords) {
  const auth = 'Basic ' + Buffer.from(env('DATAFORSEO_LOGIN') + ':' + env('DATAFORSEO_PASSWORD')).toString('base64')
  const res = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live', {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify([{ keywords, location_code: 2840, language_code: 'en' }]),
  })
  const j = await res.json()
  if (j.status_code !== 20000) throw new Error('DataForSEO ' + j.status_code + ' ' + j.status_message)
  return (j.tasks?.[0]?.result || []).map(r => ({
    keyword: r.keyword,
    volume: r.search_volume ?? 0,
    competition: r.competition || 'UNKNOWN',
  }))
}

export async function existingPosts(site) {
  const j = await api(site, '/blog/posts?limit=100')
  return (j.posts || j).map(p => ({ slug: p.slug, title: p.title, status: p.status }))
}

// Rank by volume, drop anything already covered, prefer LOW competition.
export async function pickKeyword(site) {
  const taken = (await existingPosts(site)).map(p => p.slug)
  const rows = await volumes(site.keywordSeeds)
  const score = r => r.volume * (r.competition === 'LOW' ? 1.5 : r.competition === 'MEDIUM' ? 1 : 0.5)
  const open = rows
    .filter(r => r.volume > 0)
    .filter(r => !taken.some(s => s.startsWith(r.keyword.replace(/\s+/g, '-'))))
    .sort((a, b) => score(b) - score(a))
  if (!open.length) throw new Error('No seed keyword left for ' + site.name + '. Add more to sites/' + site.key + '.json')
  log('keyword', open[0].keyword + '  ' + open[0].volume + '/mo  ' + open[0].competition)
  return open[0]
}
