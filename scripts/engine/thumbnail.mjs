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
  const own = sections.find(s => s.startsWith('Site: ' + site.key + '\n'))
  if (!own) throw new Error('prompt/cover-thumbnail.md has no section "## Site: ' + site.key + '"')
  return '## ' + rules + '\n## ' + own
}

export function briefPrompt(site, { title, body }) {
  return [
    'You art direct the cover image for one article on ' + site.name + '. Return JSON only, no code fence:',
    '{"hook": "...", "prompt": "..."}',
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
    'Article title: ' + title,
    '',
    body,
  ].join('\n')
}

export async function coverBrief(site, article) {
  const raw = (await ask(briefPrompt(site, article))).trim().replace(/^```(?:json)?\s*|\s*```$/g, '')
  const brief = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1))
  const words = String(brief.hook || '').trim().split(/\s+/)
  if (words.length < 2 || words.length > 6) throw new Error('cover hook is ' + words.length + ' words: ' + brief.hook)
  if (!/^A 16:9 blog thumbnail/.test(brief.prompt || '')) throw new Error('cover prompt does not start as asked')
  if (!brief.prompt.includes(brief.hook)) throw new Error('cover prompt does not carry the hook "' + brief.hook + '"')
  return { hook: brief.hook.trim(), prompt: brief.prompt.trim() }
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
          { type: 'text', text: 'Transcribe every piece of readable text in this image, exactly as spelled, in reading order, separated by spaces. Include text on screens, cards and objects. Reply with the text only. If there is no text, reply NONE.' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,' + b64 } },
        ] }],
      }),
    })
    const j = await res.json()
    if (!res.ok) return { ok: null, seen: 'reader error ' + res.status + ' ' + JSON.stringify(j).slice(0, 120) }
    const seen = (j.choices?.[0]?.message?.content || '').trim()
    return { ok: letters(seen) === letters(hook), seen }
  } catch (e) {
    return { ok: null, seen: 'reader failed ' + String(e).slice(0, 120) }
  }
}

export async function makeCover(site, article, slug, generate) {
  const brief = await coverBrief(site, article)
  log('cover', 'headline "' + brief.hook + '"')
  for (let attempt = 1; attempt <= 2; attempt++) {
    const file = await generate(brief.prompt, slug + (attempt > 1 ? '-' + attempt : ''))
    const check = await readCover(file, brief.hook)
    if (check.ok !== false) {
      if (check.ok === null) log('cover', 'text not checked, ' + check.seen)
      else log('cover', 'text on the image checked, reads "' + check.seen + '"')
      return { file, alt: brief.hook, prompt: brief.prompt }
    }
    log('cover', 'attempt ' + attempt + ' rejected, the image reads "' + check.seen + '" instead of "' + brief.hook + '"')
  }
  throw new Error('the cover headline came out wrong twice, nothing was published')
}
