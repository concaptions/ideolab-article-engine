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

function record(entry) {
  const all = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, 'utf8')) : []
  all.push(entry)
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true })
  fs.writeFileSync(LEDGER, JSON.stringify(all, null, 2) + '\n')
}

const site = loadSite(args.site)
log('site', site.name + '  ' + site.siteUrl)

let keyword = args.keyword || null
let md

if (args['from-file']) {
  const p = path.resolve(args['from-file'])
  if (!fs.existsSync(p)) fail('write', 'no such file ' + p)
  md = fs.readFileSync(p, 'utf8')
  log('write', 'using ' + path.basename(p))
} else {
  const picked = await pickKeyword(site)
  keyword = picked.keyword
  const existing = await existingPosts(site)
  md = await writeArticle(site, { ...picked, existing })
}

const { meta, body } = frontMatter(md)
const title = (body.match(/^# (.+)$/m) || [])[1]
if (!title) fail('write', 'the article has no H1 title')
const slug = args.slug || slugify(title)
const excerpt = meta.excerpt || args.excerpt
const category = meta.category || args.category || site.defaultCategory
const coverObjects = meta.cover_objects || args.cover
if (!excerpt) fail('write', 'no excerpt. Put it in the front matter or pass --excerpt')
if (!coverObjects) fail('cover', 'no cover_objects. Put it in the front matter or pass --cover')

const report = await qa(body, { site, keyword })
log('qa', report.words + ' words, ' + report.h2 + ' H2, ' + report.faqs + ' FAQs, ' + report.links + ' links checked')
for (const w of report.warn) log('qa', 'warning  ' + w)
if (report.errors.length) {
  for (const e of report.errors) console.error('[qa       ] ' + e)
  fail('qa', report.errors.length + ' problem(s), nothing published')
}

log('cover', 'credit before ' + (await credit()))
const file = await generateCover(site, coverObjects, slug)
const coverUrl = args['dry-run'] ? null : await uploadCover(file, slug)

if (args['dry-run']) {
  log('done', 'dry run, article and cover ready, nothing posted')
  process.exit(0)
}

const content = body.replace(/^# .+\n+/m, '')
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
