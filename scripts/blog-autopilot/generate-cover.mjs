#!/usr/bin/env node
// scripts/blog-autopilot/generate-cover.mjs
// Deterministic cover-image generation via Kie.ai (nano-banana-pro).
// Creates a task, polls until done, downloads, converts to webp when cwebp exists.
// Prints a JSON result and exits 0 on success, 1 on failure, 3 when no API key
// (callers treat 3 as "use the fallback image", not an error).
//
// usage: generate-cover.mjs --prompt "<prompt>" --out <dir> [--aspect 16:9] [--name cover]
import { promises as fs } from "fs"
import path from "path"
import { execFile } from "child_process"
import { promisify } from "util"

const execFileP = promisify(execFile)
const API = "https://api.kie.ai/api/v1"

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}

function out(obj, code) {
  console.log(JSON.stringify(obj, null, 2))
  process.exit(code)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const prompt = arg("prompt")
  const outDir = arg("out")
  const aspect = arg("aspect", "16:9")
  const name = arg("name", "cover")
  if (!prompt || !outDir) out({ ok: false, reason: "usage: generate-cover.mjs --prompt <p> --out <dir> [--aspect 16:9]" }, 1)

  const key = process.env.KIE_AI_API_KEY
  if (!key) out({ ok: false, reason: "KIE_AI_API_KEY not set - use fallback image", fallback: true }, 3)
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }

  const createRes = await fetch(`${API}/jobs/createTask`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "nano-banana-pro",
      input: { prompt, aspect_ratio: aspect, resolution: "2K", output_format: "png" },
    }),
  })
  const created = await createRes.json()
  const taskId = created?.data?.taskId
  if (!taskId) out({ ok: false, reason: "createTask failed", response: created }, 1)

  let url = null
  for (let i = 0; i < 18; i++) {
    await sleep(10_000)
    const res = await fetch(`${API}/jobs/recordInfo?taskId=${taskId}`, { headers })
    const info = await res.json()
    const state = info?.data?.state
    if (state === "success") {
      try {
        const rj = typeof info.data.resultJson === "string" ? JSON.parse(info.data.resultJson) : info.data.resultJson
        url = rj?.resultUrls?.[0]
      } catch { /* fall through */ }
      if (!url) out({ ok: false, reason: "success but no resultUrls", response: info }, 1)
      break
    }
    if (state === "fail") out({ ok: false, reason: "generation failed", response: info?.data?.failMsg || info }, 1)
  }
  if (!url) out({ ok: false, reason: "timed out waiting for generation (3 min)" }, 1)

  await fs.mkdir(outDir, { recursive: true })
  const pngPath = path.join(outDir, `${name}.png`)
  const img = await fetch(url)
  await fs.writeFile(pngPath, Buffer.from(await img.arrayBuffer()))

  let finalPath = pngPath
  try {
    const webpPath = path.join(outDir, `${name}.webp`)
    await execFileP("cwebp", ["-q", "85", pngPath, "-o", webpPath])
    await fs.unlink(pngPath)
    finalPath = webpPath
  } catch { /* cwebp not installed - keep png */ }

  out({ ok: true, path: finalPath, taskId }, 0)
}

main().catch((e) => out({ ok: false, reason: String(e) }, 1))
