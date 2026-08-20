# Runbook: Provisioning Real Tokyo Data

This gets the app off the 10 hardcoded fixtures and onto a real curated
central-Tokyo place database with LLM taste tags. After this, `npm run web`
(or an iOS build) serves a live deck instead of placeholders.

Everything in the app talks to Supabase over its REST API (PostgREST) and
Supabase Auth over REST using plain `fetch` — there is **no** `@supabase/supabase-js`
dependency to install. The only tooling added for this runbook is `tsx`
(already installed) to run the TypeScript data scripts.

**Time:** ~30–45 min, most of it waiting on account signups.
**Cost:** a few dollars at most, and cappable — see [step 4](#4-cap-your-spend-do-this-before-seeding) and [Costs](#costs--tos).

---

## What you'll end up with

| Piece | Where it lives | Populated by |
|-------|----------------|--------------|
| `places` table (place_id, name, category, price, rating, lat/lng, photo ref) | Supabase Postgres | `npm run ingest` (Google Places) |
| `tags` column (LLM vibe/specialty tags) | same `places` rows | `npm run enrich` (Anthropic) |
| `taste_graphs` table (per-user graph, RLS-protected) | Supabase Postgres | the app, after Apple sign-in |
| App reads the deck | `EXPO_PUBLIC_*` env in `.env` | you, in step 4 |

---

## 0. Prerequisites

- Node 20.6+ (you have v22 — needed for the `--env-file` script loader).
- Accounts you'll create below: **Supabase**, **Google Cloud**, **Anthropic**.
- `npm install` already run (it has been).

---

## 1. Create the Supabase project + apply the schema

1. Go to <https://supabase.com> → new project. Pick a region near Tokyo
   (e.g. `Northeast Asia (Tokyo)`) and set a database password.
2. Once it provisions, open **SQL Editor** → **New query**, paste the entire
   contents of [`supabase/schema.sql`](../supabase/schema.sql), and **Run**.
   This creates:
   - `places` — the curated deck. **RLS is on with a public read policy**, so
     the app's anon key can read the deck while only the service-role key
     (used by the scripts) can write to it.
   - `taste_graphs` — per-user graph, **Row Level Security on**, so a user can
     only read/write their own row.
3. Grab your keys from **Project Settings → API**:
   - **Project URL** → `SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_URL`
   - **`anon` public key** → `EXPO_PUBLIC_SUPABASE_ANON_KEY` (safe to ship in the app)
   - **`service_role` secret key** → `SUPABASE_SERVICE_ROLE_KEY`
     (server-side only — the ingest/enrich scripts use it to bypass RLS.
     **Never** put this in an `EXPO_PUBLIC_*` var; it would ship to clients.)

> **Why `places` needs its read policy.** With RLS enabled but no policy, the
> anon key's `SELECT` returns **zero rows with no error** — which surfaces in
> the app as a silent empty deck (no cards, no tiles), not an obvious failure.
> `schema.sql` therefore ships the policy below, so a clean paste of the schema
> already makes the deck client-readable. If you provisioned an earlier project
> whose `places` had RLS on but no policy, run this once to fix it:
> ```sql
> alter table places enable row level security;
> create policy "Places are publicly readable" on places for select using (true);
> ```

## 2. Google Places API (New)

1. <https://console.cloud.google.com> → create a project (or reuse one).
2. **APIs & Services → Library** → enable **Places API (New)**
   (the scripts call `places.googleapis.com/v1/...`; the legacy "Places API"
   is a different product and will 404).
3. **Credentials → Create credentials → API key.**
4. Restrict it: **API restrictions → Places API (New)**. For the ingest
   script (server-side) an unrestricted-by-referrer key is fine; for the key
   you ship in the app you may add application restrictions later.
5. Enable billing on the project (Google requires it even inside the free
   tier). This key becomes both `GOOGLE_PLACES_API_KEY` (scripts) and
   `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` (app, for lazy photo/detail fetches).

## 3. Anthropic API key (for enrichment)

1. <https://console.anthropic.com> → **API Keys** → create a key.
2. This is `ANTHROPIC_API_KEY`. It is used **only** by `npm run enrich`
   (server-side, offline). It is never bundled into the app.
   The enrichment model defaults to `claude-sonnet-5`.

## 4. Cap your spend (do this BEFORE seeding)

Both APIs are pay-as-you-go. Set hard ceilings first so a mistake, a runaway
loop, or a leaked client key can't run up a bill. For this app the real usage is
tiny (a one-time ~100-call seed, then a handful of calls per user session), so
these caps cost you nothing in practice — they're pure insurance.

### Google: quota caps are the real ceiling (a budget is NOT)

**Key fact:** a Cloud Billing **budget only sends alert emails — it does not stop
spend.** The thing that actually caps the bill is a **per-API request quota**,
because cost = requests × price. Cap the requests and you cap the bill, hard.

1. **Cap requests/day (the hard ceiling).**
   Cloud Console → **APIs & Services → Places API (New) → Quotas & System
   Limits** (or **Google Maps Platform → Quotas**). Filter for
   **"Requests per day"**, edit it down to e.g. **500/day**, and also set
   **"Requests per minute"** to something low (e.g. **60**). Past the cap the
   API returns a quota error instead of charging you. Max monthly spend is then
   roughly `daily cap × price × 30`, and you picked the daily cap.
   - Recommended for a single-user MVP: **500/day**, **60/min**.
2. **Set a budget alert for visibility** (not protection).
   Billing → **Budgets & alerts** → new budget, e.g. **$10/month**, alerts at
   50/90/100%. This just emails you; the quota cap above is what stops spend.
3. **Restrict the key** so a leak can't be abused (the app ships a *public*
   `EXPO_PUBLIC_*` key in its bundle):
   - **API restriction → Places API (New) only** — a stolen key can't touch
     pricier Maps APIs.
   - **Application restriction** → HTTP referrers (web) / bundle ID (iOS) so it
     only works from your app.

### Anthropic: a usage limit that actually stops calls

Unlike Google's budget, Anthropic's console limit is a real shutoff.

1. <https://console.anthropic.com> → **Settings → Limits** (or **Billing →
   Usage limits**) → set a **monthly spend limit**, e.g. **$5**. Calls are
   rejected once you hit it.
2. Enrichment is ~1 short `claude-sonnet-5` call per untagged place (~100 total
   for the default seed), so a few dollars covers it with room to spare.

### Supabase

Free tier is ample for the MVP and has no per-request billing to run away. If
you later upgrade, set a **spend cap** in the org billing settings.

## 5. Populate `.env`

Copy the template and fill in every value:

```bash
cp .env.example .env
```

```dotenv
# --- App (bundled, client-visible; must all be set or App.tsx falls back to fixtures) ---
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=<your google key>
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your anon key>

# --- Scripts only (server-side, NEVER bundled) ---
GOOGLE_PLACES_API_KEY=<your google key>
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your service_role key>
ANTHROPIC_API_KEY=<your anthropic key>
```

`.env` is gitignored. The scripts auto-load it via `--env-file-if-exists=.env`;
the Expo dev server picks up `EXPO_PUBLIC_*` automatically on `npm run web`.

## 6. Seed the database

```bash
npm run seed:data      # = npm run ingest && npm run enrich
```

Or run the two phases separately:

```bash
npm run ingest         # Google Places -> places table
npm run enrich         # Anthropic tags -> tags column (only untagged rows)
```

Expected output:

```
Ingest complete: N upserted, 0 skipped (fresh within 30 days).
Enrichment complete: N place(s) tagged.
```

**Both are safe to re-run.** Ingest skips rows refreshed within 30 days
(pass `--force` via `npm run ingest -- --force` to refresh anyway, respecting
Google's TOS caching window). Enrich only processes rows whose `tags` are still
empty, so it never re-bills the LLM for a place already tagged.

**Volume note:** the ingest seed grid is the **Kinshicho/Sumida beachhead** —
a 6×6 grid of overlapping 800m search circles tiling `BEACHHEAD_BOUNDS`, so
**36 `searchNearby` calls per run** returning up to 20 places each, deduped to
roughly **200–350 unique food places**. That's the deliberate launch scope
(**Tokyo only**, east-side beachhead), enough to feel real personalization,
not the PRD's 15–20k city-wide target. To widen coverage later, grow
`BEACHHEAD_BOUNDS` (or lower `GRID_STEP_*`) in
[`scripts/ingestPlaces.ts`](../scripts/ingestPlaces.ts) — the API caps each
`searchNearby` at 20 results, so more coverage = more seed points = more calls.

**Cost of one seed run (Tokyo beachhead, ~300 unique places):**

| Phase | Calls | SKU / rate | Cost |
|-------|-------|-----------|------|
| `ingest` | 36 Nearby Search | Enterprise, ~$35/1k | ~$1.26 |
| `enrich` | ~300 Place Details (`reviews`) | Enterprise+Atmosphere, ~$25/1k | ~$7.50 |
| `enrich` | ~300 `claude-sonnet-5` calls | ~$3/1M in, ~$15/1M out | ~$2 (estimate) |

The ~$9 of Google usage sits inside Google's free monthly allowance, so
real out-of-pocket for a seed is ~$2 (the Anthropic calls). **Ongoing** cost
for a handful of users is dominated by lazy Place Photo loads (~$7/1k, cached
client-side) plus an optional monthly refresh re-ingest (~$1.26) — a few
dollars a month at most. Set the [step 4](#4-cap-your-spend-do-this-before-seeding)
caps before your first run regardless.

Verify in Supabase: **Table Editor → places** should show rows with non-empty
`tags` arrays.

## 7. Run the app against real data

```bash
npm run web            # or: npm run ios   (needs Xcode/simulator)
```

On boot, `App.tsx` calls `isRealBackendConfigured()`. With all three
`EXPO_PUBLIC_*` values set it uses `SupabasePlacesProvider`; miss any one and it
silently falls back to fixtures — so if you still see the 10 placeholder cards,
an `EXPO_PUBLIC_*` var is missing or the dev server wasn't restarted after
editing `.env`.

## 8. (iOS only) Sign in with Apple

> **Disabled for the initial release.** Cloud sync is gated off behind
> `CLOUD_SYNC_ENABLED = false` in [`src/config/features.ts`](../src/config/features.ts).
> The launch is a handful of users, so a per-device local store is enough and
> this avoids the Apple Services ID / Supabase Apple provider setup (and the
> dashboard config that currently 400s). The app runs fully local; no sign-in
> button appears anywhere.
>
> **To re-enable:** flip `CLOUD_SYNC_ENABLED` to `true` and rebuild — that one
> flag is the whole switch (the auth provider, sign-in prompt, Settings account
> row, and cloud store are all still in the codebase, gated on it). Then finish
> the Supabase Apple provider config below.

The anonymous → local-cache flow works everywhere, including web. Cloud sync
(`taste_graphs`) requires Apple sign-in, which only works on a real iOS build:

1. Supabase **Authentication → Providers → Apple**: enable it and fill in your
   Apple **Services ID** / Team ID / key (from the Apple Developer portal).
2. The app posts the Apple identity token to Supabase's
   `/auth/v1/token?grant_type=id_token` endpoint (no client library).
3. Build to a device/simulator with `npm run ios`. On web, the sign-in button
   is inert by design — test the graph/collection loop anonymously there.

---

## Costs & TOS

- **Google Places (New):** billed per request with a monthly free credit.
  Ingest is ~5 nearby calls; enrichment does 1 place-details call per place
  (~100). Well within the free tier for a single seed run.
- **Anthropic:** ~1 short `claude-sonnet-5` call per untagged place (~100).
  A few cents total.
- **Supabase:** free tier is ample for the MVP.
- **TOS:** we permanently store only `place_id` + our own `tags`. Google's
  cacheable fields (`rating`, `price_band`, `photo_reference`) carry a
  `refreshed_at` and the ingest refresh cycle keeps them under the 30-day
  caching limit. Don't defeat this by force-refreshing on a schedule shorter
  than needed.

## Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| Still seeing 10 placeholder cards | An `EXPO_PUBLIC_*` var missing, or dev server not restarted after editing `.env`. |
| Real backend is configured but the deck / onboarding grid is **empty** (no cards, no tiles) | Either (a) `places` has RLS on with no read policy — anon reads 0 rows silently; apply the policy in [step 1](#1-create-the-supabase-project--apply-the-schema). Or (b) you're **testing from outside Tokyo**: the deck only shows places within ~1km of your location, and all seed data is central Tokyo, so your real browser location filters everything out. Block location for the site (falls back to the Shibuya default), or spoof it in Chrome DevTools → **Sensors → Location** to `35.6595, 139.7005` and reload. |
| `Google Places searchNearby failed with status 403` | Places API (New) not enabled, or billing off, or key restricted away from it. |
| `... status 400` on searchNearby | Using the legacy Places API instead of Places API (New). |
| `Supabase places upsert failed with status 401/permission` | Using the anon key instead of `service_role` for the scripts. |
| Enrichment tags come back empty for many places | Place has no Google reviews; the prompt handles "(no reviews available)" and the LLM returns sparse tags. Expected for obscure spots. |
| Scripts exit `Missing required env vars` | `.env` absent or a script var unset. The app-side `EXPO_PUBLIC_*` vars are *not* what the scripts read — they need the unprefixed ones. |
