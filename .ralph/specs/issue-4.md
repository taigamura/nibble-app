# Issue #4: LLM enrichment pipeline (taste tags per place)

## Parent

#1 — Nibble MVP: taste-graph swipe app.

## What to build

Add the offline LLM enrichment pipeline that turns raw place data into the structured taste tags the recommender needs. Google's coarse `types` cannot distinguish a kissaten from a third-wave specialty bar from a chain; enrichment fixes that.

An `EnrichmentProvider` runs **once per place, offline, and caches the result permanently** in our DB (no LLM call at swipe time). It passes each place's name + reviews through an LLM to extract a structured tag record. Representative shape (from design discussion, not a hosted contract):

```json
{
  "vibe": ["minimal", "intense", "counter-seating"],
  "chain_or_indie": "indie",
  "specialty": "third-wave espresso",
  "good_for": ["solo", "quick"],
  "not_for": ["groups", "laptop-work"],
  "price_band": "mid",
  "noise": "quiet"
}
```

The `taste-engine` then ranks over these real tags instead of the placeholder tags used in #2, and the user preference vector is expressed over the enriched tag space. Optionally surface a short "why" for a recommendation derived from the matching tags.

## Acceptance criteria

- [ ] `EnrichmentProvider` tags each ingested place once from name + reviews and caches the tags permanently.
- [ ] Enrichment is a batch/offline step; no LLM call happens during swiping.
- [ ] The user preference vector and `rankDeck` fit score are computed over the enriched tag space.
- [ ] Deck ordering visibly reflects real vibe/specialty tags for a known synthetic taste profile.
- [ ] (Optional) A place can expose a short human-readable "why surfaced" derived from matching tags.
- [ ] Enrichment cost stays one-time per place; re-running does not re-tag already-tagged places.

## Blocked by

- #3 — Real place data: Google Places ingest + curated DB.

