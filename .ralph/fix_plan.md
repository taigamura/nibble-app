# Ralph Fix Plan (queue item)

## Current Task
- [x] Implement GitHub issue #4
  - Spec: .ralph/specs/issue-4.md

Notes: LlmEnrichmentProvider (src/providers/llmEnrichment.ts) fetches Google
Place Details reviews + calls the Anthropic Messages API, offline only, via
scripts/enrichPlaces.ts (selects rows with tags=eq.[], PATCHes flattened
tags back). Also fixed a latent bug in scripts/ingestPlaces.ts where a
re-ingest refresh cycle would have reset tags back to [] and wiped
enrichment; it now carries forward existing tags. Added whySurfaced() to
src/taste-engine as the optional "why surfaced" explanation.
