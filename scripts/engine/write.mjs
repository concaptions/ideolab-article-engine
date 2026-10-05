// The writer. Pluggable on purpose, because the model key is the one thing the
// engine does not own. Set WRITER_PROVIDER to anthropic, openai or kie.
//
// State of play on 5 October 2026: no provider is usable. The OpenAI key returns
// credit_balance_exhausted and Kie reports no supported text model. Until a key
// lands, run the pipeline with --from-file and a pre written article.
import fs from 'node:fs'
import path from 'node:path'
import { env, ROOT, log } from './lib.mjs'

function knowledge(site) {
  const files = [
    'prompt/article-master-prompt.md',
    'prompt/cover-house-style.md',
    site.key === 'strategicmarketer' ? 'prompt/strategicmarketer-brand-and-icp.md' : 'knowledge/voice-guide.md',
  ]
  return files
    .map(f => path.join(ROOT, f))
    .filter(p => fs.existsSync(p))
    .map(p => '### ' + path.basename(p) + '\n\n' + fs.readFileSync(p, 'utf8'))
    .join('\n\n')
}

export function buildWriterPrompt(site, { keyword, volume, competition, existing }) {
  return [
    'Write one article for ' + site.name + ' (' + site.siteUrl + ').',
    '',
    'Exact keyword: ' + keyword + '  (' + volume + ' searches a month, ' + competition + ' competition)',
    '',
    'Hard requirements:',
    '- 1200 to 1800 words of reader text, not counting the H1',
    '- the exact keyword opens the title, followed by a verb led result',
    '- a Quick answer blockquote right after the opening, four short lines',
    '- six to eight teaching H2 sections, then a FAQ H2 with five to seven questions in bold',
    '- the offering appears before the 60% mark with the raw url in angle brackets: <' + site.cta.url + '>',
    '- a call to action panel before the FAQ heading',
    '- one or two links to articles that already exist on this site, chosen from the list below',
    '- no em dashes or en dashes anywhere',
    '- never link any .gov domain',
    '- never claim anything that is not in the knowledge files',
    '',
    'Articles already on this site, link only to these:',
    existing.map(p => '- ' + site.siteUrl + site.postPath + p.slug + '.html  (' + p.title + ')').join('\n'),
    '',
    'Return markdown only, starting with this front matter:',
    '---',
    'excerpt: one or two sentences, under 200 characters, written as the meta description',
    'category: one of ' + site.categories.join(' | '),
    'cover_objects: one sentence naming the objects the cover shows and what they are doing. The object has to perform the verb the article teaches. A prop that only sits there is wrong.',
    '---',
    '',
    'Then the H1 and the article.',
    '',
    '## Knowledge you must stay inside',
    '',
    knowledge(site),
  ].join('\n')
}

async function callAnthropic(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: process.env.WRITER_MODEL || 'claude-sonnet-5-5', max_tokens: 8000, messages: [{ role: 'user', content: prompt }] }),
  })
  const j = await res.json()
  if (!res.ok) throw new Error('Anthropic ' + res.status + ' ' + JSON.stringify(j).slice(0, 200))
  return j.content.map(c => c.text || '').join('')
}

async function callOpenAI(prompt) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env('OPENAI_API_KEY'), 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: process.env.WRITER_MODEL || 'gpt-4o', messages: [{ role: 'user', content: prompt }] }),
  })
  const j = await res.json()
  if (!res.ok) throw new Error('OpenAI ' + res.status + ' ' + JSON.stringify(j).slice(0, 200))
  return j.choices[0].message.content
}

async function callKie(prompt) {
  const res = await fetch('https://api.kie.ai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env('KIE_AI_API_KEY'), 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: process.env.WRITER_MODEL || 'gemini-2.5-pro', messages: [{ role: 'user', content: prompt }] }),
  })
  const j = await res.json()
  if (j.code && j.code !== 200) throw new Error('Kie chat ' + j.code + ' ' + j.msg)
  return j.choices[0].message.content
}

export async function writeArticle(site, topic) {
  const provider = process.env.WRITER_PROVIDER
  if (!provider) {
    throw new Error('WRITER_PROVIDER is not set. Set it to anthropic, openai or kie with the matching key, or run with --from-file.')
  }
  const prompt = buildWriterPrompt(site, topic)
  log('write', provider + '  keyword "' + topic.keyword + '"')
  if (provider === 'anthropic') return callAnthropic(prompt)
  if (provider === 'openai') return callOpenAI(prompt)
  if (provider === 'kie') return callKie(prompt)
  throw new Error('Unknown WRITER_PROVIDER "' + provider + '"')
}
