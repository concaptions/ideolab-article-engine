// Cloudinary upload. The platform only needs the url to be public for a moment,
// it downloads the image and re-hosts it as blog-external-*.jpg on its own side.
// The delivery url does the 16:9 work, so any shape of source image is fine.
import fs from 'node:fs'
import crypto from 'node:crypto'
import { env, log } from './lib.mjs'

export async function uploadCover(file, publicId) {
  const cloud = env('CLOUDINARY_CLOUD_NAME')
  const key = env('CLOUDINARY_API_KEY')
  const secret = env('CLOUDINARY_API_SECRET')

  // Cloudinary rejects a timestamp that drifts from its own clock, so take theirs.
  const head = await fetch('https://api.cloudinary.com/v1_1/' + cloud + '/image/upload', { method: 'HEAD' }).catch(() => null)
  const now = Math.floor(Date.parse(head?.headers.get('date') || '') / 1000) || Math.floor(Date.now() / 1000)

  const params = { folder: 'blog-covers', overwrite: 'true', public_id: publicId, timestamp: now }
  const toSign = Object.keys(params).sort().map(k => k + '=' + params[k]).join('&')
  const signature = crypto.createHash('sha1').update(toSign + secret).digest('hex')

  const form = new FormData()
  form.append('file', new Blob([fs.readFileSync(file)]), publicId + '.png')
  form.append('api_key', key)
  for (const [k, v] of Object.entries(params)) form.append(k, String(v))
  form.append('signature', signature)

  const res = await fetch('https://api.cloudinary.com/v1_1/' + cloud + '/image/upload', { method: 'POST', body: form })
  const out = await res.json()
  if (!res.ok) throw new Error('Cloudinary ' + res.status + ' ' + JSON.stringify(out).slice(0, 200))

  // Pad rather than crop, so a square source keeps everything that is in it.
  const delivery = out.secure_url
    .replace('/upload/', '/upload/c_pad,ar_16:9,w_1376,b_auto,f_jpg,q_auto/')
    .replace(/\.(png|jpg|jpeg|webp)$/i, '.jpg')

  const probe = await fetch(delivery)
  if (!probe.ok) throw new Error('Cloudinary delivery url not reachable: ' + probe.status)
  log('upload', out.width + 'x' + out.height + ' uploaded, delivered as 16:9 jpg')
  return delivery
}
