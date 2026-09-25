// scripts/blog-autopilot/ledger.mjs
// Append-only publish ledger. One entry per run; keys dedup future topic picks.
import { promises as fs } from "fs"
import path from "path"

export async function readLedger(p) {
  try {
    return JSON.parse(await fs.readFile(p, "utf8"))
  } catch (e) {
    if (e.code === "ENOENT") return { entries: [] }
    throw e
  }
}

export function isCovered(ledger, { keyword, slug }) {
  const kw = (keyword || "").toLowerCase()
  return ledger.entries.some(
    (e) => e.slug === slug || String(e.keyword || "").toLowerCase() === kw
  )
}

export async function appendLedger(p, entry) {
  const ledger = await readLedger(p)
  ledger.entries.push(entry)
  await fs.mkdir(path.dirname(p), { recursive: true })
  await fs.writeFile(p, JSON.stringify(ledger, null, 2) + "\n")
  return ledger
}
