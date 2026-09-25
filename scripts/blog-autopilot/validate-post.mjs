#!/usr/bin/env node
// scripts/blog-autopilot/validate-post.mjs
// Mechanical pre-publish gate for the blog autopilot. Pure checks only;
// qualitative review is done separately by the agent. All site-specific
// values come from autopilot.config.json at the repo root.
import { promises as fs } from "fs"
import path from "path"
import { createRequire } from "module"
import { pathToFileURL } from "url"
import { loadConfig } from "./config.mjs"

// Resolve gray-matter from this script's tree (vendored install) or, when the
// script runs from the plugin cache, from the target repo's node_modules (cwd).
let matter
try {
  matter = (await import("gray-matter")).default
} catch {
  try {
    matter = createRequire(path.join(process.cwd(), "package.json"))("gray-matter")
  } catch {
    console.error("gray-matter not found - run: npm install gray-matter (in the site repo)")
    process.exit(2)
  }
}

export function validatePost({ raw, slug, keyword, existingSlugs = [], config }) {
  const failures = []
  const { data, content } = matter(raw)
  const c = config.content

  for (const f of c.requiredFrontmatter) {
    const v = data[f]
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) {
      failures.push(`missing frontmatter field: ${f}`)
    }
  }

  if (data.category && !c.categories.includes(data.category)) {
    failures.push(`category "${data.category}" not in allowed set: ${c.categories.join(", ")}`)
  }

  if (c.author && data.author && data.author !== c.author) {
    failures.push(`author must be exactly "${c.author}", got "${data.author}"`)
  }

  if (data.status && !["draft", "published"].includes(data.status)) {
    failures.push(`status must be "draft" or "published", got "${data.status}"`)
  }

  const kw = (keyword || "").toLowerCase().trim()
  if (!kw) {
    failures.push("no target keyword provided")
  } else {
    const title = String(data.title || "").toLowerCase()
    const excerpt = String(data.excerpt || "").toLowerCase()
    const bodyText = content.toLowerCase()
    // The title may use a close grammatical variant rather than the exact phrase,
    // per the master prompt. Require most of the keyword's content words instead,
    // matched on a five character stem so report/reporting and automate/automating
    // both count. The exact phrase is still required in the slug, excerpt and body.
    const stop = new Set(["how", "from", "with", "into", "your", "that", "this", "than", "when", "what", "for", "and", "the"])
    const kwWords = kw.split(/\s+/).filter((w) => w.length > 3 && !stop.has(w))
    const hit = kwWords.filter((w) => title.includes(w.slice(0, 5))).length
    if (!title.includes(kw) && (kwWords.length === 0 || hit / kwWords.length < 0.6)) {
      failures.push(`keyword "${kw}" not reflected in title`)
    }
    if (!slug.toLowerCase().includes(kw.replace(/\s+/g, "-"))) failures.push(`keyword "${kw}" not reflected in slug`)
    if (!excerpt.includes(kw)) failures.push(`keyword "${kw}" not in excerpt`)
    if (!bodyText.includes(kw)) failures.push(`keyword "${kw}" not in body`)
  }

  // Money-page link as a relative markdown link (internal links are always
  // relative per the rules). Entries ending in "/" are prefix matches.
  const hasMoneyLink = c.moneyPages.some((p) => content.includes(`](${p}`))
  if (!hasMoneyLink) {
    failures.push(`no internal link to a money page (${c.moneyPages.join(", ")})`)
  }

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length
  if (wordCount < c.minWords) failures.push(`body too short: ${wordCount} words (min ${c.minWords})`)

  if (c.banEmDashes && raw.includes("—")) failures.push("contains em dash - banned")

  for (const w of c.bannedWords) {
    const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")
    if (re.test(raw)) failures.push(`mentions banned word "${w}"`)
  }

  if (existingSlugs.includes(slug)) failures.push(`duplicate slug: ${slug}`)

  // FAQs live in frontmatter so the renderer can emit FAQPage JSON-LD.
  if (c.faqs?.required) {
    const faqs = data.faqs
    if (!Array.isArray(faqs) || faqs.length === 0) {
      failures.push("faqs frontmatter array is required")
    } else {
      if (faqs.length < c.faqs.min || faqs.length > c.faqs.max) {
        failures.push(`faqs count ${faqs.length} outside allowed range ${c.faqs.min}-${c.faqs.max}`)
      }
      if (!faqs.every((f) => f && typeof f.question === "string" && f.question.trim() && typeof f.answer === "string" && f.answer.trim())) {
        failures.push("every faqs item needs non-empty question and answer strings")
      }
    }
    if (/^##\s+faq/im.test(content)) {
      failures.push("body contains a ## FAQ section - FAQs belong in frontmatter only")
    }
  }

  // External citations: markdown links to http(s) URLs that are not this site.
  const minCitations = c.citations?.min ?? 0
  if (minCitations > 0) {
    const siteUrl = (config.site?.url || "").replace(/\/$/, "")
    const linkRe = /\]\((https?:\/\/[^)\s]+)\)/g
    const external = new Set()
    let m
    while ((m = linkRe.exec(content)) !== null) {
      if (!siteUrl || !m[1].startsWith(siteUrl)) external.add(m[1])
    }
    if (external.size < minCitations) {
      failures.push(`only ${external.size} external citation link(s), need at least ${minCitations}`)
    }
  }

  return { ok: failures.length === 0, failures, wordCount }
}

async function main() {
  const args = process.argv.slice(2)
  const file = args[0]
  if (!file) {
    console.error("usage: validate-post.mjs <post.md> --keyword \"<keyword>\"")
    process.exit(2)
  }
  const kwIdx = args.indexOf("--keyword")
  const keyword = kwIdx >= 0 ? args[kwIdx + 1] : ""
  const config = await loadConfig(path.dirname(path.resolve(file)))
  const raw = await fs.readFile(file, "utf8")
  const slug = path.basename(file, ".md")
  const dir = path.dirname(file)
  const existingSlugs = (await fs.readdir(dir))
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""))
    .filter((s) => s !== slug)
  const result = validatePost({ raw, slug, keyword, existingSlugs, config })
  console.log(JSON.stringify(result, null, 2))
  process.exit(result.ok ? 0 : 1)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e); process.exit(2) })
}
