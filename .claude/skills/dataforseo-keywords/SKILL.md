---
name: dataforseo-keywords
description: Keyword research via the DataForSEO Labs API - keyword ideas with volume, difficulty, intent, and an opportunity score. Use when picking blog topics, evaluating keywords, or building topic clusters. Requires DATAFORSEO_LOGIN/PASSWORD; degrades to the manual topic backlog when unset.
---

# DataForSEO Keyword Research

Score keyword candidates for a seed term using the bundled script.

Script location: `scripts/blog-autopilot/keyword-ideas.mjs` when vendored into
this repo.

## Usage

```bash
node scripts/blog-autopilot/keyword-ideas.mjs "<seed keyword>" ["<seed2>" ...] --limit 50
```

Output: JSON with `candidates` sorted best-first by
`score = search_volume / (keyword_difficulty + 1)` - high-volume, low-competition
keywords float to the top. Each candidate includes `keyword`, `volume`,
`difficulty`, `score`, and `intent` (informational/commercial/transactional/navigational).

- Exit 3 = credentials unset. NOT an error: fall back to the manual topic backlog
  (`memory/autopilot/topic-backlog.md`).
- Exit 1 = API failure. Also fall back to the backlog.
- Location/language come from `autopilot.config.json` (`keywords.locationCode`,
  `keywords.languageCode`); defaults are 2840 (US) / en.

## Interpreting results

- **Blog topics:** prefer informational intent with score high relative to peers.
  Commercial/transactional keywords usually belong on money pages, not posts.
- **Always dedup against the ledger and existing slugs by search intent**, not
  string equality - "get X leads" and "X lead generation" are the same query.
- Volume under ~30/mo is usually not worth a dedicated post unless it is a
  high-ticket buyer keyword.

## Other useful endpoints (same Basic-auth pattern)

```bash
AUTH=(-u "$DATAFORSEO_LOGIN:$DATAFORSEO_PASSWORD" -H "Content-Type: application/json")

# Exact volume for a known keyword list
curl -s "${AUTH[@]}" -X POST https://api.dataforseo.com/v3/dataforseo_labs/google/bulk_keyword_difficulty/live \
  -d '[{"keywords":["kw1","kw2"],"location_code":2840,"language_code":"en"}]'

# What a competitor domain ranks for
curl -s "${AUTH[@]}" -X POST https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live \
  -d '[{"target":"competitor.com","location_code":2840,"language_code":"en","limit":100}]'

# Live SERP for a keyword (who currently ranks)
curl -s "${AUTH[@]}" -X POST https://api.dataforseo.com/v3/serp/google/organic/live/regular \
  -d '[{"keyword":"kw","location_code":2840,"language_code":"en"}]'
```

Common location codes: 2840 US, 2826 UK, 2124 Canada, 2036 Australia, 2586 Pakistan.
