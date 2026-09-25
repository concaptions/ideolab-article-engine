# Blog Post Rules

These rules govern every post the autopilot (or a human) writes for this site.
Site-specific values (author, categories, money pages, word count, banned words)
live in `autopilot.config.json` at the repo root - this file covers structure,
voice, and quality. Where the two disagree, the config wins.

> Sections marked **[adjust to your renderer]** describe the Next.js blog template
> this system was built against. If your blog renders differently, edit those
> sections to match - the autopilot follows what is written here.

## IdeoLab knowledge base (read before anything else)

This blog is written from David's two documents, converted to markdown in
`knowledge/`. Read in this order, every run:

1. `knowledge/brand-brief.md` - the short writer brief: positioning, the two
   audiences, vocabulary, claim rules, banned phrases, David's format numbers.
2. `knowledge/feature-index.md` - one paragraph per capability. Pick ONE
   capability for the article, then read its full section in
   `knowledge/marketing-source-of-truth.md` (use cases, FAQs, search intent).
3. `knowledge/icp-profile.md` - the Side A or Side B chapters for the chosen
   audience: pain hierarchy, objections, messaging rules, messaging angles.

Only describe capabilities that appear in those files. Never state counts,
limits or availability as permanent. Never invent results or testimonials.

### IdeoLab-specific format (David, 22 Sep 2026)

- Each article is written for ONE side. Frontmatter `audience_side` is `"A"`
  (agency and growth operators) or `"B"` (business owners and in-house).
- 1,400 to 1,800 words. 6 to 8 H2 sections. 4 to 7 FAQs in frontmatter.
- Links, per David on 24 September: 1 to 2 external, 1 to 2 internal to other
  articles, 1 to 2 promotional to the next step. Not 5 to 10 internal links.
- The approved next step right now is the free 7 day trial at https://www.ideolab.ai/trial.
  Do not invent any other offer, discount or deadline.
- Use more than H2. Genuine subsections get H3. Use the renderer callouts
  `[!tip]`, `[!warning]`, `[!info]`, `[!note]`, `[!important]`, not a plain bold
  blockquote. Use a table when there is a real comparison, 3 columns at most.
- At least 2 external citations to real, verified sources.
- Cover image generation is ON (Kie key in `.env` as `KIE_AI_API_KEY`). Describe
  the cover in `cover_brief` first (subject, setting, mood, no text in the image),
  then generate it. `image` must point at the file that actually exists: webp when
  a converter is available, otherwise the png the generator produced.
- Use IdeoLab vocabulary exactly: Business, Lab, Canvas, Card, Source, Chat,
  Connected context, Assistant, Skill, Creation, Creative Brief, Studio, Automation.
- The product appears only after the reader has recognized the problem. At
  least one detailed use case and one broader workflow example per article.

## File Location

`<paths.blogDir>/[slug].md` - images in `<paths.imagesDir>/[slug]/`.

Only posts with `status: "published"` render publicly. Drafts return 404 and are
excluded from the index, sitemap, and llms.txt. **[adjust to your renderer]**

---

## Frontmatter Contract

The autonomous writer and the validator both depend on this exact shape. Do not
add, rename, or omit fields beyond what the config's `requiredFrontmatter` lists.

```yaml
---
title: "Post Title"
date: "YYYY-MM-DD"
excerpt: "1-2 sentence summary. Used in listings and the meta description."
author: "<content.author - always exactly this string>"
category: "<one of content.categories>"
image: "/images/blog/[slug]/cover.webp"
tags: ["tag1", "tag2"]
status: "published"     # or "draft"
featured: false         # optional; at most one featured post at a time
faqs:                   # required if content.faqs.required - see below
  - question: "Question phrased the way a reader would search it?"
    answer: "Plain-English answer, 2-4 sentences, no markdown."
---
```

FAQ rules (when `content.faqs.required`): 3-5 `question`/`answer` objects. The
renderer shows them as a visible FAQ section after the article AND emits FAQPage
JSON-LD from the same data - the schema depends on this field. Do NOT also write
a `## FAQ` heading in the body. Answers are plain text (no markdown, no links).
**[adjust to your renderer]**

Never invent team members, bylines, author roles, or author photos.

---

## Hard Copy Rules

1. **No em dashes ever** (when `content.banEmDashes`). Use a hyphen with spaces
   ` - ` instead. Applies to titles, excerpts, body, alt text, everything.
2. **No fabricated proof.** Never invent client results, named customers, review
   quotes, star ratings, or performance stats. Allowed instead: industry facts,
   process explanations, and how-to content. Cite general industry knowledge as
   such, not as our track record.
3. **No fake links.** Every internal href must resolve to a real route on this
   site. External links only to real, verifiable URLs. When unsure, leave it out.
4. Never mention any word in `content.bannedWords` (sister brands, forked-from
   brands, acquisition channels).

---

## Citations & Statistics

Every post includes at least `content.citations.min` external citations to primary
sources, linked inline with descriptive anchor text: platform documentation
(Google, Meta, the tools your audience uses), industry bodies, government data
(BLS, Census, NOAA), or named research with a verified URL.

- **Every stated statistic either links to its source or is explicitly labeled
  illustrative** ("illustrative numbers", "as an example, say..."). No orphan stats.
- Never launder a guess into a fact. If no source exists, reframe as reasoning
  or drop the claim.

---

## Audience & Voice

Write for the reader described in `content.audience`, in the register described
in `content.voiceNotes`. Universal rules:

- Plain English. If a term needs a glossary, rewrite it.
- Outcome-led: results the reader can see, not vanity metrics.
- Show, do not scold. Open on a situation, a number or a thing that happened. Never
  open by telling the reader what they are doing wrong, and never spend a section on it.
- Confident without hyperbole. No "10x overnight" claims.

---

## Internal Linking

**Every post must contextually link to at least one money page** from
`content.moneyPages`, with descriptive anchor text woven into a sentence. That link plus the closing
call to action is usually the whole promotional budget.

Keep the total link budget small. David on 24 September: do not use 5 to 10
internal links. One post carries 1 to 2 external citations, 1 to 2 links to other
articles that actually exist, and 1 to 2 promotional links to the next step.

- Internal links are always relative (`/services`, not the full domain).
- Descriptive anchors: "a complete growth system for X", never "click here".
- Link where it genuinely helps the reader; do not bolt a link onto the last
  paragraph as an afterthought.
- Linking to other blog posts is encouraged - but only to slugs that actually
  exist in the blog dir.

---

## Mobile-First Content Rules

### Code blocks: only for actual code
Fenced code blocks are ONLY for real, runnable code or config. They do not wrap
on mobile. Never use them for example scripts/messages (use blockquotes), step
sequences (use numbered lists), or anything that is prose.

### No ASCII diagrams
They break on every phone. If a visual is needed, ship a real image in the slug
folder and embed it with descriptive alt text.

### Tables: keep them narrow
Max 3 columns with short cells. If wider, split into multiple tables or convert
to a list.

### Short paragraphs
1-3 lines per paragraph. Single-sentence paragraphs are fine. Readers skim.

---

## Markdown Features **[adjust to your renderer]**

The reference renderer is remark + remark-gfm producing HTML, with post-processing:

- **Headings:** `##` (H2) and `###` (H3) get anchor IDs; 3+ headings produce a
  desktop table of contents. Never use H1 in the body (the title is the H1).
- **GFM:** tables, task lists, strikethrough, autolinks.
- **Callouts:** blockquotes starting with `[!tip]`, `[!warning]`, `[!info]`,
  `[!note]`, or `[!important]` render as styled callout cards.
- **Images:** standard markdown images with descriptive alt text.
- **Reading time** is computed automatically - never write "5 min read".
- NOT supported: raw MDX/JSX, footnotes, embeds, mermaid.

---

## Cover Images

- Every post ships a cover at `cover.aspectRatio` (default 16:9), saved as
  `cover.webp` in `<paths.imagesDir>/[slug]/`, referenced by frontmatter `image`.
- Covers are illustrative - never fake screenshots of results, fake review cards,
  or anything implying client proof. Follow `cover.styleNotes`.
- The house style is the one already on the site in `public/images/blog`: a soft
  3D render of one clear object on a pale blue to white background, no people, no
  photography, no text. Look at those files before writing a prompt. A cover that
  needs the headline to make sense is the wrong cover.
- Additional in-post images live in the same slug folder, kebab-case, webp preferred.

---

## Content Structure

### Opening
Hook with a specific, recognizable pain or scenario. No "In this article we will...".
Optional short TL;DR bullet list after the intro.

### Body
H2 sections that each answer one question. Concrete steps the reader can act on
this week, not theory. Callouts for tips and warnings instead of bolded asides.

### Closing
Summarize the takeaway in 2-3 lines, end with a next step. If the page template
already appends a CTA after every article, the closing does not need its own hard
sell - a natural pointer to a money page is enough.

### Structure Rotation (Required)

Sameness across a set is the failure the client names first. Before writing, read
the opening, the closing and the full heading list of the last three posts, and
pick a different shape for each. Rotation applies across a batch, not only to the
previous post.

**Opening patterns (rotate between):**
1. **A thing that happened** - one real situation, with the detail that makes it real:
   a date, a count, a sentence somebody actually said.
2. **Contrarian claim** - challenge a common belief, then defend it.
3. **Concrete math** - open with a number the reader can check against their own situation.
4. **Quoted material** - open with the words themselves: the question that was asked,
   the list that was written, the line that kept appearing.

Never open in the second person by narrating what the reader is doing wrong. "You
said yes to the fourth client and started writing a job ad" is the shape to avoid.
Across a batch, no two articles may use the same opening pattern back to back, and
no two may open with the same grammatical frame, for example "A florist in Norwich"
followed by "A garage in Dudley".

**Closing patterns (rotate between):**
1. **This-week checklist** - 3-4 concrete actions the reader can do before Friday.
2. **Decision frame** - "if X is true for you, do A; if Y, do B", pointing each branch at the right money page.
3. **One-number takeaway** - restate the single metric to track and how to check it.
4. **Return to the opening** - finish the situation the article started with, and say
   what it cost or bought.

A limitation belongs in the article only where it is specific to that subject, and
it belongs inside the relevant section. Never add a standing "what this does not
fix" section, and never give two articles in the same batch the same closing
heading.

**Headings:**

Headings carry the argument, so they get the same rotation discipline as openings.
Do not build them on one construction. In particular, "X, not Y" is allowed at most
once per article and never as a set habit, and the same applies to "X is not the
problem, Y is". Read the headings on their own before publishing: if they could be
swapped into another article in the batch without anyone noticing, rewrite them.

**Examples:**

One real example per article, carried through rather than mentioned once. A named
trade, a place, a count, a date. A hypothetical introduced with "say you run a" or
"imagine a business that" is not an example and does not count.

---
## Naming Conventions

- **Slug:** kebab-case, descriptive, keyword-bearing.
- **Image folder:** matches the slug exactly.
- **Cover:** `cover.webp` inside the slug folder.

---

## Quality Checklist

Before setting `status: "published"`:

- [ ] Frontmatter matches the contract exactly (all required fields, no extras)
- [ ] `faqs:` array present with the configured count (if required); no `## FAQ` body section
- [ ] Category is in the allowed set
- [ ] Zero em dashes anywhere in the file (if banned)
- [ ] No fabricated clients, testimonials, results, or stats
- [ ] External citations meet the configured minimum; every statistic linked or labeled illustrative
- [ ] Topic is not a near-duplicate of an existing post (ledger + slugs checked for topical overlap)
- [ ] Opening pattern, closing pattern and heading shapes differ from the last three posts
- [ ] No article opens by telling the reader what they are doing wrong
- [ ] Headings read on their own and could not be swapped into another post in the batch
- [ ] One real carried example, not a hypothetical
- [ ] At least one contextual money-page link with descriptive anchor text
- [ ] All internal links relative and pointing at routes that exist
- [ ] Cover generated at the right aspect ratio and referenced in frontmatter
- [ ] No ASCII diagrams; no code blocks for non-code content
- [ ] Tables 3 columns or fewer; paragraphs 1-3 lines; headings H2/H3 only
- [ ] All images have descriptive alt text
- [ ] Proofread; plain English; outcome-led
