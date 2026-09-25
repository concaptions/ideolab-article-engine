// scripts/blog-autopilot/config.mjs
// Loads autopilot.config.json by walking up from a start directory to the repo root.
import { promises as fs } from "fs"
import path from "path"

export const CONFIG_FILENAME = "autopilot.config.json"

const DEFAULTS = {
  paths: {
    blogDir: "content/blog",
    imagesDir: "public/images/blog",
    ledger: "memory/autopilot/ledger.json",
    topicBacklog: "memory/autopilot/topic-backlog.md",
    blogUrlPrefix: "/blog",
  },
  content: {
    minWords: 1200,
    bannedWords: [],
    banEmDashes: true,
    requiredFrontmatter: ["title", "date", "excerpt", "author", "category", "image", "tags", "status"],
    faqs: { required: false, min: 3, max: 5 },
    citations: { min: 0 },
  },
  git: { branch: "main" },
}

function merge(base, override) {
  const out = { ...base }
  for (const [k, v] of Object.entries(override || {})) {
    out[k] = v && typeof v === "object" && !Array.isArray(v) ? merge(base[k] || {}, v) : v
  }
  return out
}

export async function findConfigPath(startDir = process.cwd()) {
  let dir = path.resolve(startDir)
  for (;;) {
    const candidate = path.join(dir, CONFIG_FILENAME)
    try {
      await fs.access(candidate)
      return candidate
    } catch {
      const parent = path.dirname(dir)
      if (parent === dir) return null
      dir = parent
    }
  }
}

export async function loadConfig(startDir = process.cwd()) {
  const configPath = await findConfigPath(startDir)
  if (!configPath) {
    throw new Error(`${CONFIG_FILENAME} not found walking up from ${startDir}. Copy autopilot.config.example.json to your repo root and edit it.`)
  }
  const raw = JSON.parse(await fs.readFile(configPath, "utf8"))
  const config = merge(DEFAULTS, raw)
  config._configPath = configPath
  config._repoRoot = path.dirname(configPath)
  for (const key of ["site", "content"]) {
    if (!raw[key]) throw new Error(`${CONFIG_FILENAME} is missing required section: "${key}"`)
  }
  if (!raw.site.url) throw new Error(`${CONFIG_FILENAME}: site.url is required`)
  if (!Array.isArray(raw.content.categories) || raw.content.categories.length === 0) {
    throw new Error(`${CONFIG_FILENAME}: content.categories must be a non-empty array`)
  }
  if (!Array.isArray(raw.content.moneyPages) || raw.content.moneyPages.length === 0) {
    throw new Error(`${CONFIG_FILENAME}: content.moneyPages must be a non-empty array`)
  }
  return config
}
