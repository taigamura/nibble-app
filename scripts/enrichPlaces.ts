/**
 * One-time (re-runnable) offline enrichment: tags every curated place that
 * doesn't have tags yet with LLM-derived vibe/specialty taste tags, and
 * persists them permanently in Supabase. See issue #4.
 *
 * Run with real credentials (loads .env, then `npm run enrich`), e.g.:
 *   ANTHROPIC_API_KEY=... GOOGLE_PLACES_API_KEY=... SUPABASE_URL=... \
 *     SUPABASE_SERVICE_ROLE_KEY=... npm run enrich
 *
 * Re-running is safe and cheap: only rows with empty `tags` are selected,
 * so already-tagged places are never re-sent to the LLM.
 */
import { LlmEnrichmentProvider } from '../src/providers/llmEnrichment';

interface UntaggedPlaceRow {
  place_id: string;
  name: string;
  category: string;
}

async function fetchUntaggedPlaces(
  supabaseUrl: string,
  serviceRoleKey: string,
  fetchImpl: typeof fetch,
): Promise<UntaggedPlaceRow[]> {
  const url = new URL(`${supabaseUrl}/rest/v1/places`);
  url.searchParams.set('select', 'place_id,name,category');
  url.searchParams.set('tags', 'eq.[]');

  const response = await fetchImpl(url.toString(), {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  if (!response.ok) {
    throw new Error(`Supabase untagged places lookup failed with status ${response.status}`);
  }
  return (await response.json()) as UntaggedPlaceRow[];
}

async function persistTags(
  placeId: string,
  tags: string[],
  supabaseUrl: string,
  serviceRoleKey: string,
  fetchImpl: typeof fetch,
): Promise<void> {
  const url = new URL(`${supabaseUrl}/rest/v1/places`);
  url.searchParams.set('place_id', `eq.${placeId}`);

  const response = await fetchImpl(url.toString(), {
    method: 'PATCH',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ tags }),
  });

  if (!response.ok) {
    throw new Error(`Supabase tag update failed for ${placeId} with status ${response.status}`);
  }
}

export async function runEnrichment(options: {
  anthropicApiKey: string;
  googlePlacesApiKey: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  fetchImpl?: typeof fetch;
}): Promise<{ tagged: number }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const provider = new LlmEnrichmentProvider({
    anthropicApiKey: options.anthropicApiKey,
    googlePlacesApiKey: options.googlePlacesApiKey,
    fetchImpl,
  });

  const untagged = await fetchUntaggedPlaces(options.supabaseUrl, options.supabaseServiceRoleKey, fetchImpl);

  let tagged = 0;
  for (const row of untagged) {
    const tags = await provider.enrich({ id: row.place_id, name: row.name, category: row.category });
    await persistTags(row.place_id, tags, options.supabaseUrl, options.supabaseServiceRoleKey, fetchImpl);
    tagged += 1;
  }

  return { tagged };
}

/* eslint-disable no-console */
if (require.main === module) {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const googlePlacesApiKey = process.env.GOOGLE_PLACES_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!anthropicApiKey || !googlePlacesApiKey || !supabaseUrl || !supabaseServiceRoleKey) {
    console.error(
      'Missing required env vars: ANTHROPIC_API_KEY, GOOGLE_PLACES_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY',
    );
    process.exit(1);
  }

  runEnrichment({ anthropicApiKey, googlePlacesApiKey, supabaseUrl, supabaseServiceRoleKey })
    .then(({ tagged }) => {
      console.log(`Enrichment complete: ${tagged} place(s) tagged.`);
    })
    .catch((error) => {
      console.error('Enrichment failed:', error);
      process.exit(1);
    });
}
