import type { Place } from '../taste-engine';
import type { EnrichmentProvider } from './types';

/**
 * Structured taste-tag record extracted by the LLM from a place's name +
 * reviews. This is a design-discussion shape, not a hosted contract — see
 * issue #4.
 */
export interface EnrichmentTags {
  vibe: string[];
  chain_or_indie: 'chain' | 'indie';
  specialty: string;
  good_for: string[];
  not_for: string[];
  price_band: string;
  noise: string;
}

/**
 * Flattens the structured LLM output into the flat tag vocabulary the
 * taste-engine already ranks over (`Place.tags`). `good_for` / `not_for`
 * are prefixed so a positive preference for "solo" doesn't collide with an
 * aversion to it, and everything else passes through as-is.
 */
export function flattenEnrichmentTags(tags: EnrichmentTags): string[] {
  return [
    ...tags.vibe,
    tags.chain_or_indie,
    tags.specialty,
    ...tags.good_for.map((tag) => `good-for:${tag}`),
    ...tags.not_for.map((tag) => `avoid:${tag}`),
    tags.price_band,
    tags.noise,
  ].filter((tag): tag is string => Boolean(tag));
}

const REQUIRED_KEYS: (keyof EnrichmentTags)[] = [
  'vibe',
  'chain_or_indie',
  'specialty',
  'good_for',
  'not_for',
  'price_band',
  'noise',
];

const ARRAY_KEYS: (keyof EnrichmentTags)[] = ['vibe', 'good_for', 'not_for'];

/**
 * Coerces a value the LLM supplied for an array-typed field into a string
 * array. The model occasionally returns a bare string (e.g. `"good_for": "solo"`)
 * instead of a single-element array; wrap those rather than crashing on `.map`.
 */
function coerceStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  if (typeof value === 'string') {
    return value.trim() === '' ? [] : [value];
  }
  return [];
}

/** Parses and validates the LLM's JSON response, tolerating markdown code fences. */
export function parseEnrichmentResponse(responseText: string): EnrichmentTags {
  const fenced = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = fenced ? fenced[1] : responseText;
  const parsed = JSON.parse(jsonText) as Partial<EnrichmentTags>;

  for (const key of REQUIRED_KEYS) {
    if (parsed[key] === undefined) {
      throw new Error(`Enrichment response missing required key: ${key}`);
    }
  }

  for (const key of ARRAY_KEYS) {
    (parsed[key] as unknown) = coerceStringArray(parsed[key]);
  }

  return parsed as EnrichmentTags;
}

/** Builds the prompt sent to the LLM for a single place. Pure — no I/O. */
export function buildEnrichmentPrompt(place: { name: string; category: string }, reviews: string[]): string {
  const reviewsBlock = reviews.length > 0 ? reviews.map((r, i) => `${i + 1}. ${r}`).join('\n') : '(no reviews available)';

  return `Place name: ${place.name}
Google category: ${place.category}

Reviews:
${reviewsBlock}

Extract a structured taste-tag record for this place as JSON matching exactly this shape:
{
  "vibe": string[] (2-4 short vibe descriptors, e.g. "minimal", "intense", "counter-seating"),
  "chain_or_indie": "chain" | "indie",
  "specialty": string (a short phrase, e.g. "third-wave espresso"),
  "good_for": string[] (e.g. "solo", "quick", "date-night"),
  "not_for": string[] (e.g. "groups", "laptop-work"),
  "price_band": "$" | "$$" | "$$$" | "$$$$",
  "noise": "quiet" | "moderate" | "loud"
}

Respond with ONLY the JSON object, no other text.`;
}

function extractReviewTexts(details: { reviews?: Array<{ text?: { text?: string } }> }): string[] {
  return (details.reviews ?? []).map((review) => review.text?.text).filter((text): text is string => Boolean(text));
}

export interface LlmEnrichmentProviderOptions {
  googlePlacesApiKey: string;
  /** Injected fetch, defaulting to the global — mirrors SupabasePlacesProvider's testability pattern. */
  fetchImpl?: typeof fetch;
  /**
   * The completion backend: given the enrichment prompt, returns the model's
   * raw text response. This is the ONLY LLM path — the caller supplies the
   * local `claude` CLI (see `scripts/enrichPlaces.ts`), which runs on the
   * machine's Claude subscription. There is deliberately no hosted-API option:
   * enrichment must never authenticate with an Anthropic API key or bill
   * per-token credits.
   */
  completePrompt: (prompt: string) => Promise<string>;
}

/**
 * Tags a place's real vibe/specialty from its Google reviews, once. This
 * class is only ever invoked from the offline `scripts/enrichPlaces.ts`
 * batch job — it is never wired into the app's runtime provider stack, so
 * no LLM call happens at swipe time (see issue #4 acceptance criteria).
 */
export class LlmEnrichmentProvider implements EnrichmentProvider {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: LlmEnrichmentProviderOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async enrich(place: Pick<Place, 'id' | 'name' | 'category'>): Promise<string[]> {
    const reviews = await this.fetchReviews(place.id);
    const prompt = buildEnrichmentPrompt(place, reviews);
    const responseText = await this.options.completePrompt(prompt);
    const tags = parseEnrichmentResponse(responseText);
    return flattenEnrichmentTags(tags);
  }

  private async fetchReviews(placeId: string): Promise<string[]> {
    const response = await this.fetchImpl(`https://places.googleapis.com/v1/places/${placeId}?fields=reviews`, {
      headers: { 'X-Goog-Api-Key': this.options.googlePlacesApiKey },
    });

    if (!response.ok) {
      throw new Error(`Google Place Details lookup failed with status ${response.status}`);
    }

    const details = (await response.json()) as { reviews?: Array<{ text?: { text?: string } }> };
    return extractReviewTexts(details);
  }
}
