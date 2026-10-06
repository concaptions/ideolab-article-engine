// Keyword selection.
//
// The old version scored a hand written list by ad competition, which is a
// price signal for advertisers and says nothing about how hard a term is to
// rank for. It picked "pitch deck" on 5 October 2026, a term with a keyword
// difficulty of 40 and transactional intent, which is the wrong article for
// this blog to write.
//
// This version discovers its own candidates from DataForSEO Labs and keeps only
// what a blog can realistically win: informational intent, difficulty under the
// site's ceiling, real volume, and a trend that is not falling away.
//
// 6 October 2026. The first live pool came back with 2431 candidates and the
// top of it was unusable. DataForSEO hands back every permutation of a head
// term, "infographic about infographics", "mind to map", "map of the mind",
// and every unrelated page that happens to rank for one, "h&r block case study
// answers", "case study of vanitas", "vsp press release". All of them carry
// the head term's volume, so sorting by volume floats the junk to the top.
// relevant() is the gate that keeps them out.
import fs from 'node:fs'
import path from 'node:path'
import { env, api, log, ROOT } from './lib.mjs'

const LABS = 'https://api.dataforseo.com/v3/dataforseo_labs/google/'
const POOL_DAYS = 7
const MAX_WORDS = 6

// The only words allowed to stand beside the topic phrase. Every one of them is
// a generic article angle. A word that is not here is a brand, a company, a
// person or an unrelated subject, and a keyword carrying one is not an article
// this blog has any business writing.
const MODIFIERS = new Set([
  'a', 'an', 'the', 'and', 'or', 'for', 'of', 'in', 'on', 'to', 'with', 'without', 'your', 'you', 'my', 'our',
  'how', 'what', 'why', 'when', 'where', 'which', 'who', 'is', 'are', 'do', 'does', 'can', 'should', 'need',
  'best', 'good', 'great', 'simple', 'easy', 'quick', 'fast', 'short', 'long', 'modern', 'creative',
  'professional', 'clean', 'effective',
  'example', 'examples', 'sample', 'samples', 'template', 'templates', 'format', 'formats', 'layout', 'layouts',
  'guide', 'guides', 'tip', 'tips', 'idea', 'ideas', 'step', 'steps', 'checklist', 'outline', 'outlines', 'structure',
  'write', 'writing', 'writer', 'create', 'creating', 'make', 'making', 'build', 'building', 'design', 'designing',
  'generator', 'maker', 'builder', 'tool', 'tools', 'software', 'platform', 'app', 'apps', 'automation', 'automated', 'ai',
  'business', 'businesses', 'company', 'companies', 'startup', 'startups', 'agency', 'agencies', 'brand',
  'client', 'clients', 'customer', 'customers', 'owner', 'owners', 'team', 'small', 'local',
  'type', 'types', 'kind', 'kinds', 'vs', 'versus', 'difference', 'differences',
  'benefit', 'benefits', 'advantage', 'advantages',
  'use', 'using', 'used', 'start', 'starting', 'started', 'beginner', 'beginners', 'basic', 'basics', 'introduction',
  'free', 'online', 'digital',
])

function auth() {
  return 'Basic ' + Buffer.from(env('DATAFORSEO_LOGIN') + ':' + env('DATAFORSEO_PASSWORD')).toString('base64')
}

async function labs(endpoint, body) {
  const res = await fetch(LABS + endpoint, {
    method: 'POST',
    headers: { Authorization: auth(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const j = await res.json()
  if (j.status_code !== 20000) throw new Error('DataForSEO ' + j.status_code + ' ' + j.status_message)
  const task = j.tasks?.[0]
  if (task?.status_code !== 20000) throw new Error('DataForSEO task ' + task?.status_code + ' ' + task?.status_message)
  return { items: task.result?.[0]?.items || [], cost: j.cost }
}

export async function existingPosts(site) {
  const j = await api(site, '/blog/posts?limit=100')
  return (j.posts || j).map(p => ({ slug: p.slug, title: p.title, status: p.status }))
}

// Twelve months of volume come back with every suggestion. Compare the last
// three against the three before them, so a term on the way down is visible.
function trendPercent(info) {
  const months = info?.monthly_searches || []
  if (months.length < 6) return 0
  const recent = months.slice(0, 3).reduce((a, m) => a + (m.search_volume || 0), 0)
  const before = months.slice(3, 6).reduce((a, m) => a + (m.search_volume || 0), 0)
  if (!before) return 0
  return Math.round(((recent - before) / before) * 100)
}

function words(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9&]+/g, ' ').trim().split(/\s+/).filter(Boolean)
}

// Crude on purpose. It only has to make "infographic" and "infographics" the
// same word, so a keyword that says one of them twice is caught.
function stem(w) {
  return w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w
}

// "pitch deck", "pitch-deck" and "deck pitch" are one keyword with three
// spellings. Collapse them so the pool is not nine versions of one idea.
function shape(keyword) {
  return [...new Set(words(keyword).map(stem))].sort().join(' ')
}

// A keyword may not open or close on a bare connective. These are the words
// Google's own suggestion list leaves dangling, as in "mind map a", which is
// not a phrase anybody types on purpose.
const CONNECTIVES = new Set([
  'a', 'an', 'the', 'and', 'or', 'for', 'of', 'in', 'on', 'to', 'with', 'without',
  'is', 'are', 'do', 'does', 'your', 'you', 'my', 'our', 'can', 'should',
])

const QUESTIONS = new Set(['how', 'what', 'why', 'when', 'where', 'which', 'who'])

// English puts the adjective in front of the noun. DataForSEO reports both
// orders, so "invoice simple" and "simple invoice" arrive together and the
// wrong one was leading the article.
const ADJECTIVES = new Set([
  'simple', 'free', 'easy', 'quick', 'fast', 'short', 'long', 'best', 'good', 'great',
  'modern', 'creative', 'professional', 'clean', 'effective', 'digital', 'online', 'small', 'local',
])

// Five tests, and a keyword has to pass all five.
//
// 1. It may not open or close on a bare connective.
// 2. The topic has to appear as a contiguous phrase. "map of the mind" carries
//    the volume of "mind map" without being it.
// 3. No word may repeat. That is all "infographic about infographics" and
//    "mind map of mind map" are, and neither is ever a title.
// 4. Every word outside the topic phrase has to be a generic article angle.
//    This is the test that drops "h&r block", "vanitas" and "vsp".
function relevant(keyword, topic) {
  const k = words(keyword)
  if (!k.length || k.length > MAX_WORDS) return false
  if (CONNECTIVES.has(k[0]) || CONNECTIVES.has(k[k.length - 1])) return false

  const t = words(topic).map(stem)
  const ks = k.map(stem)
  let at = -1
  for (let i = 0; i + t.length <= ks.length; i++) {
    if (t.every((w, j) => ks[i + j] === w)) { at = i; break }
  }
  if (at === -1) return false

  // The title has to open on the subject or on a question. "what is ai
  // training" reads; "tools of project management" and "format for meeting
  // notes" are the same searches with the noun phrase turned inside out, and
  // the house rule puts the exact keyword at the front of the title, so an
  // inverted keyword becomes an inverted headline.
  //
  // Letting anything else through was tried on 6 October: allowing a
  // preposition free prefix so "simple invoice" could lead, which also let in
  // "what invoice" and "what are sales funnel". The ordering rule in awkward()
  // fixes the adjective case without opening the gate.
  if (at !== 0 && !QUESTIONS.has(k[0])) return false

  if (new Set(ks).size !== ks.length) return false

  for (let i = 0; i < k.length; i++) {
    if (i >= at && i < at + t.length) continue
    if (!MODIFIERS.has(k[i])) return false
  }
  return true
}

// A candidate survives if it reads as an article about any topic this site
// covers. Testing every topic rather than the one it was discovered under also
// cleans a pool that was cached before this gate existed.
function onTopic(site, keyword) {
  return (site.topics || []).some(t => relevant(keyword, t))
}

function toCandidate(item) {
  const info = item.keyword_info || {}
  const props = item.keyword_properties || {}
  return {
    keyword: item.keyword,
    volume: info.search_volume || 0,
    difficulty: props.keyword_difficulty ?? null,
    intent: item.search_intent_info?.main_intent || 'unknown',
    trend: trendPercent(info),
    core: props.core_keyword || shape(item.keyword),
  }
}

// One call per topic, cached for a week. A daily run costs nothing extra, and
// the pool still refreshes often enough to catch a term that is rising.
async function buildPool(site) {
  const pool = []
  let spent = 0
  for (const topic of site.topics) {
    const { items, cost } = await labs('keyword_suggestions/live', [{
      keyword: topic,
      location_code: site.locationCode ?? 2840,
      language_code: site.languageCode ?? 'en',
      limit: 200,
      include_serp_info: false,
      order_by: ['keyword_info.search_volume,desc'],
      filters: [['keyword_info.search_volume', '>', site.seo?.minVolume ?? 200]],
    }])
    spent += cost || 0
    pool.push(...items.map(toCandidate))
    log('keyword', 'topic "' + topic + '"  ' + items.length + ' candidates')
  }
  log('keyword', 'pool built, ' + pool.length + ' raw candidates, cost $' + spent.toFixed(3))
  return pool
}

function poolFile(site) {
  return path.join(ROOT, 'memory/autopilot/keyword-pool-' + site.key + '.json')
}

async function loadPool(site, { now, refresh = false }) {
  const file = poolFile(site)
  if (!refresh && fs.existsSync(file)) {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'))
    const ageDays = (now - Date.parse(saved.builtAt)) / 86400000
    if (ageDays < POOL_DAYS) {
      log('keyword', 'using the saved pool, ' + saved.candidates.length + ' candidates, ' + ageDays.toFixed(1) + ' days old')
      return saved.candidates
    }
    log('keyword', 'the saved pool is ' + ageDays.toFixed(1) + ' days old, rebuilding')
  }
  const candidates = await buildPool(site)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify({ builtAt: new Date(now).toISOString(), topics: site.topics, candidates }, null, 2) + '\n')
  return candidates
}

// Group the variants of one idea. The shortest spelling leads the article,
// because "infographic examples" is a title and "examples of a infographic" is
// the same search typed badly. The rest are there for the writer to use
// naturally in the body.
// DataForSEO's own core_keyword splits things it should not. It filed
// "meeting notes templates" and "format for meeting notes" under different
// cores, which would have the engine write the same article twice on two
// different days. Grouping on the words that carry the subject, with the
// generic angle words stripped out, puts them back together.
// Strip the angle words first, stem what is left. Doing it the other way round
// looks up "companie" in a list that holds "companies", so the word survives as
// if it were part of the subject and splits a cluster that should be one.
function subject(keyword) {
  const content = words(keyword).filter(w => !MODIFIERS.has(w)).map(stem)
  return content.length ? [...new Set(content)].sort().join(' ') : shape(keyword)
}

// Where the topic phrase starts. A title leads with its subject, so
// "market research for companies" beats "companies market research", which is
// the same search with the words shuffled and reads like nobody wrote it.
function lead(keyword, topics) {
  const ks = words(keyword).map(stem)
  let best = Infinity
  for (const topic of topics) {
    const t = words(topic).map(stem)
    for (let i = 0; i + t.length <= ks.length; i++) {
      if (t.every((w, j) => ks[i + j] === w)) { if (i < best) best = i; break }
    }
  }
  return best
}

// An adjective sitting after the noun it describes. "invoice simple" is the
// search; "simple invoice" is the sentence, and the title is a sentence.
function awkward(keyword, topics) {
  const at = lead(keyword, topics)
  if (!Number.isFinite(at)) return 0
  return words(keyword).some((w, i) => i > at && ADJECTIVES.has(w)) ? 1 : 0
}

function cluster(candidates, topics = []) {
  const groups = new Map()
  for (const c of candidates) {
    const key = subject(c.keyword)
    const g = groups.get(key) || []
    g.push(c)
    groups.set(key, g)
  }
  return [...groups.values()].map(g => {
    // Lead first, then word order. Putting awkward() first was tried and it
    // promoted "what invoice" over "invoice simple", because a question form
    // carries no adjective to be out of place. Leading with the subject is the
    // stronger rule; the adjective check only breaks ties behind it.
    g.sort((a, b) =>
      lead(a.keyword, topics) - lead(b.keyword, topics) ||
      awkward(a.keyword, topics) - awkward(b.keyword, topics) ||
      words(a.keyword).length - words(b.keyword).length ||
      b.volume - a.volume ||
      (a.difficulty ?? 99) - (b.difficulty ?? 99))
    const head = g[0]
    const seen = new Set([shape(head.keyword)])
    const secondary = []
    for (const c of g.slice(1)) {
      const s = shape(c.keyword)
      if (seen.has(s)) continue
      seen.add(s)
      secondary.push(c.keyword)
      if (secondary.length === 5) break
    }
    return { ...head, secondary, variants: g.length }
  })
}

// Compare on the subject, not the whole keyword. "market research company" and
// "how to do market research" are both the market research article, and the
// site already has one. Matching the full keyword let the modifier "company"
// count as a new idea and would have produced a near duplicate.
function alreadyCovered(head, slugs) {
  const ws = subject(head).split(' ').filter(Boolean)
  if (!ws.length) return false
  return slugs.some(slug => {
    const slugWords = new Set(slug.split('-').map(stem))
    return ws.every(w => slugWords.has(w))
  })
}

export async function pickKeyword(site, { now = Date.now(), refresh = false } = {}) {
  const seo = site.seo || {}
  const maxDifficulty = seo.maxDifficulty ?? 35
  const minVolume = seo.minVolume ?? 200
  const intents = seo.intents ?? ['informational']

  const slugs = (await existingPosts(site)).map(p => p.slug)
  const pool = await loadPool(site, { now, refresh })

  // Relevance first, then the numbers. The old order clustered everything and
  // let the cluster head be whichever variant had the largest volume, so a
  // cluster whose head was too hard was thrown away even when an easier and
  // cleaner spelling of the same idea sat right behind it.
  const onTopicPool = pool.filter(c => onTopic(site, c.keyword))
  log('keyword', pool.length + ' in the pool, ' + onTopicPool.length + ' read as articles about this site')

  const eligible = onTopicPool
    .filter(c => c.volume >= minVolume)
    .filter(c => intents.includes(c.intent))
    .filter(c => c.difficulty !== null && c.difficulty <= maxDifficulty)
    .filter(c => c.trend > -30)

  const kept = cluster(eligible, site.topics || [])
    .filter(c => !alreadyCovered(c.keyword, slugs))
    // Volume carries the ranking, a rising term gets a lift, and difficulty
    // breaks a tie. Nothing here is a guess, every number came from the API.
    .sort((a, b) => (b.volume * (1 + b.trend / 100)) - (a.volume * (1 + a.trend / 100)) || a.difficulty - b.difficulty)

  log('keyword', eligible.length + ' pass intent, difficulty under ' + maxDifficulty + ' and volume over ' + minVolume + ', leaving ' + kept.length + ' ideas not already written')
  if (!kept.length) {
    throw new Error('Nothing left for ' + site.name + '. Add topics to sites/' + site.key + '.json or raise seo.maxDifficulty.')
  }

  const pick = kept[0]
  log('keyword', pick.keyword + '  ' + pick.volume + '/mo  difficulty ' + pick.difficulty + '  ' + pick.intent + '  trend ' + (pick.trend > 0 ? '+' : '') + pick.trend + '%')
  if (pick.secondary.length) log('keyword', 'also covering: ' + pick.secondary.join(', '))
  log('keyword', 'runners up: ' + kept.slice(1, 4).map(c => c.keyword + ' (' + c.volume + ', kd ' + c.difficulty + ')').join('  |  '))
  return pick
}

export const _internals = { relevant, onTopic, words, stem, shape }
