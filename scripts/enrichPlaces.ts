/**
 * One-time (re-runnable) offline enrichment: tags every curated place that
 * doesn't have tags yet with LLM-derived vibe/specialty taste tags, and
 * persists them permanently in Supabase. See issue #4.
 *
 * The tagging model runs through the local `claude` CLI (the machine's Claude
 * subscription) — never an Anthropic API key. Run with real credentials
 * (loads .env, then `npm run enrich`):
 *   GOOGLE_PLACES_API_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npm run enrich
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
  googlePlacesApiKey: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  fetchImpl?: typeof fetch;
  /** Milliseconds to pause between places, to stay under upstream rate limits. */
  delayMs?: number;
  /**
   * The completion backend passed to {@link LlmEnrichmentProvider} — the local
   * `claude` CLI. This is the only LLM path; there is no hosted-API option.
   */
  completePrompt: (prompt: string) => Promise<string>;
}): Promise<{ tagged: number; failed: number }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const provider = new LlmEnrichmentProvider({
    googlePlacesApiKey: options.googlePlacesApiKey,
    fetchImpl,
    completePrompt: options.completePrompt,
  });

  const untagged = await fetchUntaggedPlaces(options.supabaseUrl, options.supabaseServiceRoleKey, fetchImpl);

  let tagged = 0;
  let failed = 0;
  for (const row of untagged) {
    try {
      const tags = await provider.enrich({ id: row.place_id, name: row.name, category: row.category });
      await persistTags(row.place_id, tags, options.supabaseUrl, options.supabaseServiceRoleKey, fetchImpl);
      tagged += 1;
    } catch (error) {
      // A transient failure on one place (e.g. a Google 429) must not abort
      // the whole batch. Leave this row's tags empty so a re-run retries it,
      // and move on. Enrichment is idempotent: only empty-tag rows are picked.
      failed += 1;
      // eslint-disable-next-line no-console
      console.warn(`  skipped ${row.name} (${row.place_id}): ${(error as Error).message}`);
    }
    // Gentle throttle between places to stay under Google/CLI rate limits.
    if (options.delayMs && options.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }
  }

  return { tagged, failed };
}

/**
 * Completion backend that shells out to the local `claude` CLI in headless
 * print mode (`claude -p`). This uses the machine's logged-in Claude plan
 * instead of an Anthropic API key, so no per-token billing and no
 * `ANTHROPIC_API_KEY` is needed. The prompt is passed on argv (a few KB, well
 * under ARG_MAX); the model's raw text answer comes back on stdout, which
 * `parseEnrichmentResponse` already tolerates (JSON, optionally fenced).
 */
function makeClaudeCliComplete(model = 'sonnet'): (prompt: string) => Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { spawn } = require('node:child_process') as typeof import('node:child_process');
  return (prompt: string) =>
    new Promise<string>((resolve, reject) => {
      // stdin: 'ignore' closes the child's stdin immediately. Without it the
      // CLI waits ~3s per call for stdin that never comes (it reads the prompt
      // from argv), which across a full batch adds up to many wasted minutes.
      // Strip API-key auth from the child's env so `claude` always uses the
      // machine's claude.ai subscription login (no per-token billing). `npm
      // run` re-injects ANTHROPIC_API_KEY even when the parent was launched
      // with `env -u`, so clearing it here is what actually guarantees the
      // no-API-cost path and silences the "auth source takes precedence" warning.
      const childEnv = { ...process.env };
      delete childEnv.ANTHROPIC_API_KEY;
      delete childEnv.ANTHROPIC_AUTH_TOKEN;
      const child = spawn('claude', ['-p', prompt, '--model', model], {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 120_000,
        env: childEnv,
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => (stdout += chunk));
      child.stderr.on('data', (chunk) => (stderr += chunk));
      child.on('error', (error) => reject(new Error(`claude CLI spawn failed: ${error.message}`)));
      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
          return;
        }
        // Surface the CLI's own stderr (e.g. a usage-limit message) so a
        // skipped place is diagnosable, not just "Command failed".
        reject(new Error(`claude CLI exited ${code}: ${stderr.trim() || '(no stderr)'}`));
      });
    });
}

/* eslint-disable no-console */
if (require.main === module) {
  // Hard rule for this project: enrichment NEVER uses the Anthropic API — it
  // runs only through the local `claude` CLI (the machine's subscription
  // login), so it can never bill API credits. Delete any leaked key from this
  // process up front so nothing downstream (this script, the provider, or the
  // spawned CLI) can reach it. `npm run` re-injects ANTHROPIC_API_KEY even
  // after `env -u`, which is exactly how it was reached by accident before.
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_AUTH_TOKEN;

  const googlePlacesApiKey = process.env.GOOGLE_PLACES_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!googlePlacesApiKey || !supabaseUrl || !supabaseServiceRoleKey) {
    console.error('Missing required env vars: GOOGLE_PLACES_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log('Enriching via the local `claude` CLI (subscription login; the Anthropic API is never used).');

  runEnrichment({
    // Intentionally no anthropicApiKey: the CLI completer is the only backend.
    googlePlacesApiKey,
    supabaseUrl,
    supabaseServiceRoleKey,
    completePrompt: makeClaudeCliComplete(),
    delayMs: 350,
  })
    .then(({ tagged, failed }) => {
      console.log(
        `Enrichment complete: ${tagged} place(s) tagged` +
          (failed > 0 ? `, ${failed} skipped (re-run to retry).` : '.'),
      );
    })
    .catch((error) => {
      console.error('Enrichment failed:', error);
      process.exit(1);
    });
}
