// One article, start to finish, for one site.
//
//   node scripts/engine/run.mjs --site ideolab
//   node scripts/engine/run.mjs --site strategicmarketer --from-file path.md
//   node scripts/engine/run.mjs --site ideolab --status draft --dry-run
//
// Every step either proves it worked or stops the run. Nothing is reported as
// done on the strength of a 200.
import fs from 'node:fs'
import path from 'node:path'
import { loadSite, slugify, log, fail, ROOT } from './lib.mjs'
import { pickKeyword, existingPosts } from './keywords.mjs'
import { writeArticle } from './write.mjs'
import { qa } from './qa.mjs'
import { generateCover, credit } from './cover.mjs'
import { uploadCover } from './upload.mjs'
import { publishPost } from './publish.mjs'
import { verifyLive } from './verify.mjs'

const args = {}
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i]
  if (a.startsWith('--')) args[a.slice(2)] = process.argv[i + 1]?.startsWith('--') || !process.argv[i + 1] ? true : process.argv[++i]
}
if (!args.site) fail('args', 'pass --site ideolab or --site strategicmarketer')

const LEDGER = path.join(ROOT, 'memory/autopilot/engine-ledger.json')

function frontMatter(md) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(md)
  if (!m) return { meta: {}, body: md }
  const meta = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([a-z_]+):\s*(.*)$/.exec(line)
    if (kv) meta[kv[1]] = kv[2].trim()
  }
  return { meta, body: md.slice(m[0].length) }
}

// A model sometimes wraps its answer in a code fence. Strip it rather than
// failing on something that is only packaging.
function unfence(md) {
  const m = /^\s*```(?:markdown|md)?\n([\s\S]*?)\n```\s*$/.exec(md.trim())
  return m ? m[1] : md
}

function saveDraft(site, slug, md) {
  const dir = path.join(ROOT, site.contentDir, 'drafts')
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, (slug || 'untitled') + '.md')
  fs.writeFileSync(file, md)
  return file
}

function record(entry) {
  const all = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, 'utf8')) : []
  all.push(entry)
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true })
  fs.writeFileSync(LEDGER, JSON.stringify(all, null, 2) + '\n')
}

const site = loadSite(args.site)
log('site', site.name + '  ' + site.siteUrl)

let keyword = args.keyword || null
let topic = null
let md

if (args['from-file']) {
  const p = path.resolve(args['from-file'])
  if (!fs.existsSync(p)) fail('write', 'no such file ' + p)
  md = fs.readFileSync(p, 'utf8')
  log('write', 'using ' + path.basename(p))
} else {
  const picked = await pickKeyword(site)
  keyword = picked.keyword
  topic = { ...picked, existing: await existingPosts(site) }
  md = await writeArticle(site, topic)
}

// Parse, check, and when the model wrote it, give it one chance to fix what the
// checks rejected. The checks are the house rules, so a retry is cheaper than a
// morning spent correcting an article by hand.
// Three attempts, not two. On 6 October the IdeoLab run came back at 1974
// words, was told to fix it, and came back at 1938: the model trims a little
// and stops. A second correction, this time naming the number of words to cut,
// is what actually brings it under the ceiling.
const ATTEMPTS = 3
let parsed, report
for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
  md = unfence(md)
  parsed = frontMatter(md)
  const title = (parsed.body.match(/^# (.+)$/m) || [])[1]
  const slug = args.slug || (title ? slugify(title) : null)
  const file = saveDraft(site, slug, md)
  if (attempt === 1) log('write', 'saved ' + path.relative(ROOT, file))

  if (!title) {
    if (attempt === ATTEMPTS || !topic) fail('write', 'the article has no H1 title')
    log('write', 'no H1 title, asking for it again')
    md = await writeArticle(site, topic, 'Your previous answer had no H1 title. Write the article again in full, starting with the front matter and then a single H1.')
    continue
  }

  report = await qa(parsed.body, { site, keyword })
  log('qa', report.words + ' words, ' + report.h2 + ' H2, ' + report.faqs + ' FAQs, ' + report.links + ' links checked')
  for (const w of report.warn) log('qa', 'warning  ' + w)
  if (!report.errors.length) break

  for (const e of report.errors) console.error('[qa       ] ' + e)
  if (attempt === ATTEMPTS || !topic) fail('qa', report.errors.length + ' problem(s), nothing published')

  // "Make it shorter" gets a draft thirty words shorter. A number, and an
  // instruction to drop a whole section rather than shave every paragraph,
  // gets one that actually fits.
  const over = report.words > 1800 ? report.words - 1700 : 0
  log('qa', 'rewriting to fix the above, attempt ' + (attempt + 1) + ' of ' + ATTEMPTS)
  md = await writeArticle(site, topic, [
    'Your previous draft was rejected by the checks below. Write the whole article again and fix every one of them.',
    over
      ? 'That draft ran to ' + report.words + ' words. The ceiling is 1800 and you came in over it. Cut ' + over +
        ' words. Count the H2 sections you wrote: if there are more than six teaching sections, delete the weakest ' +
        'ones until exactly six are left, because the extra section is usually the whole problem. If there are ' +
        'already six, then each one is running long, so cut whole paragraphs out of the longest sections until ' +
        'every section is at or under 180 words. Do not shave a line off every paragraph, that is what you did ' +
        'last time and it did not work. Keep the Quick answer block, the call to action and all the FAQs, and ' +
        'keep every FAQ answer at or under 50 words.'
      : 'Keep the body between 1200 and 1800 words.',
    'Keep the front matter. Return markdown only, no code fence around it.',
    '',
    ...report.errors.map(e => '- ' + e),
  ].join('\n'))
}

const title = (parsed.body.match(/^# (.+)$/m) || [])[1]
const slug = args.slug || slugify(title)
const excerpt = parsed.meta.excerpt || args.excerpt
const category = parsed.meta.category || args.category || site.defaultCategory
const coverObjects = parsed.meta.cover_objects || args.cover
if (!excerpt) fail('write', 'no excerpt. Put it in the front matter or pass --excerpt')
if (!coverObjects) fail('cover', 'no cover_objects. Put it in the front matter or pass --cover')

// The platform does not refuse a slug it already holds. It appends a number and
// publishes anyway, which is how ten versions of "what are the best ai tools"
// reached IdeoLab between 8 and 14 October 2026, sitting at -2 and -3, eight of
// them filling the listing page at once. The real fault was in the keyword
// picker and it has been corrected, but a slug that already exists is a
// duplicate whatever caused it, so stop before the cover is bought rather than
// put a second copy in front of readers. Failing here is deliberate: the run
// goes red and the failure step says why.
const taken = (await existingPosts(site)).map(p => p.slug)
if (taken.includes(slug)) {
  fail('slug', 'a post with the slug "' + slug + '" already exists, so this article is a duplicate. Nothing was published and no cover was bought.')
}

log('cover', 'credit before ' + (await credit()))
const file = await generateCover(site, coverObjects, slug)
const coverUrl = args['dry-run'] ? null : await uploadCover(file, slug)

if (args['dry-run']) {
  log('done', 'dry run, article and cover ready, nothing posted')
  process.exit(0)
}

const content = parsed.body.replace(/^# .+\n+/m, '')
const posted = await publishPost(site, {
  title, slug, excerpt, content, category, coverUrl,
  coverAlt: coverObjects.split('.')[0],
  status: args.status || 'published',
})

let live = { ok: null, pageUrl: site.siteUrl + site.postPath + slug + '.html' }
if (posted.status === 'published') {
  live = await verifyLive(site, slug)
  if (!live.ok) fail('verify', 'the post did not appear complete on the live site, check ' + live.pageUrl)
}

record({ site: site.key, slug, title, keyword, category, id: posted.id, status: posted.status, url: live.pageUrl, cover: posted.thumbnail })
log('done', live.pageUrl)
