# Handoff — Ingest Tokyo-only restaurants & cafes into Supabase

**Status:** ready to execute
**Scope:** Data provisioning only. Run the existing ingest + enrich pipeline against a real Supabase project so the app serves a live central-Tokyo deck instead of the 10 fixtures. **No app code changes required** — the providers already read the real backend when the env vars are set.
**Launch scope:** **Tokyo only**, the east-side Kinshicho/Sumida beachhead. Do **not** widen coverage without an explicit ask (see §6). Cloud sync stays **off** (`CLOUD_SYNC_ENABLED=false`) — nothing here touches auth.

---

## 1. Goal in one sentence

Populate the Supabase `places` table with ~200–350 real central-Tokyo food-and-drink places (restaurants, cafes, bars, bakeries, dessert shops) from Google Places, each tagged with LLM taste tags, so `npm run web`/`npm run ios` serves a live personalized deck.

## 2. Read these first

- **`docs/runbook-real-data.md`** — the authoritative step-by-step (accounts, keys, caps, seeding, troubleshooting). This handoff is the condensed execution path; the runbook is the reference. When they disagree, the runbook wins.
- `scripts/ingestPlaces.ts` — the Google Places → `places` ingest (grid, food-type filter, TOS-safe refresh).
- `scripts/enrichPlaces.ts` + `src/providers/llmEnrichment.ts` — the offline Anthropic tagging pass.
- `supabase/schema.sql` — the tables + RLS policies to apply.
- `src/config/env.ts` — how the app decides real-backend vs. fixtures (`isRealBackendConfigured`).

## 3. What must NOT change (guardrails)

- **Don't edit the pipeline scripts** to get this working. They are complete and tested. The only thing missing is real credentials + a Supabase project.
- **Don't commit secrets.** `.env` is gitignored; keep it that way. The `service_role` key and `ANTHROPIC_API_KEY` are **server-side only** — never put them in an `EXPO_PUBLIC_*` var (that ships to clients).
- **Don't widen `BEACHHEAD_BOUNDS`** or lower `GRID_STEP_*` in `scripts/ingestPlaces.ts` for this task. Tokyo beachhead is the intended launch scope. Widening is a separate, cost-increasing decision (§6).
- **Don't force-refresh on a short schedule.** Google's TOS allows caching its fields for 30 days; the ingest already respects this (`needsRefresh`). `--force` is for a deliberate manual refresh, not a cron.
- **Set the spend caps BEFORE the first seed run** (§4.2). A Google *budget* only emails you — it does not stop spend; only per-API request quotas do.

## 4. Execution path

### 4.1 Human-only prerequisites (cannot be automated from this session)

These need account signups / dashboard clicks. If you're an agent without browser access, **stop and hand these back to the user** with the runbook links; everything after 4.3 you can drive from the CLI once `.env` exists.

1. **Supabase project** (region: Northeast Asia / Tokyo). Apply the entire `supabase/schema.sql` in the SQL Editor. Grab Project URL, `anon` key, `service_role` key. — runbook §1
2. **Google Cloud**: enable **Places API (New)** (not legacy "Places API"), create an API key, enable billing. — runbook §2
3. **Anthropic**: create an API key (used only by `enrich`). — runbook §3

### 4.2 Cap spend (do this before seeding) — runbook §4

- **Google:** set **Requests/day** (e.g. 500) and **Requests/minute** (e.g. 60) quotas on Places API (New). This is the hard ceiling. Add a $10/mo budget alert for visibility. Restrict the key to Places API (New) + your bundle ID.
- **Anthropic:** set a monthly spend limit (e.g. $5) in the console — this one actually stops calls.

### 4.3 Populate `.env`

```dotenv
# App (bundled, client-visible)
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=<google key>
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>

# Scripts only (server-side, NEVER bundled)
GOOGLE_PLACES_API_KEY=<google key>
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
ANTHROPIC_API_KEY=<anthropic key>
```

The scripts auto-load `.env` via `--env-file-if-exists`. The app-side `EXPO_PUBLIC_*` and the script-side unprefixed vars are **separate** — set both.

### 4.4 Seed

```bash
npm run seed:data      # = npm run ingest && npm run enrich
```

Or run the phases separately (both are safe to re-run — ingest skips rows fresh within 30 days; enrich only touches rows whose `tags` are still empty):

```bash
npm run ingest         # 36 searchNearby calls → places table
npm run enrich         # ~1 Place Details + 1 Anthropic call per untagged place
```

Expected output shape:

```
Ingest complete: N upserted, 0 skipped (fresh within 30 days).
Enrichment complete: N place(s) tagged.
```

## 5. Verify

1. **Supabase → Table Editor → `places`**: rows exist, `lat`/`lng` populated, `tags` arrays **non-empty** after enrich.
2. Expect **~200–350 rows** for the beachhead (36 overlapping 800m circles, deduped). Far fewer (e.g. <50) means the grid or key is wrong; ~0 means RLS/key/billing.
3. **Run the app:** `npm run web`. If you still see the 10 placeholder cards, an `EXPO_PUBLIC_*` var is missing or the dev server wasn't restarted after editing `.env`.
4. **Geography gotcha:** the deck only shows places within ~1km of your location, and all data is central Tokyo. Testing from outside Tokyo → empty deck. On web, block location (falls back to the deck's Tokyo default) or spoof Chrome DevTools → Sensors → Location to `35.6969, 139.8146` (Kinshicho) and reload.

## 6. Cost & scope (what "Tokyo only" means here)

One seed run over the beachhead (~300 unique places):

| Phase | Calls | Rate | Cost |
|-------|-------|------|------|
| ingest | 36 Nearby Search (Enterprise) | ~$35/1k | ~$1.26 |
| enrich | ~300 Place Details w/ reviews (Ent+Atmosphere) | ~$25/1k | ~$7.50 |
| enrich | ~300 `claude-sonnet-5` | ~$3/1M in, ~$15/1M out | ~$2 (estimate) |

The ~$9 Google portion sits inside Google's free monthly allowance → real out-of-pocket ~$2. Ongoing cost for <10 users is dominated by lazy Place Photo loads (~$7/1k, client-cached). **To widen beyond the beachhead later:** grow `BEACHHEAD_BOUNDS` / lower `GRID_STEP_*`; cost scales linearly with seed-point count (each point = one $0.035 call). That is a deliberate follow-up, out of scope for this handoff.

## 7. Troubleshooting quick table (full list in runbook §Troubleshooting)

| Symptom | Cause / fix |
|---------|-------------|
| Deck empty despite real backend configured | `places` has RLS on with no read policy (anon reads 0 rows silently) — re-apply the policy from `schema.sql` §1. Or you're testing from outside Tokyo (see §5.4). |
| `searchNearby failed with status 403` | Places API (New) not enabled, billing off, or key restricted away from it. |
| `status 400` on searchNearby | Using the legacy Places API instead of Places API (New). |
| `places upsert failed 401/permission` | Scripts using the anon key instead of `service_role`. |
| Enrichment tags come back empty for many places | Places with no Google reviews; expected for obscure spots (prompt handles "(no reviews available)"). |
| Scripts exit `Missing required env vars` | `.env` absent or a *script* var (unprefixed) unset — the `EXPO_PUBLIC_*` ones are not what the scripts read. |

## 8. Definition of done

- `places` table has ~200–350 Tokyo rows with non-empty `tags`.
- `npm run web` (with location at/near Kinshicho) shows real places on the swipe deck, not the 10 fixtures.
- Spend caps are set on Google + Anthropic.
- No secrets committed; `.env` still gitignored.
