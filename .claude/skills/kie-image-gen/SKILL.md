---
name: kie-image-gen
description: Generate images (blog covers, thumbnails, illustrations) via the Kie.ai nano-banana-pro model. Use whenever this repo needs an AI-generated image - blog post covers, OG images, section illustrations. Requires KIE_AI_API_KEY; degrades to a fallback image when unset.
---

# Kie.ai Image Generation

Generate an image with Kie.ai's nano-banana-pro model using the bundled script.

Script location: `scripts/blog-autopilot/generate-cover.mjs` when vendored into
this repo.

## Usage

```bash
node scripts/blog-autopilot/generate-cover.mjs \
  --prompt "<crafted prompt>" \
  --out <output-directory> \
  --aspect 16:9 \
  --name cover
```

- Prints JSON: `{ok, path}` on success.
- Exit 3 = `KIE_AI_API_KEY` unset. This is NOT an error: use the site's fallback
  image (e.g. `/icon.svg` or an existing generic cover) and note `coverFallback=true`.
- Exit 1 = generation failed or timed out (3 min). Retry once with a simplified
  prompt; if it fails again, use the fallback image.
- Converts to `.webp` automatically when `cwebp` is installed; otherwise keeps `.png`.

## Crafting the prompt

**Look at the covers already on the site before writing anything.** They are in
the site's own blog image folder. Match them. A cover that does not sit beside
the existing set is wrong however good it looks on its own.

The house style for this site is a soft 3D render, not photography:

1. **Subject** - one clear object, centred, that says what the article is about at
   a glance. A document, a phone, a node with branches, an envelope. If a reader
   needs the headline to understand the picture, the subject is wrong.
2. **Material** - matte clay-like surfaces with gently rounded edges, soft ambient
   shadow beneath the object.
3. **Background** - a plain pale blue to white gradient. No room, no furniture, no
   scenery.
4. **Palette** - take it from the site stylesheet and name the hex values in the
   prompt. Here: brand blue #2f7cf0, light blue #8ebdff, ink navy #16283a for small
   details, and the CTA orange #f97316 as a small accent only.
5. **Framing** - centred with generous empty space, filling the whole 16:9 frame,
   no borders and no letterboxing.

Write the scene in `cover_brief` in one or two plain sentences first. The brief and
the prompt must say the same thing, and the brief is what the alt text comes from.

Hard rules:

- **No text in the image.** No letters, no numbers, no words, no logos. Text renders
  badly and the site overlays its own titles.
- **No people and no hands.** The site's covers do not use them.
- **No photography.** Documentary photography, dim light, dusty workshops and empty
  rooms were all rejected on this site. It is a product look, bright and clean.
- **Fill the frame** - no reserved margins, no letterboxing.
- Never a realistic user interface, a readable chart, a fake screenshot, a fake
  review card, or anything implying client proof. Simplified shapes are fine.
- Never a lightbulb, a handshake, or a rocket.

Repeat the same style block across every cover in a set so they read as one series,
and change only the subject line. Vary the subject enough that eight covers do not
look like eight versions of one picture.
## The style block to paste, unchanged

Every cover in the approved set was generated as one subject line followed by this
exact block. Do not paraphrase it. Change the subject line only.

```
Soft 3D render illustration in a clean modern product style. Matte clay like
surfaces with gently rounded edges, smooth even studio lighting, a soft ambient
shadow beneath the objects. The background is a plain very light blue to white
gradient with no scenery, no room, no furniture. The colour palette is limited to
bright blue, light sky blue, soft white, a deep navy for small details, and a
single warm orange used sparingly as an accent. No people, no hands, no text, no
letters, no numbers, no words, no logos, no branding, no realistic user interface,
no readable charts or figures. One clear central subject, centred with generous
empty space around it, filling the whole frame edge to edge with no borders and no
letterboxing.
```

## Worked subject lines

Three from the approved set, to show the level of detail a subject line needs.

**An article about writing case studies:**

> A single white document card floating upright in the centre at a slight angle,
> carrying one simple solid bar shape group in bright blue and a plain rising line
> above it. Behind it, three plain blank pages fanned out and slightly lower, in
> soft white. One warm orange pin holds the top corner of the front card. Nothing
> else in the frame.

**An article about website copy:**

> A rounded white browser window card floating in the centre at a slight angle,
> with three small navy dots in its top bar. Inside it, four plain rounded grey text
> lines of decreasing length and, below them, one solid bright blue rounded button
> shape with no text on it. A small warm orange cursor arrow rests on the button.
> Nothing else in the frame.

**An article about email newsletters:**

> An open 3D envelope in soft white and bright blue in the centre, seen at a slight
> angle, with a single plain rounded card lifting out of it and tilting towards the
> viewer. The card carries three short plain grey lines and, at its very bottom, one
> small warm orange underline. Nothing else in the frame.

The pattern is the same every time. Name the object, name what is on it in plain
shapes, place one orange accent, and close with "nothing else in the frame".

## After generating

The generator returns a large PNG. Make a 1600 by 893 JPEG copy beside it at around
quality 82, which lands between 40KB and 70KB. That is the version small enough to
send for review; the full size file is what goes on the site.
## Raw API (if you need something the script doesn't do)

```bash
# create
curl -s -X POST 'https://api.kie.ai/api/v1/jobs/createTask' \
  -H "Authorization: Bearer $KIE_AI_API_KEY" -H 'Content-Type: application/json' \
  --data-raw '{"model":"nano-banana-pro","input":{"prompt":"...","aspect_ratio":"16:9","resolution":"2K","output_format":"png"}}'
# poll data.taskId until data.state == "success", then download resultJson.resultUrls[0]
curl -s "https://api.kie.ai/api/v1/jobs/recordInfo?taskId=<id>" -H "Authorization: Bearer $KIE_AI_API_KEY"
```

Other models on the same endpoint (swap `model`): `nano-banana` (faster/cheaper),
`nano-banana-pro` (default, best quality). Aspect ratios: `16:9`, `1:1`, `9:16`, `4:3`, `3:4`.
