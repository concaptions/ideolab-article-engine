# IdeoLab Article Engine

An article engine for [Claude Code](https://docs.anthropic.com/en/docs/claude-code).
It picks a topic, researches what is already ranking, writes the article against
the IdeoLab knowledge base, generates a cover, runs the draft through a
mechanical quality gate and an adversarial review, and leaves a validated
markdown file ready to publish.

Everything specific to IdeoLab lives in two places: `autopilot.config.json` and
`knowledge/`. The rest of the engine does not change.

## What you need

- Node 20 or newer
- Claude Code
- A folder with a `samples/` or `content/blog/` directory for the articles to land in

```bash
npm install
cp autopilot.config.example.json autopilot.config.json
```

Then open the folder in VS Code with Claude Code and run:

```
/blog-autopilot --dry-run
```

That writes one full draft, prints the validator result, and publishes nothing.

## How a run works

1. **Pick a topic.** The money page with the fewest articles first, then the best
   unused keyword. DataForSEO if the credentials are set, the seeded backlog if not.
   The dedup check compares search intent against the ledger, not just the wording.
2. **Research.** Reads the pages already ranking and finds the angle they all miss.
3. **Write.** One article per run, following `rules/blog-posts.md` and the
   knowledge base. Structure rotation, citation rules, FAQs in frontmatter.
4. **Cover.** One 16:9 image through Kie.ai, in the house style described in
   `skills/kie-image-gen/SKILL.md`.
5. **Gate.** `validate-post.mjs` checks keyword placement, word count, money-page
   links, citations, FAQ shape, banned words and em dashes. An adversarial review
   subagent reads the draft afterwards. A failure leaves it as a draft.
6. **Ledger.** The topic is logged so it is never written twice.

Every integration degrades on its own. No DataForSEO means the backlog is used.
No Kie.ai key means no cover. The article is still written either way.

## The knowledge base

`knowledge/` is what makes the articles IdeoLab's rather than generic. It is read
at the start of every run, in this order:

| File | What it holds |
|---|---|
| `brand-brief.md` | The short writer brief: positioning, the two audiences, vocabulary, claim rules |
| `feature-index.md` | One paragraph per capability. Pick one, then read its full section in the source of truth |
| `marketing-source-of-truth.md` | The full capability reference: use cases, FAQs, search intent |
| `icp-profile.md` | Side A and Side B: pain hierarchy, objections, messaging rules |
| `voice-guide.md` | Tone, sentence rhythm, the phrases to avoid |

Only capabilities that appear in those files may be described. Nothing about the
product is invented, and no result or testimonial is ever made up.

## What to edit

| File | Why |
|---|---|
| `autopilot.config.json` | Site URL, money pages, categories, author, word range, link budget, the approved call to action |
| `rules/blog-posts.md` | Content policy: structure, headings, openings, closings, link rules, cover rules |
| `skills/kie-image-gen/SKILL.md` | The cover house style. Read this before changing how covers look |
| `memory/topic-backlog.template.md` | The topic backlog, one cluster per money page |

## Configuration reference

All in `autopilot.config.json` ([example](autopilot.config.example.json)):

| Key | Purpose |
|---|---|
| `site.name` / `site.url` / `site.description` | Brand identity and the base URL for verification |
| `paths.*` | Article dir, images dir, ledger, backlog, blog URL prefix |
| `content.author` | Exact byline string, enforced by the validator |
| `content.categories` | Allowed category values |
| `content.moneyPages` | Pages every article must link to, trailing `/` means prefix match |
| `content.minWords` / `maxWords` | Body word range |
| `content.links` | How many external, internal and promotional links an article carries |
| `content.cta` | The approved next step. Nothing else may be offered |
| `content.bannedWords` | Phrases that must never appear |
| `content.banEmDashes` | Reject em dashes, on by default |
| `content.faqs` | Require FAQ frontmatter, rendered as FAQPage JSON-LD |
| `content.citations.min` | Minimum external primary-source links |
| `content.audience` / `content.voiceNotes` | Who reads this and how it should sound |
| `keywords.locationCode` / `languageCode` | DataForSEO targeting, 2840 is the US |
| `cover.*` | Cover generation toggle, aspect ratio, house style notes |
| `git.branch` | Branch to sync and push |

## Environment variables

Put these in a `.env` beside the config. It is gitignored.

| Variable | Required | Used for |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes, or a Claude Code subscription login | The writing agent |
| `KIE_AI_API_KEY` | no | Cover image generation |
| `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD` | no | Keyword volume and difficulty scoring |

## The skills

| Skill | What it does |
|---|---|
| `blog-autopilot` | The full run: topic, research, write, cover, gate, ledger |
| `kie-image-gen` | Generate one image on its own, in the house style |
| `dataforseo-keywords` | Score keywords on its own |

The last two work without running the full loop, so any session in the folder can
generate a cover or check a keyword.

## Design notes

See [docs/DESIGN.md](docs/DESIGN.md) for the architecture and the reasoning behind
the quality gates.

## License

MIT
