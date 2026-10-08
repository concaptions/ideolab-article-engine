// Shared helpers. Keys come from the environment first, so the same scripts run
// unchanged on GitHub Actions. A local .env is only a fallback for development.
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

export const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../..')

let fileEnv = null
function loadFileEnv() {
  if (fileEnv) return fileEnv
  fileEnv = {}
  for (const p of [path.join(ROOT, '.env'), 'D:/Ideolabs/blogs/.env']) {
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
      if (m && fileEnv[m[1]] === undefined) fileEnv[m[1]] = m[2].trim()
    }
  }
  return fileEnv
}

export function env(name, { required = true } = {}) {
  const v = process.env[name] || loadFileEnv()[name]
  if (!v && required) throw new Error('Missing ' + name + '. Set it in the environment or in .env')
  return v || ''
}

export function loadSite(key) {
  const p = path.join(ROOT, 'sites', key + '.json')
  if (!fs.existsSync(p)) throw new Error('Unknown site "' + key + '". Expected ' + p)
  const site = JSON.parse(fs.readFileSync(p, 'utf8'))
  site.apiKey = env(site.apiKeyEnv)
  return site
}

// The blog API answered three calls on 8 October 2026 and then returned
// "Invalid or inactive API key" on the next one, minutes later, with the same key
// that had just worked. It came back on its own. Whatever that is, a GET that
// decides the whole run is not worth losing to it, so a 401 is retried twice
// before it is believed. If the key really is dead, this fails anyway, fifteen
// seconds later and with the same message.
const RETRY_STATUS = new Set([401, 408, 429, 500, 502, 503, 504])

export async function api(site, pathname, opts = {}, attempt = 1) {
  const res = await fetch(site.apiBase + pathname, {
    ...opts,
    headers: { 'X-API-Key': site.apiKey, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  })
  const text = await res.text()
  let body
  try { body = JSON.parse(text) } catch { body = text }
  if (!res.ok) {
    const method = (opts.method || 'GET').toUpperCase()
    if (RETRY_STATUS.has(res.status) && method === 'GET' && attempt < 3) {
      log('api', res.status + ' on ' + pathname + ', attempt ' + attempt + ' of 3, waiting')
      await sleep(attempt * 5000)
      return api(site, pathname, opts, attempt + 1)
    }
    throw new Error('API ' + res.status + ' ' + pathname + ' ' + String(text).slice(0, 300))
  }
  return body
}

export const sleep = ms => new Promise(r => setTimeout(r, ms))

export function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90)
}

export function log(step, msg) {
  console.log('[' + step.padEnd(9) + '] ' + msg)
}

export function fail(step, msg) {
  console.error('[' + step.padEnd(9) + '] FAILED  ' + msg)
  process.exit(1)
}
