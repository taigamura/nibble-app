# Issue #9: Anonymous-first auth + Supabase sync

## Parent

#1 — Nibble MVP: taste-graph swipe app.

## What to build

Anonymous-first authentication and cloud sync. A new user swipes immediately with their graph, Want list, and Been history cached locally — no signup wall. The app prompts for a real account (**Sign in with Apple**) only after value has landed: after the first session, or when the user tries to sync / leave a review / use a second device. On sign-up, local state migrates to the Supabase-backed `Store` and thereafter syncs across devices. The core graph and history are free forever.

End-to-end: swipe anonymously → prompt at the right moment → Sign in with Apple → local data migrates to cloud → same data appears on a second device.

## Acceptance criteria

- [ ] A brand-new user can complete onboarding and swipe with no account, state cached locally.
- [ ] The Sign-in-with-Apple prompt appears only after the first session or at a sync/review/second-device moment — never before first value.
- [ ] Signing in migrates local graph + Want + Been data to the cloud `Store` without loss.
- [ ] A signed-in user sees the same graph/collection on a second device.
- [ ] No feature of the personal graph/history is paywalled.

## Blocked by

- #2 — Swipe loop over fixtures with live taste-engine.

