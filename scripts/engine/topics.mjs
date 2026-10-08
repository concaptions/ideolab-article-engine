// Topics used to be a hand written list sitting in sites/<site>.json. Nobody
// could say where they came from, which is the one question David's notes of
// 29 September are built to answer. Those notes set the order and this file is
// that order, run on GitHub with nobody in the middle:
//
//   Source of Truth -> ICP -> customer questions -> article ideas -> search
//   validation -> the topic list
//
// The notes are explicit that the chain does not start at the keyword tool:
// "Do not start with random keywords", and "We should not create unrelated
// content simply because a keyword has traffic". So the model reads the
// company's own documents first and only then is a phrase shown to DataForSEO,
// which is allowed to reject it and never to suggest it.
//
// Every topic it keeps is written to topics/<site>.md with the question it came
// from and the group that question belongs to, so the list can always be traced
// back to a document rather than to somebody's judgement.

import fs from 'node:fs'
import path from 'node:path'
import { ROOT, log, loadSite } from './lib.mjs'
import { ask } from './write.mjs'
import { labs, remainingIdeas } from './keywords.mjs'

// The seven groups are David's, named as his notes name them. They are not
// categories for the article, they are the kinds of thing a buyer actually
// wants to know, and keeping all seven stops the list drifting into nothing but
// "how to" pieces.
const BUCKETS = [
  'Questions',
  'Problems',
  'Objections',
  'Decisions',
  'Comparisons',
  'Use cases',
  'Opportunities',
]

// What counts as this site's own documents. The order matters: the source of
// truth first, because it is what may be claimed, then who it is being claimed
// to.
const SOURCES = {
  ideolab: [
    'knowledge/brand-brief.md',
    'knowledge/feature-index.md',
    'knowledge/icp-profile.md',
  ],
  strategicmarketer: [
    'knowledge/strategicmarketer/source-of-truth.md',
    'knowledge/strategicmarketer/icp-public-short.txt',
    'knowledge/strategicmarketer/icp-partner-edition.txt',
  ],
}

// IdeoLab's actual source of truth is 888 KB, far past what fits in a prompt.
// brand-brief.md says in its own opening line that it is the short version of
// it, and feature-index.md says its paragraphs are taken from it, so those two
// carry the substance. What they cannot carry is the shape of the whole thing,
// so its headings go in as a map. A heading is not a claim, so nothing can be
// invented from it, but a question can be prompted by one.
const HEADING_MAP = {
  ideolab: 'knowledge/marketing-source-of-truth.md',
}

const FILE_CAP = 90_000
const HEADING_CAP = 250
const ASK_FOR = 28
const ADD_CAP = 10
// A seed whose biggest neighbour is a quarter of a million searches a month is a
// category, not a topic. The pool it builds fills up with terms nothing on this
// site can win and readers this site cannot serve, which is the exact thing the
// notes of 29 September warn against. "service delivery" came back at 823,000 and
// is the reason this number exists.
const TOO_BROAD = 250_000
const TOPIC_CAP = 40
const DEFAULT_MIN_IDEAS = 10

function read(rel) {
  const p = path.join(ROOT, rel)
  if (!fs.existsSync(p)) return null
  const body = fs.readFileSync(p, 'utf8')
  if (body.length <= FILE_CAP) return { rel, body, truncated: false }
  return { rel, body: body.slice(0, FILE_CAP), truncated: true }
}

function headings(rel) {
  const p = path.join(ROOT, rel)
  if (!fs.existsSync(p)) return null
  const all = fs.readFileSync(p, 'utf8')
    .split('\n')
    .filter(l => /^#{2,3}\s+\S/.test(l))
    .map(l => l.replace(/^#+\s*/, '').trim())
  return { rel, lines: all.slice(0, HEADING_CAP), total: all.length }
}

function documents(site) {
  const parts = []
  for (const rel of SOURCES[site.key] || []) {
    const f = read(rel)
    if (!f) {
      log('topics', 'missing, skipped: ' + rel)
      continue
    }
    log('topics', 'reading ' + rel + '  ' + f.body.length + ' chars' + (f.truncated ? ' (cut to fit)' : ''))
    parts.push('### ' + rel + (f.truncated ? '  [cut to fit, the file is longer]' : '') + '\n\n' + f.body)
  }
  const map = HEADING_MAP[site.key] && headings(HEADING_MAP[site.key])
  if (map) {
    log('topics', 'reading the headings of ' + map.rel + '  ' + map.lines.length + ' of ' + map.total)
    parts.push(
      '### The section headings of ' + map.rel + '\n\n' +
      'This file is the full source of truth and is too long to include. These are its ' +
      'section headings, so you can see everything it covers. A heading is not a fact. ' +
      'Do not claim anything from a heading, only let it remind you what the product has.\n\n' +
      map.lines.map(l => '- ' + l).join('\n')
    )
  }
  if (!parts.length) throw new Error('No source documents found for ' + site.key + '. Nothing to build topics from.')
  return parts.join('\n\n')
}

function buildPrompt(site, current) {
  return [
    'You are choosing what ' + site.name + ' (' + site.siteUrl + ') should publish next.',
    '',
    'Work in this order and do not shortcut it.',
    '',
    'First read the documents at the bottom. They are the company\'s own source of truth',
    'and its ideal customer profile. Everything you produce has to come out of them.',
    '',
    'Second, think about the person those documents describe, and write down what that',
    'person actually wants to know. Spread it across these seven groups, four in each:',
    ...BUCKETS.map(b => '  ' + b),
    '',
    'A Question is something they would ask out loud. A Problem is what is going wrong',
    'for them. An Objection is the reason they would say no. A Decision is a choice they',
    'have to make. A Comparison is this against the alternative, including doing nothing.',
    'A Use case is a situation where it would be used. An Opportunity is something they',
    'have not realised is possible yet.',
    '',
    'Third, and this is the step that goes wrong, write the search seed behind each',
    'question. A seed is not the question and it is not an article title. It is the two',
    'or three plain words that person would type into Google while trying to answer the',
    'question for themselves, before they have ever heard of this company.',
    '',
    'Look at the list already on the list below. That is the shape: short, ordinary,',
    'the name of a subject rather than a sentence about it.',
    '',
    'Rules that decide whether a seed is any good:',
    '- Two or three words. Four at the very most. Lower case, no punctuation, no year.',
    '- Only words a stranger uses. If it contains a term this company coined or uses in',
    '  its own particular way, it is wrong, because nobody outside types it. Strip the',
    '  company\'s vocabulary out and say the same thing in common words.',
    '- Thousands of people must search it every month. Ask yourself whether the phrase',
    '  would appear in Google\'s autocomplete. If you are not sure, make it broader.',
    '- A noun phrase beats a description. "marketing automation" is a seed.',
    '  "marketing that runs itself" is not.',
    '- Broad is not the same as huge. "service delivery" and "business systems" are whole',
    '  categories, searched by people in industries this company has nothing to do with.',
    '  Stay at the level of a subject this company could actually own.',
    '- The article behind it must be writable from these documents alone. If answering it',
    '  would need a fact that is not in them, drop it. An article that has to invent a',
    '  number or a feature is worse than no article.',
    '- It must be about this company\'s subject. Traffic on its own is not a reason. A',
    '  seed that would bring readers who will never be customers is a bad seed.',
    '- It must not repeat anything already on the list, or a near spelling of it.',
    '',
    'Three it would be easy to get wrong, and what they should have been:',
    '  "ai experimentation stuck" is nobody\'s search. "ai adoption challenges" is.',
    '  "approved business facts" is nobody\'s search. "internal knowledge base" is.',
    '  "deliver ai under brand" is nobody\'s search. "white label ai services" is.',
    '',
    'Already on the list, do not repeat these or any near spelling of them:',
    current.length ? current.map(t => '  ' + t).join('\n') : '  (nothing yet)',
    '',
    'Return nothing but a JSON array of exactly ' + ASK_FOR + ' objects, four from each group:',
    '[{"bucket": "Questions", "question": "the thing they want to know, in their words", "phrase": "the search seed"}]',
    '',
    'No commentary before or after the array.',
    '',
    documents(site),
  ].join('\n')
}

// The prompt carries the whole source of truth and the whole ICP, so it is tens
// of kilobytes and the connection drops on it often enough to matter. A dropped
// socket is not a reason to leave the topic list empty for a day.
async function askTwice(prompt, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    try {
      return await ask(prompt)
    } catch (e) {
      if (i === attempts) throw e
      const wait = i * 15000
      log('topics', 'the model call failed (' + e.message.slice(0, 80) + '), trying again in ' + wait / 1000 + 's')
      await new Promise(r => setTimeout(r, wait))
    }
  }
}

// Models like to wrap JSON in a fence or introduce it with a sentence.
function parseIdeas(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenced ? fenced[1] : text
  const start = body.indexOf('[')
  const end = body.lastIndexOf(']')
  if (start === -1 || end === -1 || end < start) {
    throw new Error('The model did not return a JSON array. It began: ' + text.slice(0, 160))
  }
  const parsed = JSON.parse(body.slice(start, end + 1))
  if (!Array.isArray(parsed)) throw new Error('The model returned JSON that is not an array')
  return parsed
    .filter(o => o && typeof o.phrase === 'string')
    .map(o => ({
      bucket: String(o.bucket || 'Questions').trim(),
      question: String(o.question || '').trim(),
      phrase: o.phrase.toLowerCase().replace(/[^a-z0-9& ]+/g, ' ').replace(/\s+/g, ' ').trim(),
    }))
    .filter(o => o.phrase.split(' ').length >= 2 && o.phrase.split(' ').length <= 6)
}

// The model proposes, DataForSEO disposes. A phrase nobody searches for is not a
// topic, however sensible it reads. One small call each: enough to know whether
// real searches cluster around it, cheap enough to run on every candidate.
async function validate(site, ideas) {
  const kept = []
  const rejected = []
  let spent = 0
  for (const idea of ideas) {
    let items = []
    try {
      const r = await labs('keyword_suggestions/live', [{
        keyword: idea.phrase,
        location_code: site.locationCode ?? 2840,
        language_code: site.languageCode ?? 'en',
        limit: 10,
        include_serp_info: false,
        order_by: ['keyword_info.search_volume,desc'],
        filters: [['keyword_info.search_volume', '>', 10]],
      }])
      spent += r.cost || 0
      items = r.items
    } catch (e) {
      rejected.push({ ...idea, why: 'the lookup failed: ' + e.message.slice(0, 80) })
      continue
    }
    // A real seed fills the page. Ten were asked for, so anything that comes back
    // with a handful is a phrase the company uses and the public does not.
    if (items.length < 6) {
      rejected.push({ ...idea, why: 'only ' + items.length + ' real searches cluster around it' })
      continue
    }
    const top = Math.max(...items.map(i => i.keyword_info?.search_volume || 0))
    if (top > TOO_BROAD) {
      rejected.push({ ...idea, why: 'too broad, its biggest neighbour is ' + top.toLocaleString('en-US') + ' searches a month' })
      continue
    }
    kept.push({ ...idea, suggestions: items.length, topVolume: top })
  }
  log('topics', kept.length + ' of ' + ideas.length + ' phrases survived search validation, cost $' + spent.toFixed(3))
  for (const r of rejected) log('topics', '  dropped "' + r.phrase + '": ' + r.why)
  return kept
}

// Asking for twenty eight and keeping all of them would replace half the list in
// one morning, and would throw out the broad seeds that are carrying the pool
// today. Ten at a time lets the list turn over instead of flipping.
//
// The ten are not the ten with the most volume. They are taken a group at a time,
// round the seven groups, because the groups are the reason the list does not
// drift into nothing but how-to articles. Inside a group the seed that fills the
// page beats the seed that half fills it.
function pickBest(kept, cap = ADD_CAP) {
  const byBucket = new Map()
  for (const k of kept) {
    if (!byBucket.has(k.bucket)) byBucket.set(k.bucket, [])
    byBucket.get(k.bucket).push(k)
  }
  for (const list of byBucket.values()) {
    list.sort((a, b) => b.suggestions - a.suggestions || b.topVolume - a.topVolume)
  }
  const order = BUCKETS.filter(b => byBucket.has(b)).concat([...byBucket.keys()].filter(b => !BUCKETS.includes(b)))
  const taken = []
  for (let round = 0; taken.length < cap; round++) {
    let moved = false
    for (const b of order) {
      const list = byBucket.get(b)
      if (round < list.length && taken.length < cap) {
        taken.push(list[round])
        moved = true
      }
    }
    if (!moved) break
  }
  return taken
}

function writeSite(site, topics) {
  const p = path.join(ROOT, 'sites/' + site.key + '.json')
  const json = JSON.parse(fs.readFileSync(p, 'utf8'))
  json.topics = topics
  fs.writeFileSync(p, JSON.stringify(json, null, 2) + '\n')
}

function writeProvenance(site, kept, dropped, when) {
  const dir = path.join(ROOT, 'topics')
  fs.mkdirSync(dir, { recursive: true })
  const p = path.join(dir, site.key + '.md')
  const header = '# ' + site.name + ': where the topics came from\n\n' +
    'Every topic on this site\'s list, the customer question behind it and the group that\n' +
    'question belongs to. Written by `scripts/engine/topics.mjs`, which reads the company\'s\n' +
    'own source of truth and ICP, asks what the buyer wants to know, turns each answer into\n' +
    'a search phrase, and keeps only the phrases real searches cluster around.\n\n' +
    'Newest at the bottom. Nothing here was chosen by hand.\n'
  if (!fs.existsSync(p)) fs.writeFileSync(p, header)

  const lines = [
    '',
    '## ' + when,
    '',
    '| Topic | Group | The question it came from | Searches around it |',
    '|---|---|---|---|',
    ...kept.map(k => '| ' + k.phrase + ' | ' + k.bucket + ' | ' + k.question.replace(/\|/g, '/') + ' | ' + k.suggestions + ' found, top ' + k.topVolume + '/mo |'),
  ]
  if (dropped.length) {
    lines.push('', 'Dropped from the list to stay inside ' + TOPIC_CAP + ' topics, oldest first: ' + dropped.join(', '))
  }
  fs.appendFileSync(p, lines.join('\n') + '\n')
  return p
}

export async function topUpTopics(site, { min = DEFAULT_MIN_IDEAS, force = false, dry = false, now = Date.now() } = {}) {
  if (!force) {
    const left = await remainingIdeas(site, { now })
    if (left.length >= min) {
      log('topics', left.length + ' ideas left for ' + site.name + ', the floor is ' + min + ', nothing to do')
      return { changed: false, left: left.length }
    }
    log('topics', 'only ' + left.length + ' ideas left for ' + site.name + ', below the floor of ' + min + ', topping up')
  }

  const current = site.topics || []
  const raw = await askTwice(buildPrompt(site, current))
  const ideas = parseIdeas(raw)
  log('topics', 'the documents produced ' + ideas.length + ' candidate phrases across ' +
    new Set(ideas.map(i => i.bucket)).size + ' groups')

  const have = new Set(current)
  const fresh = ideas.filter(i => !have.has(i.phrase))
  if (fresh.length < ideas.length) log('topics', (ideas.length - fresh.length) + ' were already on the list')

  const kept = await validate(site, fresh)
  if (!kept.length) {
    log('topics', 'nothing survived, the list is unchanged')
    return { changed: false, left: null }
  }

  const taking = pickBest(kept)
  const notTaken = kept.filter(k => !taking.includes(k))
  if (notTaken.length) {
    log('topics', notTaken.length + ' passed but were not taken this time, ' +
      ADD_CAP + ' is the most the list takes in one go: ' + notTaken.map(k => k.phrase).join(', '))
  }

  // Oldest out first. The list started as thirty phrases somebody typed by hand,
  // so first in first out is also how those stop being the reason anything is
  // published.
  const merged = [...current, ...taking.map(k => k.phrase)]
  const dropped = merged.length > TOPIC_CAP ? merged.slice(0, merged.length - TOPIC_CAP) : []
  const final = merged.slice(-TOPIC_CAP)
  if (dropped.length) log('topics', 'dropped to stay inside ' + TOPIC_CAP + ': ' + dropped.join(', '))

  if (dry) {
    log('topics', 'dry run, nothing written. It would add: ' + taking.map(k => k.phrase).join(', '))
    return { changed: false, left: null, would: taking }
  }

  writeSite(site, final)
  const when = new Date(now).toISOString().slice(0, 10)
  const p = writeProvenance(site, taking, dropped, when)
  log('topics', 'added ' + taking.length + ' topics, the list is now ' + final.length + ', recorded in ' + path.relative(ROOT, p))
  return { changed: true, added: taking.length, total: final.length }
}

const isCli = process.argv[1] && process.argv[1].endsWith('topics.mjs')
if (isCli) {
  const arg = n => {
    const i = process.argv.indexOf('--' + n)
    return i === -1 ? undefined : process.argv[i + 1]
  }
  const site = loadSite(arg('site') || 'ideolab')
  const out = await topUpTopics(site, {
    min: Number(arg('min') ?? DEFAULT_MIN_IDEAS),
    force: process.argv.includes('--force'),
    dry: process.argv.includes('--dry'),
  })
  // The workflow reads this to decide whether there is anything to commit.
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, 'changed=' + (out.changed ? 'yes' : 'no') + '\n')
  }
}
