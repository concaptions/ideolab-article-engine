#!/usr/bin/env node
// scripts/blog-autopilot/keyword-ideas.mjs
// Keyword research via DataForSEO Labs. Returns candidates scored by
// search_volume / (keyword_difficulty + 1), sorted best-first, as JSON.
// Exits 0 on success, 1 on API failure, 3 when no credentials
// (callers treat 3 as "fall back to the topic backlog").
//
// usage: keyword-ideas.mjs "<seed>" ["<seed2>" ...] [--limit 50]
// Location/language come from autopilot.config.json (keywords.locationCode,
// keywords.languageCode) when found, else 2840/en.
import { loadConfig } from "./config.mjs"

function out(obj, code) {
  console.log(JSON.stringify(obj, null, 2))
  process.exit(code)
}

async function main() {
  const args = process.argv.slice(2)
  const limitIdx = args.indexOf("--limit")
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : 50
  const seeds = args.filter((a, i) => !a.startsWith("--") && (limitIdx < 0 || i !== limitIdx + 1))
  if (seeds.length === 0) out({ ok: false, reason: "usage: keyword-ideas.mjs \"<seed>\" [--limit 50]" }, 1)

  const login = process.env.DATAFORSEO_LOGIN
  const password = process.env.DATAFORSEO_PASSWORD
  if (!login || !password) out({ ok: false, reason: "DATAFORSEO_LOGIN/PASSWORD not set - fall back to topic backlog", fallback: true }, 3)

  let locationCode = 2840
  let languageCode = "en"
  try {
    const config = await loadConfig()
    locationCode = config.keywords?.locationCode ?? locationCode
    languageCode = config.keywords?.languageCode ?? languageCode
  } catch { /* no config in cwd - use defaults */ }

  const res = await fetch("https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_ideas/live", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${login}:${password}`).toString("base64"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify([{ keywords: seeds, location_code: locationCode, language_code: languageCode, limit }]),
  })
  const data = await res.json()
  const task = data?.tasks?.[0]
  if (!task || task.status_code >= 40000) {
    out({ ok: false, reason: task?.status_message || "DataForSEO request failed", response: data?.status_message }, 1)
  }

  const items = task?.result?.[0]?.items || []
  const candidates = items
    .map((it) => {
      const volume = it.keyword_info?.search_volume ?? it.search_volume ?? 0
      const difficulty = it.keyword_properties?.keyword_difficulty ?? it.keyword_difficulty ?? 0
      return {
        keyword: it.keyword,
        volume,
        difficulty,
        score: Math.round((volume / (difficulty + 1)) * 100) / 100,
        intent: it.search_intent_info?.main_intent,
      }
    })
    .filter((c) => c.keyword && c.volume > 0)
    .sort((a, b) => b.score - a.score)

  out({ ok: true, seeds, locationCode, languageCode, count: candidates.length, candidates }, 0)
}

main().catch((e) => out({ ok: false, reason: String(e) }, 1))
