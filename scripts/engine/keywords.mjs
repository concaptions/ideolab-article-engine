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

export async function labs(endpoint, body) {
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
//
// Taking one letter off anything ending in s was not crude, it was wrong.
// "business" came back as "busines" and "businesses" as "businesse", two
// different words, so on 14 October 2026 the engine read "ai tools for
// business" and "ai tools for businesses" as two separate ideas and wrote both,
// an hour apart, under titles that differed by one letter. A word already
// ending in a double s keeps it, and an es plural loses both letters, which
// lands them on the same stem.
function stem(w) {
  if (w.length <= 3) return w
  if (/(?:s|x|z|ch|sh)es$/.test(w)) return w.slice(0, -2)
  if (w.endsWith('ss')) return w
  return w.endsWith('s') ? w.slice(0, -1) : w
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
// Asking once, ordered by volume, never reaches the long tail. Measured on
// 8 October 2026 against "project management": a page of 200 reaches down to a
// volume of 20,000, and raising the page to 1,000 rows costs four times as much
// and still stops at 2,400. Nothing below 200 arrives at any page size, because
// the broad terms fill the page first. So lifting the volume floor in the
// filters did nothing on its own: the small keywords were not being thrown
// away, they were never being bought.
//
// A topic that fills the whole page is the one hiding a tail behind it. For
// those, and only those, a second call asks for the band between 10 and 500 a
// month, which is where the specific phrasings live. The same test returned
// "project management stage gate methodology" at 480 a month. A topic that came
// back with five candidates has no tail and is not asked twice.
const TAIL_LOW = 10
const TAIL_HIGH = 500

async function buildPool(site) {
  const pool = []
  let spent = 0
  let tailCalls = 0
  const limit = site.seo?.poolLimit ?? 200
  const base = {
    location_code: site.locationCode ?? 2840,
    language_code: site.languageCode ?? 'en',
    limit,
    include_serp_info: false,
    order_by: ['keyword_info.search_volume,desc'],
  }

  for (const topic of site.topics) {
    const { items, cost } = await labs('keyword_suggestions/live', [{
      ...base,
      keyword: topic,
      filters: [['keyword_info.search_volume', '>', site.seo?.minVolume ?? 200]],
    }])
    spent += cost || 0
    pool.push(...items.map(toCandidate))
    let note = items.length + ' candidates'

    if (items.length === limit) {
      const tail = await labs('keyword_suggestions/live', [{
        ...base,
        keyword: topic,
        filters: [
          ['keyword_info.search_volume', '<', TAIL_HIGH], 'and',
          ['keyword_info.search_volume', '>', TAIL_LOW],
        ],
      }])
      spent += tail.cost || 0
      tailCalls++
      pool.push(...tail.items.map(toCandidate))
      note += ' plus ' + tail.items.length + ' from the long tail'
    }
    log('keyword', 'topic "' + topic + '"  ' + note)
  }

  // Topics overlap, and the tail call can repeat a keyword the first call
  // already returned when that first call did not reach far enough down.
  const seen = new Set()
  const unique = pool.filter(c => !seen.has(c.keyword) && seen.add(c.keyword))
  log('keyword', 'pool built, ' + unique.length + ' candidates from ' + site.topics.length +
    ' topics and ' + tailCalls + ' long tail calls, ' + (pool.length - unique.length) +
    ' duplicates dropped, cost $' + spent.toFixed(3))
  return unique
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

// Whether the next pick will rebuild the pool, and so spend on DataForSEO.
// preflight.mjs asks, so it only checks that balance on the night it is used.
export function poolNeedsBuilding(site, now = Date.now()) {
  const file = poolFile(site)
  if (!fs.existsSync(file)) return true
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'))
  return (now - Date.parse(saved.builtAt)) / 86400000 >= POOL_DAYS
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
// When every word of a keyword is a modifier there is no content left to group
// on, as in "what is the best ai tools". The old fallback shaped the whole
// keyword, function words included, and those are exactly the words a slug does
// not keep. The engine writes that keyword up as "What Are the Best AI Tools",
// so the subject carried an "is" that the slug could never match and
// alreadyCovered() answered no every single time. Ten versions of that one
// article went out between 8 and 14 October 2026, eight of them sitting
// together on the listing page. Dropping the function words before shaping
// leaves "ai best tool", which the slug does match, and it also puts "best ai
// tools", "what are the best ai tools" and "what is the best ai tools" in one
// cluster instead of three.
function subject(keyword) {
  const content = words(keyword).filter(w => !MODIFIERS.has(w)).map(stem)
  if (content.length) return [...new Set(content)].sort().join(' ')
  const carrying = words(keyword).filter(w => !CONNECTIVES.has(w) && !QUESTIONS.has(w)).map(stem)
  return carrying.length ? [...new Set(carrying)].sort().join(' ') : shape(keyword)
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

// Ranking, written to David's notes of 29 September 2026 rather than to volume.
//
// Sorting on volume alone was tried on 8 October and it is wrong. With the
// difficulty ceiling lifted so that long tail terms survive, the biggest head
// word wins every time: IdeoLab's first pick became "survey" at 90,500 a month
// and a difficulty of 96, and Strategic Marketer's became "project management".
// Neither is about the business, and his notes say in as many words that we
// should not create unrelated content simply because a keyword has traffic.
//
// So volume is carried as a logarithm, which keeps it mattering without letting
// it dominate, and three things from his notes lift a keyword above a bigger
// one: it is asked as a question, which he calls especially valuable; it is a
// longer and therefore more specific phrase, which is what long tail means; and
// it is winnable rather than merely large.
function score(c) {
  const w = words(c.keyword)
  const question = QUESTIONS.has(w[0]) ? 1.6 : 1
  const specific = Math.min(w.length, 5) / 2
  const winnable = (100 - (c.difficulty ?? 50)) / 100
  return Math.log10(Math.max(c.volume, 10)) * question * (0.5 + specific / 4) * winnable
}

// Everything pickKeyword does except choosing. The topic builder needs the count
// of what is left, and counting it by publishing an article would be an expensive
// way to ask a question.
export async function remainingIdeas(site, { now = Date.now(), refresh = false } = {}) {
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
    // A falling term is skipped unless the site says otherwise. IdeoLab lowers
    // the bar because David named "ai presentation builder", "ai landing page
    // builder" and "ai proposal generator" himself, and on 16 October 2026 all
    // three were down between 37 and 56 percent on the year.
    .filter(c => c.trend > (seo.minTrend ?? -30))

  const kept = cluster(eligible, site.topics || [])
    .filter(c => !alreadyCovered(c.keyword, slugs))
    .sort((a, b) => score(b) - score(a))

  log('keyword', eligible.length + ' pass intent, difficulty under ' + maxDifficulty + ' and volume over ' + minVolume + ', leaving ' + kept.length + ' ideas not already written')
  return kept
}

export async function pickKeyword(site, opts = {}) {
  const kept = await remainingIdeas(site, opts)
  if (!kept.length) {
    throw new Error('Nothing left for ' + site.name + '. Add topics to sites/' + site.key + '.json or raise seo.maxDifficulty.')
  }

  const pick = kept[0]
  log('keyword', pick.keyword + '  ' + pick.volume + '/mo  difficulty ' + pick.difficulty + '  ' + pick.intent + '  trend ' + (pick.trend > 0 ? '+' : '') + pick.trend + '%')
  if (pick.secondary.length) log('keyword', 'also covering: ' + pick.secondary.join(', '))
  log('keyword', 'runners up: ' + kept.slice(1, 4).map(c => c.keyword + ' (' + c.volume + ', kd ' + c.difficulty + ')').join('  |  '))
  return pick
}

export const _internals = { relevant, onTopic, words, stem, shape, subject, cluster, alreadyCovered, score }
