---
name: blog-autopilot
description: Autonomously research, write, gate, publish, verify, and announce one daily SEO blog post that funnels traffic to a money page. Site-specific values come from autopilot.config.json at the repo root. Use on the daily timer or manually. Pass --dry-run to stop before publishing.
---

# Blog Autopilot

Produce exactly ONE blog post for this run. Everything site-specific lives in
`autopilot.config.json` at the repo root - read it FIRST and treat it as law.
Content rules live in `.claude/rules/blog-posts.md`. Money pages are the goal:
every post funnels to one of `content.moneyPages` via contextual internal links.

If `--dry-run` is in $ARGUMENTS, do every step EXCEPT setting `status: published`,
pushing, and posting to Slack - leave the post as a draft and print the validator JSON.

## 0. Load config

Read `autopilot.config.json`. Wherever this skill says `<config.X>`, substitute the
value from that file.

**Scripts:** they live in `scripts/blog-autopilot/`. Every `scripts/blog-autopilot/...`
path below means that directory. `gray-matter` must be installed in this repo
(`npm install`) for the validator to run.

**Branch sanity:** confirm `<config.git.branch>` is the repo's actual branch
(`git rev-parse --abbrev-ref HEAD`). If they differ, STOP and report the mismatch
(in the Slack skip message when running scheduled) instead of writing a post that
cannot be pushed.

Key config values you will need:

- `site.name`, `site.url`, `site.description` - the brand
- `paths.blogDir`, `paths.imagesDir`, `paths.ledger`, `paths.topicBacklog`, `paths.blogUrlPrefix`
- `content.author`, `content.categories`, `content.minWords`, `content.moneyPages`,
  `content.bannedWords`, `content.audience`, `content.voiceNotes`, `content.faqs`, `content.citations`
- `keywords.locationCode`, `keywords.languageCode`
- `cover.enabled`, `cover.aspectRatio`, `cover.styleNotes`
- `git.branch`

## Constraints (non-negotiable)

- No em dashes anywhere (if `content.banEmDashes`). Use ` - `.
- Never mention any word in `content.bannedWords`.
- No fabricated client results, testimonials, or case studies. Industry facts,
  process explanations, and honest how-to content only.
- Keyword must appear in title, slug, excerpt, and body.
- At least one contextual internal link to the target money page, plus one to a
  second money page (when more than one exists), with descriptive anchor text.
- Minimum `content.minWords` words. Mobile rules from `.claude/rules/blog-posts.md` apply.
- Author is always exactly `content.author`. Category is one of `content.categories`.
- If `content.faqs.required`: FAQs go in the `faqs:` frontmatter array
  (`content.faqs.min`-`content.faqs.max` question/answer objects), NOT a body
  `## FAQ` section. The site renders the visible FAQ section AND the FAQPage
  JSON-LD from that field - the schema depends on it.
- At least `content.citations.min` external citations to primary sources per post
  (platform docs, industry bodies, government data). Every stated statistic is
  linked to its source or explicitly labeled illustrative.
- Rotate structure: the opening hook and closing section must use a different
  pattern than the most recent published post (patterns listed under "Structure
  Rotation" in `.claude/rules/blog-posts.md`).

## 1. Pick the topic (backlog-first)

- List existing slugs: `ls <config.paths.blogDir>/*.md` (tolerate empty).
- Load the ledger: `node -e "import('./scripts/blog-autopilot/ledger.mjs').then(m=>m.readLedger('<config.paths.ledger>').then(l=>console.log(JSON.stringify(l))))"`.
- Read `<config.paths.topicBacklog>` for the seeded clusters and per-money-page gaps.
  Prefer the money page with the fewest published posts.
- Query keyword candidates for the cluster's seeds (see the `dataforseo-keywords`
  skill for interpretation guidance):
  `node scripts/blog-autopilot/keyword-ideas.mjs "<seed>" --limit 50`
  Candidates come back sorted by `search_volume / (keyword_difficulty + 1)`.
  Exit 3 means no credentials - use the backlog only.
- Choose the highest-scoring keyword whose slug/keyword is NOT in the ledger and
  NOT already a slug under the blog dir.
- **Topical-overlap check (not just exact match):** before locking the keyword, compare
  it against every ledger keyword AND every existing slug/title. If an existing post
  already targets the same search intent - same head term, reordered words, singular/plural,
  or synonym variants - treat it as a near-duplicate and SKIP to the next candidate.
  A new post must earn a distinct query, not cannibalize an existing one.
- If DataForSEO is unavailable or fails, fall back to the next unused item in the
  topic backlog table.
- Decide the slug (kebab-case, contains the keyword) and the target money page for
  the chosen cluster.

## 2. Research

- Web-search the keyword and read the top 5 ranking pages. Note what they cover and
  one angle they all miss. Ground every piece of advice in how `content.audience`
  actually operates day to day.

## 3. Write the post

- Create `<config.paths.blogDir>/<slug>.md` per `.claude/rules/blog-posts.md`.
- Frontmatter contract: exactly the fields in `content.requiredFrontmatter`, plus
  optional `featured`, plus `faqs` if required. `author: "<config.content.author>"`,
  `date` = today, `status: "draft"` for now.
- Keyword in title, slug, excerpt, and body.
- At least one contextual link to the target money page and one to a second money
  page, with descriptive anchors woven into sentences.
- At least `content.citations.min` external citations to primary sources, linked
  inline. Any statistic without a linked source must be labeled illustrative or cut.
- No em dashes. Short paragraphs. Callouts for tips/warnings.
- **FAQs** (if required): write `content.faqs.min`-`content.faqs.max` question/answer
  pairs into the `faqs:` frontmatter array (plain-text answers, questions phrased the
  way the audience searches). Do NOT add a `## FAQ` body section.
- **Structure rotation:** read the opening and closing of the most recent published
  post, then pick a different opening-hook pattern and a different closing pattern
  from the "Structure Rotation" list in `.claude/rules/blog-posts.md`.

## 4. Cover image (skip if `cover.enabled` is false)

- Craft the image prompt per the `kie-image-gen` skill (subject/context/style/
  lighting/framing; follow `cover.styleNotes`; no text in the image; fill the frame).
- Generate: `node scripts/blog-autopilot/generate-cover.mjs --prompt "<crafted prompt>" --out <config.paths.imagesDir>/<slug> --aspect <config.cover.aspectRatio>`
  The script polls Kie.ai, downloads, and converts to webp when cwebp exists.
- Set frontmatter `image` to the produced file path (site-relative).
- Exit 3 (no `KIE_AI_API_KEY`) or exit 1 (failed twice): set `image` to a site
  fallback (e.g. `/icon.svg` or an existing generic cover) and record
  `coverFallback=true` for the Slack note.

## 5. Self-review gate

- Mechanical: `node scripts/blog-autopilot/validate-post.mjs <config.paths.blogDir>/<slug>.md --keyword "<keyword>"`.
- Dead-link check: for every external URL in the post, run
  `curl -sL -o /dev/null -w "%{http_code}" --max-time 10 "<url>"` (GET, not HEAD -
  some sites 404 on HEAD requests). Anything not 2xx/3xx: replace the citation
  with a working primary source or cut the claim. Internal links: confirm each
  target route/slug actually exists in the repo.
- Qualitative: dispatch ONE subagent to adversarially review the draft against
  `.claude/rules/blog-posts.md` and SERP intent ("would this rank and read as
  human-written to <the audience>? List concrete failures.").
- PASS = validator exit 0 AND subagent returns no blocking issues.
- If `--dry-run`: print the validator JSON and STOP here (leave draft, no commit,
  no push, no Slack, no ledger).
- If FAIL (non-dry-run): leave `status: draft`, commit only the draft files, push
  (a draft is not rendered publicly but preserves the record + dedup), then go to
  step 8 with `status=draft` and a skip reason. Do NOT run step 7.

The skill owns the full publish sequence below - commit, PUSH, verify, notify - in
this order. Do not defer the push to the runner; verify and Slack depend on it being live.

## 6. Publish (push happens HERE, before verify)

- Set frontmatter `status: "published"`.
- Commit only the post + cover (never `git add -A`):
  `git add <config.paths.blogDir>/<slug>.md <config.paths.imagesDir>/<slug> && git commit -m "post: <title>"`
- Push so the host can deploy: `git push origin <config.git.branch>`
  (on rejection: `git pull --rebase origin <config.git.branch> && git push origin <config.git.branch>`).

## 7. Verify live (only after the push above)

- Poll `<config.site.url><config.paths.blogUrlPrefix>/<slug>` every 10s up to 60s max:
  `curl -s -o /dev/null -w "%{http_code}" <url>`.
  Stop when 200. Do NOT wait longer than 60s. If still not 200, treat as
  "deploy pending" and move on.

## 8. Notify + ledger

- Post to Slack via the bot (skip if --dry-run, or if `slack.enabled` is false, or
  if `$SLACK_BOT_TOKEN` / `$SLACK_CONTENT_CHANNEL` are unset):
  `curl -s -X POST https://slack.com/api/chat.postMessage -H "Authorization: Bearer $SLACK_BOT_TOKEN" -H 'Content-Type: application/json; charset=utf-8' -d "$(jq -n --arg c "$SLACK_CONTENT_CHANNEL" --arg t "<message>" '{channel:$c,text:$t,unfurl_links:false}')"`
  - Published+live (got 200): `New blog post live: <title> - <url> (targets "<keyword>" -> <moneyPage>)`
  - Skipped (gate failed): `No post today: <reason>`
  - Published but not live yet: `Published <title>, deploy pending - <url>`
- Append to ledger: `node -e "import('./scripts/blog-autopilot/ledger.mjs').then(m=>m.appendLedger('<config.paths.ledger>',{date:'<today>',keyword:'<keyword>',slug:'<slug>',status:'<published|draft>',moneyPage:'<moneyPage>'}))"`.
- Commit + push the ledger: `git add <config.paths.ledger> && git commit -m "chore(autopilot): ledger <slug>" && git push origin <config.git.branch>`.
