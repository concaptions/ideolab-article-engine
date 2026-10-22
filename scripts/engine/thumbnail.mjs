// Covers from 20 October 2026.
//
// The old cover was one object on a plain studio surface, the same look every
// day, filled in from a line the writer gave. David called the blog images not
// good, sent a thumbnail prompt with thirty styles, and on 20 October approved
// covers built this way ("YES sooo much better ... make sure that's automated").
//
// A site opts in with cover.thumbnail in sites/<site>.json, and its style and
// approved example live in prompt/cover-thumbnail.md. The
// image carries a short headline of its own, not the post title: a cover that
// repeats the title in big letters is what his own sample images did, and
// copying that layout made ours look pasted from his.
//
// Image models misspell. So after the image comes back, a second model reads
// every word on it, and anything other than the headline, spelled exactly, is
// a reject. Two tries, then the run stops rather than publish a bad cover.
//
// 22 October 2026: David called the covers "still terrible", and three of the
// four Strategic Marketer ones were: piles of props, hand tools for "tools", a
// gate like a jail door, a seam down the background. The style was right, the
// scenes were not. So the brief now states in one sentence what the picture
// says before it describes it, a second text pass holds the brief against the
// scene rules in prompt/cover-thumbnail.md and rewrites it if it fails, and the
// image check rejects seams, cut off text and broken objects as well as text.
import fs from 'node:fs'
import path from 'node:path'
import { env, log, ROOT } from './lib.mjs'
import { ask } from './write.mjs'

// The rules and this site's style, with the approved example, from
// prompt/cover-thumbnail.md.
function guide(site) {
  const md = fs.readFileSync(path.join(ROOT, 'prompt/cover-thumbnail.md'), 'utf8')
  const sections = md.split(/^## /m)
  const rules = sections.find(s => s.startsWith('Rules for both sites')) || ''
  const scene = sections.find(s => s.startsWith('Scene rules')) || ''
  const own = sections.find(s => s.startsWith('Site: ' + site.key + '\n'))
  if (!own) throw new Error('prompt/cover-thumbnail.md has no section "## Site: ' + site.key + '"')
  return '## ' + rules + '\n## ' + scene + '\n## ' + own
}

// The headlines already on this site's covers, newest first, so a new one does
// not echo them. On 21 October two Strategic Marketer covers went out the same
// night as "Save Time Before Spending" and "Save Time, Not Guesswork".
async function recentHooks(site) {
  try {
    const { api } = await import('./lib.mjs')
    const j = await api(site, '/blog/posts?limit=100')
    return (j.posts || j).filter(p => p.status === 'published' && p.thumbnail?.alt)
      .sort((a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0))
      .slice(0, 30).map(p => p.thumbnail.alt)
  } catch {
    return []
  }
}

export function briefPrompt(site, { title, body }, used = []) {
  return [
    'You art direct the cover image for one article on ' + site.name + '. Return JSON only, no code fence:',
    '{"says": "...", "hook": "...", "prompt": "..."}',
    '',
    'says: write this first. One sentence, no "and", saying what the picture shows and why that is the',
    'article\'s point. Everything in the prompt has to serve this sentence.',
    '',
    'hook: the words printed on the image. Three to five words, title case: the result the reader wants, said',
    'the way they would say it, like the two approved ones, "Your Website, No Designer Needed" and "Make Every',
    'Marketing Dollar Work". Not a step from inside the article ("Fix Facts First", "Make Next Steps Obvious"',
    'were rejected for that), not the article title, not its keyword repeated. No numbers. No punctuation',
    'except one comma or one question mark. Promise nothing the article does not teach.',
    '',
    'prompt: one self contained image prompt that starts with "A 16:9 blog thumbnail", in this site\'s style',
    'and as detailed as the approved example in the guide below, with a new scene for this article.',
    'Pick one concrete visual idea from this article that a reader gets at a glance: real objects doing',
    'something, a small scene or a clear visual metaphor. Decide the composition yourself and say where the',
    'headline sits (left, right or top, whatever suits the scene) with generous margins from every edge.',
    'Do not default to a laptop or a browser window, and never a robot, a lightbulb or a dashboard full of',
    'numbers. No faces. No invented statistics, results, logos or brand names.',
    'End the prompt with exactly this, with your hook in the quotes: The only readable text in the entire',
    'image is the headline, reading exactly "<hook>", spelled exactly as given. No other words, letters,',
    'numbers, labels, logos or watermarks anywhere, including on screens, cards, signs and objects.',
    '',
    guide(site),
    '',
    used.length ? 'Headlines already on this site\'s covers, do not reuse or echo any of them: ' + used.join(' | ') : '',
    '',
    'Article title: ' + title,
    '',
    body,
  ].join('\n')
}

const parseJson = raw => {
  const s = String(raw).trim().replace(/^```(?:json)?\s*|\s*```$/g, '')
  return JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1))
}

function checkBrief(brief) {
  const words = String(brief.hook || '').trim().split(/\s+/)
  if (words.length < 2 || words.length > 6) throw new Error('cover hook is ' + words.length + ' words: ' + brief.hook)
  if (!/^A 16:9 blog thumbnail/.test(brief.prompt || '')) throw new Error('cover prompt does not start as asked')
  if (!brief.prompt.includes(brief.hook)) throw new Error('cover prompt does not carry the hook "' + brief.hook + '"')
  return { says: String(brief.says || '').trim(), hook: brief.hook.trim(), prompt: brief.prompt.trim() }
}

// A second pass that only judges. The first pass writes a scene it likes; this
// one holds it against the scene rules and rewrites it when it fails. It costs a
// text call, which is far cheaper than an image nobody wants.
export function reviewPrompt(site, brief, used = []) {
  return [
    'You review a cover brief for ' + site.name + ' before any image is made. Hold it against every scene rule',
    'below. Count the distinct objects the prompt asks for. Look for anything drawn literally from a figure of',
    'speech, anything that could read as negative or odd, a background split into panels, and a hook that',
    'echoes one already used. If it passes every rule, return it unchanged. If not, rewrite "prompt" (and',
    '"hook" or "says" if they are the problem) so it passes, keeping the site style, the same detail as the',
    'approved example, and the closing sentence about the only readable text.',
    'Return JSON only: {"pass": true or false, "problems": ["..."], "says": "...", "hook": "...", "prompt": "..."}',
    '',
    guide(site),
    '',
    used.length ? 'Headlines already used on this site: ' + used.join(' | ') : '',
    '',
    'The brief:',
    JSON.stringify(brief),
  ].join('\n')
}

export async function coverBrief(site, article) {
  const used = await recentHooks(site)
  const first = checkBrief(parseJson(await ask(briefPrompt(site, article, used))))
  try {
    const review = parseJson(await ask(reviewPrompt(site, first, used)))
    if (review.pass === false) {
      const fixed = checkBrief(review)
      log('cover', 'scene rewritten by review: ' + (review.problems || []).join('; ').slice(0, 220))
      return fixed
    }
  } catch (e) {
    log('cover', 'review skipped, ' + String(e.message || e).slice(0, 120))
  }
  return first
}

const letters = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// Returns { ok, seen }. ok is null when the reader itself could not be reached,
// so the caller can tell "the image is wrong" from "nobody could look".
export async function readCover(file, hook) {
  if ((env('WRITER_PROVIDER', { required: false }) || '') !== 'openai') return { ok: null, seen: 'no reader for this provider' }
  try {
    const b64 = fs.readFileSync(file).toString('base64')
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env('OPENAI_API_KEY'), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env('WRITER_MODEL', { required: false }) || 'gpt-4o',
        messages: [{ role: 'user', content: [
          { type: 'text', text: [
            'Look at this blog cover image and reply with JSON only: {"text": "...", "defects": ["..."]}.',
            'text: every piece of readable text in the image, exactly as spelled, in reading order, separated by spaces,',
            'including text on screens, cards and objects. If there is none, "NONE".',
            'defects: only clear problems an ordinary viewer would notice at once. A background split into two',
            'panels or tones by a visible seam or edge. Text cut off by the edge of the image. Objects that are',
            'warped, melted, broken or impossible. Anything that looks like a cage, bars, a jail or a trap. An empty',
            'list if there are none; do not report matters of taste.',
          ].join(' ') },
          { type: 'image_url', image_url: { url: 'data:image/' + (/\.jpe?g$/i.test(file) ? 'jpeg' : 'png') + ';base64,' + b64 } },
        ] }],
      }),
    })
    const j = await res.json()
    if (!res.ok) return { ok: null, seen: 'reader error ' + res.status + ' ' + JSON.stringify(j).slice(0, 120) }
    let out
    try { out = parseJson(j.choices?.[0]?.message?.content || '') } catch { return { ok: null, seen: 'reader reply was not JSON' } }
    const seen = String(out.text || '').trim()
    const defects = Array.isArray(out.defects) ? out.defects.filter(Boolean) : []
    const textOk = letters(seen) === letters(hook)
    return { ok: textOk && !defects.length, seen, defects }
  } catch (e) {
    return { ok: null, seen: 'reader failed ' + String(e).slice(0, 120) }
  }
}

export async function makeCover(site, article, slug, generate) {
  const brief = await coverBrief(site, article)
  log('cover', 'headline "' + brief.hook + '"' + (brief.says ? ', shows: ' + brief.says.slice(0, 160) : ''))
  for (let attempt = 1; attempt <= 2; attempt++) {
    const file = await generate(brief.prompt, slug + (attempt > 1 ? '-' + attempt : ''))
    const check = await readCover(file, brief.hook)
    if (check.ok !== false) {
      if (check.ok === null) log('cover', 'not checked, ' + check.seen)
      else log('cover', 'image checked, reads "' + check.seen + '", no defects')
      return { file, alt: brief.hook, prompt: brief.prompt }
    }
    const why = letters(check.seen) !== letters(brief.hook)
      ? 'the image reads "' + check.seen + '" instead of "' + brief.hook + '"'
      : 'defects: ' + check.defects.join('; ')
    log('cover', 'attempt ' + attempt + ' rejected, ' + why.slice(0, 240))
  }
  throw new Error('the cover came out wrong twice, nothing was published')
}
