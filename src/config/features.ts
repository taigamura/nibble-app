/**
 * Build-time feature flags. Plain module constants (not env-driven) so they're
 * statically analyzable and trivially testable.
 */

/**
 * Cloud sync: Sign in with Apple + a Supabase-backed, cross-device taste graph
 * (`taste_graphs`). **Disabled for the initial Tokyo release.**
 *
 * Why off: the launch is a handful of users (<10), so a per-device local store
 * is enough, and turning this off avoids the Apple Services ID / Supabase Apple
 * provider setup (see docs/runbook-real-data.md §8) plus the Apple sign-in
 * dashboard config that currently 400s.
 *
 * Re-enabling later is one line — flip this to `true` and rebuild. Nothing is
 * deleted: the auth provider, the sign-in prompt, the Settings account row, the
 * cloud store, and the local→cloud migration are all still here. Every one of
 * them is already gated on the auth provider being present (App.tsx passes
 * `canSignIn={authProvider !== null}` down), so this flag being the single gate
 * on `createAuthProvider`/`createCloudStore` is the whole switch. After
 * flipping it, finish the Supabase Apple provider config in the runbook.
 */
export const CLOUD_SYNC_ENABLED = false;
