// Cover generation through Kie, nano-banana-pro.
// The object comes from the article, the look comes from the site block.
// Rule, 5 October 2026: the object has to perform the article's verb. A prop
// that only sits there has been rejected three times.
import fs from 'node:fs'
import path from 'node:path'
import { env, sleep, log, ROOT } from './lib.mjs'

const CREATE = 'https://api.kie.ai/api/v1/jobs/createTask'
const RECORD = 'https://api.kie.ai/api/v1/jobs/recordInfo?taskId='

export async function credit() {
  const r = await fetch('https://api.kie.ai/api/v1/chat/credit', { headers: { Authorization: 'Bearer ' + env('KIE_AI_API_KEY') } })
  const j = await r.json()
  return j.data
}

export function buildPrompt(site, objects) {
  if (!objects || !objects.trim()) throw new Error('cover objects missing, the article must describe what the cover shows')
  return site.cover.styleBlock.replace('{OBJECTS}', objects.trim().replace(/\.$/, ''))
}

export async function generateCover(site, objects, outName) {
  const key = env('KIE_AI_API_KEY')
  const H = { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }
  const prompt = buildPrompt(site, objects)

  const c = await fetch(CREATE, {
    method: 'POST', headers: H,
    body: JSON.stringify({ model: 'nano-banana-pro', input: { prompt, aspect_ratio: site.cover.aspect, resolution: '2K', output_format: 'png' } }),
  })
  const cj = await c.json()
  const taskId = cj.data?.taskId
  if (!taskId) throw new Error('Kie createTask failed: ' + JSON.stringify(cj).slice(0, 200))

  for (let i = 0; i < 40; i++) {
    await sleep(6000)
    const j = await (await fetch(RECORD + taskId, { headers: H })).json()
    const state = j.data?.state
    if (state === 'success') {
      const url = JSON.parse(j.data.resultJson).resultUrls[0]
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer())
      const dir = path.join(ROOT, site.contentDir, 'images')
      fs.mkdirSync(dir, { recursive: true })
      const file = path.join(dir, outName + '.png')
      fs.writeFileSync(file, buf)
      log('cover', outName + '.png  ' + Math.round(buf.length / 1024) + ' KB')
      return file
    }
    if (state === 'fail') throw new Error('Kie generation failed: ' + (j.data.failMsg || 'no reason given'))
  }
  throw new Error('Kie generation timed out after four minutes')
}
