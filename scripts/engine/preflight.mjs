// Every account a run will spend on, asked before any of it is spent.
//
// On 25 October 2026 the OpenAI account ran dry during the nightly run. A
// Strategic Marketer article had already been written when its cover step hit
// "You have no credits remaining", so the article was lost, and the next
// article on each site failed at the writer on the same empty account. Kie
// running dry is worse: the whole article is written on OpenAI first and the
// empty account is only found at the cover. So the run now asks every account
// before the keyword is picked, and stops if any of them cannot pay.
//
// A check only stops the run on an answer that leaves no doubt: a key that is
// refused or a balance that is too low. Anything else, a timeout or an answer
// in a shape this file does not know, is logged and the run carries on, because
// a check that breaks on its own must not cost a night of articles.
import { env, log } from './lib.mjs'
import { existingPosts, poolNeedsBuilding } from './keywords.mjs'

// One Nano Banana Pro image is 18 credits. A cover gets up to the site's
// attempts in each of the two rounds run.mjs allows, so this is the most one
// article can spend on its cover, and nothing less is enough to start one.
const KIE_PER_IMAGE = 18
const COVER_ROUNDS = 2
// A new keyword pool is about seventy DataForSEO calls: $1.98 to $2.13 a site
// in the runs of 20 to 24 October 2026. Starting one with less than that runs
// dry halfway and loses what was spent, so the floor sits above it.
const DATAFORSEO_MIN = 3

function basic(user, pass) {
  return 'Basic ' + Buffer.from(user + ':' + pass).toString('base64')
}

function unsure(name, e) {
  log('preflight', name + ' could not be checked, carrying on: ' + String(e.message || e).slice(0, 160))
  return null
}

async function blog(site) {
  try {
    await existingPosts(site)
    log('preflight', site.name + ' blog API ok')
  } catch (e) {
    if (/^API 40[13] /.test(String(e.message))) return 'the ' + site.name + ' blog API refused its key (' + site.apiKeyEnv + ')'
    return unsure('the blog API', e)
  }
  return null
}

async function kie(site) {
  const need = KIE_PER_IMAGE * (site.cover.thumbnail?.attempts || 2) * COVER_ROUNDS
  try {
    const r = await fetch('https://api.kie.ai/api/v1/chat/credit', { headers: { Authorization: 'Bearer ' + env('KIE_AI_API_KEY') } })
    const j = await r.json()
    if (j.code === 401) return 'Kie refused the key (KIE_AI_API_KEY)'
    if (typeof j.data !== 'number') return unsure('Kie', new Error('no balance in the answer, code ' + j.code))
    if (j.data < need) return 'Kie has ' + j.data + ' credits and one cover can need ' + need + '. Top up Kie'
    log('preflight', 'Kie ok, ' + j.data + ' credits')
  } catch (e) {
    return unsure('Kie', e)
  }
  return null
}

// OpenAI has no balance to read, so it is asked a one word question. That costs
// a fraction of a cent and gets the same answer the writer would get.
async function writer() {
  const provider = env('WRITER_PROVIDER', { required: false }) || ''
  if (provider !== 'openai') return unsure('the writer', new Error('no check written for provider "' + provider + '"'))
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env('OPENAI_API_KEY'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: env('WRITER_MODEL', { required: false }) || 'gpt-4o', messages: [{ role: 'user', content: 'Reply with OK.' }] }),
    })
    const j = await r.json()
    if (r.status === 401) return 'OpenAI refused the key (OPENAI_API_KEY): ' + String(j.error?.message || '').slice(0, 120)
    if (r.status === 429 && /insufficient_quota/.test(j.error?.code + ' ' + j.error?.type)) return 'OpenAI has no credit left. Top up OpenAI'
    if (!r.ok) return unsure('OpenAI', new Error(r.status + ' ' + String(j.error?.message || '').slice(0, 120)))
    log('preflight', 'OpenAI ok')
  } catch (e) {
    return unsure('OpenAI', e)
  }
  return null
}

async function cloudinary() {
  try {
    const r = await fetch('https://api.cloudinary.com/v1_1/' + env('CLOUDINARY_CLOUD_NAME') + '/usage', {
      headers: { Authorization: basic(env('CLOUDINARY_API_KEY'), env('CLOUDINARY_API_SECRET')) },
    })
    const j = await r.json()
    if (r.status === 401) return 'Cloudinary refused the key (CLOUDINARY_API_KEY)'
    if (!r.ok) return unsure('Cloudinary', new Error(r.status + ' ' + (j.error?.message || '')))
    if (j.credits && j.credits.used_percent >= 100) return 'Cloudinary has used all ' + j.credits.limit + ' credits on its ' + j.plan + ' plan'
    log('preflight', 'Cloudinary ok' + (j.credits ? ', ' + j.credits.used_percent + '% of credits used' : ''))
  } catch (e) {
    return unsure('Cloudinary', e)
  }
  return null
}

// The pool is kept in the repository for ten days, so most nights DataForSEO is
// not called at all. Its balance only matters on the night the pool is rebuilt.
async function dataforseo(site) {
  if (!poolNeedsBuilding(site)) {
    log('preflight', 'DataForSEO not needed, the keyword pool is still fresh')
    return null
  }
  try {
    const r = await fetch('https://api.dataforseo.com/v3/appendix/user_data', {
      headers: { Authorization: basic(env('DATAFORSEO_LOGIN'), env('DATAFORSEO_PASSWORD')) },
    })
    const j = await r.json()
    if (r.status === 401) return 'DataForSEO refused the login (DATAFORSEO_LOGIN)'
    const balance = j.tasks?.[0]?.result?.[0]?.money?.balance
    if (typeof balance !== 'number') return unsure('DataForSEO', new Error('no balance in the answer, ' + j.status_code + ' ' + j.status_message))
    if (balance < DATAFORSEO_MIN) return 'DataForSEO has $' + balance.toFixed(2) + ' and the keyword pool is due a rebuild, which costs about $2.10. Top up DataForSEO'
    log('preflight', 'DataForSEO ok, $' + balance.toFixed(2) + ', the keyword pool will be rebuilt')
  } catch (e) {
    return unsure('DataForSEO', e)
  }
  return null
}

// Returns what stops the run, one line each. Empty means go.
export async function preflight(site) {
  const found = await Promise.all([blog(site), kie(site), writer(), cloudinary(), dataforseo(site)])
  return found.filter(Boolean)
}
