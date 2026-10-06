# Cover house style

One cover per article, generated from this file. The engine does not invent a
look per article. It picks the site block below, fills one slot with an object
taken from the article, and sends that as the prompt to
`scripts/blog-autopilot/generate-cover.mjs --aspect 16:9`.

Two reasons this file exists. Covers have to come out looking like the same
publication every day without anybody judging them by eye, and the blog cards
crop to 16:9, so anything square loses its top and bottom.

## Rules that apply to both sites

- 16:9 always. A square image gets cropped on the listing card.
- No text, no letters, no numbers, no logos anywhere in the image. Any writing
  on a prop is rendered as soft grey or gold bars that are not legible as words.
- No people, no faces, no hands.
- One idea per cover. Two or three objects at most, never a collage.
- Generous empty background. The title sits next to the image on the card, so
  the image needs quiet space rather than a full frame of detail.
- Realistic studio photography. No illustration, no cartoon, no flat vector.
- Keep the palette inside the site block. A colour that is not listed is a bug.
- Two samples per article at most. Credits are not free.

## Choosing the object

Start from the thing the article is about, not from a metaphor for it.

**1. Name the object from the article's own subject.** An article about
invoices gets an invoice. An article about a pitch deck gets slides. An article
about a job description gets a printed job posting. The reader has to be able
to name what they are looking at in one word, without reading the title first.

**2. Then give it the article's verb to perform.** The invoice is being
stamped paid. The slides are being laid out in order with one pulled forward.
The job posting is being marked up. Mid action, caught in the middle of the
work, never sitting still. A thing that is only lying there is decoration.

**3. Never invent a machine.** This is the mistake that produced the covers
rejected on 6 October 2026. The brief asked for a mechanism and the writer
invented one: "a navy stencil repeats a clean invoice layout onto cream
sheets", "a white card feeder is arranging cream slide cards". No such objects
exist, so the image came back as unreadable shapes. Banned outright: stencil,
feeder, dispenser, apparatus, rig, contraption, machine, press, and anything
else a reader could not buy or has never seen.

**4. The old abstractions stay banned.** Plain boxes, plain spheres, chips,
switches, envelopes and blank cards mean nothing and have been rejected before.

**5. If the subject has no physical form**, use the document, tool or paper the
work is actually done on. Marketing automation is a scheduled message on a
screen, not a flowing river of light.

Both sites use this same rule. Only the palette and the lighting differ.

## Site block: IdeoLab

Light, calm, practical. The reader is a small business owner, not an engineer.

```
Overhead flat lay photograph shot straight down onto a smooth pale ice blue
surface, colour #DCE9F2, lit by soft even daylight from the upper left with
gentle shadows falling to the lower right. {OBJECTS}. No other objects. Clean
minimal composition with generous empty pale blue space across the top third of
the frame. Realistic product photography, matte surfaces, soft natural shadows,
no glare or reflections. Colour palette limited to pale ice blue, white, cream,
navy #0B2559 and one medium blue accent #2F7CF0. No orange, no teal, no green,
no wood, no people, no hands, no logos, and no legible text or letters anywhere.
Wide 16:9 landscape composition.
```

Second composition, used when the subject is a place rather than a set of
objects: swap the first sentence for an eye level interior shot against a navy
wall in #0B2559 with daylight from one side, and keep everything after
`{OBJECTS}` as written.

Orange #F97316 is the site's call to action colour and never appears in a cover.

Worked examples:
- Workflow automation: a white conveyor belt carrying cream cards, a tray of
  cards waiting at one end, finished cards spilling at the other, one blue cable
  curled on the surface.
- Market research: printed sheets with one highlighted line, an open navy
  notebook, a blue sticky note, a phone showing a review list.
- Landing page: a phone in a stand showing one page with a single blue button,
  the same layout printed beside it.

## Site block: Strategic Marketer

Dark, premium, technical. The object is chosen exactly as it is for IdeoLab, by
naming the real thing the article is about and then giving it the article's
verb. Only the palette and the lighting change between the two sites. A machine part is allowed when the article is
about one, it is not the default.

```
Studio product photograph on a seamless dark navy background shading from
#0a0f1e at the top to #141c33 at the base. {OBJECTS}, rendered in matte brushed
gold, colour #e9b95c. Nothing else in the scene. Soft directional light from the
upper left, soft contact shadows, matte finish with no glare or sparkle. Camera
straight on at object height with the subject in the lower half. Generous empty
navy space filling the upper half of the frame. Realistic studio photography.
Palette limited to dark navy and brushed gold. No text, no letters, no logos, no
people, no wood, no office, no daylight. Wide 16:9 landscape composition.
```

Machine parts are available when they fit: microchips, circuit traces, boards,
sockets, modules, switches, levers, robotic arms, gears, connectors, panels with
faint gold lines standing in for a screen. This is a vocabulary, not a shortcut.
Reaching for a chip because the site is about AI is how four covers in a row came
back carrying no meaning.

Banned on this site, because they were tried and they read as vintage editorial
rather than as a technical publication: desk lamps, leather notebooks, open
books, stacks of paper, wooden tables, coffee cups, reading glasses, framed
letters, wax seals, fountain pens, warm lamp light, daylight through blinds.

Also rejected, 5 October 2026: a chip, a switch or an envelope used as a general
stand in for technology, and blank cards, plates or geometric blocks arranged
tidily. In both cases the object was not doing anything, so the cover meant
nothing.

Worked examples:
- AI content creation: a gold microchip with an audio waveform rising out of it,
  traces running wide across the surface.
- AI consulting: a gold magnifying glass raised over a gold circuit board, the
  traces under the lens visibly larger than those around it.
- Something that keeps running after the consultant leaves: a gold module seated
  in its socket with one lit indicator and traces continuing off frame.
- Prompt engineering, write it once and reuse it: a gold index card carrying a
  written instruction, being copied onto two more cards beside it that already
  carry the same lines.
- Marketing automation, one trigger and the rest follows: a gold phone handset
  with a sent message on its face and two more messages queued behind it.
- Employee onboarding: a gold checklist on a clipboard with the first three
  lines ticked and the pen still resting on the fourth.

Note on these, 6 October 2026: the stencil, the dominoes and the tap that used
to be listed here are gone. They are metaphors for a mechanism, not the thing
the article is about, and the writer copied the word "stencil" straight into an
invoice cover. Rule 3 above bans them now.

## Check before publishing

- 16:9, and the subject survives a centre crop.
- No readable text anywhere in the frame.
- Every colour in the image is in the site block.
- The object is the mechanism the article teaches, not a generic prop.
- On Strategic Marketer, nothing from the banned list is in the frame.
