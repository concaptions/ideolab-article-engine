// Pick a keyword whose article is not one the site already has, judged by
// meaning rather than by words.
//
// 21 October 2026: Strategic Marketer published "Which AI Use Cases Save Time
// Before You Buy More Tools?" and "Before You Buy More Tools, Choose AI
// Solutions That Save Time" on the same night. alreadyCovered() in keywords.mjs
// compares the words of a keyword with the words of each slug, and "ai use
// cases" and "ai solutions" share none, so both passed. To a reader they are
// one article. The same blind spot let "pdf summarizer" and "ai document
// analysis" sit side by side in the IdeoLab list.
//
// So the shortlist from remainingIdeas() goes to the writer model with every
// title on the site, and anything it says would teach the same thing is
// skipped. If the check itself fails, the run carries on with the first idea,
// as it did before this existed, rather than publish nothing.
import { remainingIdeas, existingPosts } from './keywords.mjs'
import { ask } from './write.mjs'
import { log } from './lib.mjs'

const SHORTLIST = 12

// Returns a Map of keyword (lower case) to the existing title it repeats.
// The first wording of this check was too keen: in a test it called "project
// management" the same article as "How a Marketing Workflow Stops Tasks From
// Getting Lost". A check that blocks good articles stops the nightly run, which
// is worse than the occasional overlap, so it now has to be sure.
export async function findRepeats(site, keywords, titles) {
  const reply = await ask([
    'These are the article titles already on ' + site.name + ':',
    ...titles.map(t => '- ' + t),
    '',
    'Below are candidate keywords for the next article. Mark a keyword as a repeat only when a reader who has',
    'already read one of the titles above would learn nothing new from an article for the keyword: the same',
    'main question and the same main advice, only in other words. Example of a repeat: "ai use cases" and',
    '"ai solutions" both ending up as "pick one job for AI before you buy more software". Not repeats: a shared',
    'subject with a different main question, such as market research and competitor analysis, or project',
    'management and a marketing workflow. When unsure, it is not a repeat.',
    'Return JSON only: {"same": [{"keyword": "...", "like": "<the existing title>"}]}, listing only repeats.',
    '',
    ...keywords.map(k => '- ' + k),
  ].join('\n'))
  const s = String(reply).replace(/^```(?:json)?\s*|\s*```$/g, '')
  const same = JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1)).same || []
  return new Map(same.map(d => [String(d.keyword).toLowerCase().trim(), d.like]))
}

export async function pickDistinct(site) {
  const kept = await remainingIdeas(site)
  if (!kept.length) {
    throw new Error('Nothing left for ' + site.name + '. Add topics to sites/' + site.key + '.json or raise seo.maxDifficulty.')
  }
  const titles = (await existingPosts(site)).filter(p => p.status === 'published' || p.status === 'draft').map(p => p.title)
  const shortlist = kept.slice(0, SHORTLIST)
  let pick = kept[0]
  try {
    const dup = await findRepeats(site, shortlist.map(c => c.keyword), titles)
    for (const c of shortlist) {
      if (dup.has(c.keyword.toLowerCase())) log('keyword', 'skipped "' + c.keyword + '", same article as "' + dup.get(c.keyword.toLowerCase()) + '"')
    }
    pick = shortlist.find(c => !dup.has(c.keyword.toLowerCase())) || kept[SHORTLIST] || null
    if (!pick) throw new Error('every idea on the shortlist repeats an existing article')
  } catch (e) {
    if (/every idea/.test(String(e.message))) throw new Error('Nothing new for ' + site.name + ': ' + e.message + '. Add topics to sites/' + site.key + '.json.')
    log('keyword', 'distinct check skipped, ' + String(e.message || e).slice(0, 120))
    pick = kept[0]
  }
  log('keyword', pick.keyword + '  ' + pick.volume + '/mo  difficulty ' + pick.difficulty + '  ' + pick.intent + '  trend ' + (pick.trend > 0 ? '+' : '') + pick.trend + '%')
  if (pick.secondary?.length) log('keyword', 'also covering: ' + pick.secondary.join(', '))
  return pick
}
