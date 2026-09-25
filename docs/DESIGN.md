# Design Notes

Why this repo is shaped the way it is. The engine was extracted from two earlier
production deployments that each shipped one article a day without supervision.

## The problem with forking

The first two deployments were forks: the second site copied the first site's
skill and scripts, then edited brand names, money pages, and categories inline.
Every improvement to one had to be hand-ported to the other, and a missed edit
meant the wrong brand name in a published post. This repo inverts that: the
engine is generic, and everything site-specific is data in
`autopilot.config.json`.

## Architecture

Four layers, each replaceable without touching the others:

1. **Config** (`autopilot.config.json`) - the only file that knows which site
   this is. Brand, paths, money pages, categories, audience, thresholds.
2. **Policy** (`rules/blog-posts.md`) - what a good post looks like:
   structure, voice, citation rules, mobile rules. Prose for the agent, refined
   per site over time.
3. **Engine** (`skills/blog-autopilot/SKILL.md` + `scripts/`) - the
   run loop: pick topic, research, write, gate, publish, verify, notify, ledger.
   Identical across sites.
4. **Runner** (`scripts/run.sh`) - one run, start to finish.

## Decisions worth keeping

- **Deterministic gate before publish.** The LLM writes; a plain Node script
  (`validate-post.mjs`) decides whether it ships. Keyword placement, word count,
  money-page links, citations, FAQ shape, banned words - all mechanical, all
  testable. The qualitative review is a second, adversarial agent, but the
  mechanical gate cannot be sweet-talked.
- **Failed gate still commits a draft.** Drafts don't render publicly but
  preserve the work and feed the dedup ledger, so tomorrow's run doesn't
  rewrite the same topic.
- **The skill owns the push.** Verify-live and Slack announcement depend on the
  post being pushed; deferring the push to the runner created a race in an
  earlier version. `run.sh`'s push is only a safety net.
- **Ledger + topical-overlap check.** Exact-match dedup was not enough: the
  writer would happily produce "get tree service leads" a month after "tree
  service lead generation". The skill now compares search intent, not strings.
- **Backlog-first, API-second topic picking.** DataForSEO ranks candidates when
  available; the human-seeded backlog is both the fallback and the guardrail
  (it encodes which money page needs coverage and what angle is on-brand).
- **Structure rotation.** Daily LLM posts converge on one opening and one
  closing pattern fast. Forcing rotation against the previous post keeps the
  archive from reading like a template.
- **Everything degrades gracefully.** No DataForSEO -> backlog. No Kie.ai ->
  placeholder cover. No Slack -> silent. The post still ships.

## Non-goals

- Not a static-site generator or a blog theme. It assumes an existing
  markdown-frontmatter blog (Next.js, Astro, Hugo, anything that renders
  `content/blog/*.md` on push).
- Not multi-post batching. One post per run, by design - quality gates and
  dedup are much easier to reason about.
- Not an npm package. The scripts are vendored into the target repo so the
  repo remains self-contained and auditable on the server that runs it.
