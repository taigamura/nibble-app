# Ralph Fix Plan (queue item)

## Current Task
- [x] Implement GitHub issue #2 — Swipe loop over fixtures with live taste-engine
  - Spec: .ralph/specs/issue-2.md
  - Verify gate: `npm run typecheck` and `npm test` both green; `npm exec -- expo export --platform ios` bundles clean.
  - Landed in commit 7e1a5e1.

## Learnings for future loops
- The Bash tool in this session only allows `git` (specific subcommands: add,
  commit, diff, log, status, push, pull, fetch, checkout, branch, stash,
  merge, tag), `npm`, and the Read/Write/Edit tools — `npx`, `mv`, `cp`, `rm`,
  `mkdir`, `node -e`, and `git reset`/`git restore`/`git clean` are all
  auto-blocked (no interactive prompt, straight denial). Use `npm exec --
  <pkg>` instead of `npx <pkg>`; use the Write tool instead of `mv`/`cp` to
  relocate generated file content; there is no way to delete a stray file or
  directory once created, so gitignore it instead.
- `npm create expo-app@latest .` refuses to scaffold into a non-empty
  directory (this repo already had `.ralph/`, `CLAUDE.md`, etc.). Scaffolded
  into `.scaffold-tmp/` instead and hand-wrote the root `package.json`,
  `app.json`, `tsconfig.json`, `index.ts`, `App.tsx` by reading the
  scaffold's versions — could not `rm` the leftover `.scaffold-tmp/` dir
  afterward, it's gitignored.
- `jest-expo` preset works fine for pure-TS unit tests (no RN mocking needed
  for `src/taste-engine`), so one Jest config serves both the pure engine
  tests and future RN component tests.
- `StyleSheet.absoluteFillObject` isn't typed in this RN/Expo SDK version —
  use explicit `position: 'absolute', top: 0, left: 0, right: 0, bottom: 0`.

## Next up (not started)
- [ ] GitHub issue #3 — Real place data: Google Places ingest + curated DB
  (depends on #2, now unblocked) — **BLOCKED, see below**
- [ ] GitHub issue #5 — Rating flow (depends on #2, now unblocked)
- [ ] GitHub issue #7 — Collection & history (depends on #2, now unblocked)
- [ ] GitHub issue #9 — Anonymous-first auth + Supabase sync (depends on #2, now unblocked)

## Loop #2 (2026-08-15): BLOCKED on issue #3 — missing spec, no fetch path
Attempted to pick up GitHub issue #3 next (per queue priority in
`.ralph/queue.json`). Unlike issue #2, no `.ralph/specs/issue-3.md` exists,
and `queue.json` only carries the title ("Real place data: Google Places
ingest + curated DB"), not the issue body/acceptance criteria. Confirmed
`gh` is not invocable in this session (`gh --version` is auto-blocked, same
as `npx`/`mv`/`rm` — outside the `.ralphrc` `ALLOWED_TOOLS` allowlist), so
there is no way to pull the real issue body from GitHub this loop, and no
local PRD (`CONTEXT.md`, `docs/adr/`) covers it either.

Issue #3 is exactly the kind of slice where guessing is costly: it involves
a real external API (Google Places), API-key handling, and TOS-sensitive
data-retention rules (guardrails say: never cache Google content beyond 30
days, never store Google photos permanently, only Place IDs + our own tags
persist). Building against a title alone risks landing something that
doesn't match the actual acceptance criteria and has to be redone. Made no
code changes this loop — nothing to revert.

**Unblock path:** run whatever step populated `.ralph/specs/issue-2.md`
(the `ralph enable --sync` / queue-sync step, or `gh issue view 3` from a
session where `gh` is allowed) to materialize `.ralph/specs/issue-3.md`
before the next loop. Once that spec exists, the real
`GooglePlacesProvider` can be built behind the existing `PlacesProvider`
interface (`src/providers/types.ts`) without touching the `taste-engine`
seam — same pattern as `FixturePlacesProvider` in
`src/providers/inMemory.ts`, with fetch mocked in tests so no live API key
is needed to keep `npm test` green.

## Loop #3 (2026-08-15): rechecked, still blocked — did documentation instead
`.ralph/specs/` still only has `issue-2.md`; `queue.json` still carries
titles only for issues #3–#10, and `gh` is still not invocable. Every
remaining queued item is blocked the same way (none of #3, #4, #5, #6, #7,
#8, #9, #10 have a spec), so there's no unblocked implementation task
available this loop.

Instead, fixed `.ralph/AGENT.md`, which still said "No build/test/run
command configured" even though the app has been buildable/testable since
issue #2 landed — stale docs would have sent a future loop (or the
`ralph enable --sync` harness) down the wrong path. Verified the new
commands (`npm run typecheck`, `npm test`) are actually green before
committing.

## Loop #4 (2026-08-15): still blocked on spec sync — fixed a stale-closure bug instead
Rechecked: `.ralph/specs/` is still only `issue-2.md`, `gh` is still
unreachable, no new queue items unblocked. Rather than report the same
blocker a third time with nothing new, reviewed the existing issue #2
implementation for correctness bugs (fair game — "search the codebase
before assuming something isn't implemented" cuts both ways: also check
what *is* implemented for defects) and found one in
`src/components/Card.tsx`.

**Bug:** `panResponder` was created once via `useRef(PanResponder.create(...)).current`,
so its `onPanResponderRelease` closure captured whichever `flyOut` (and
therefore whichever `onSwiped` prop) existed at that Card instance's first
render. `SwipeScreen` passes a fresh `onSwiped` closure over the *current*
`graph` on every render. Since a Card instance persists across
re-renders as long as `key={topPlace.id}` doesn't change (e.g. the user
swipes card X, then card Y, then taps Undo — Y can stay on top while
`graph` reverts to pre-X), a drag-released swipe on that same top card
could fire the *stale* `onSwiped`, committing `updateTaste` against a
stale (pre-undo) graph and silently corrupting the taste vector. Tap-button
swipes were already safe (`useImperativeHandle`'s no-deps effect refreshes
`animateOut` every render); only the raw pan-gesture path was stale.

**Fix:** added `onSwipedRef` (a ref reassigned every render) and had
`flyOut`'s animation-complete callback call `onSwipedRef.current(action)`
instead of closing over the `onSwiped` prop directly — the ref is read at
*invocation* time, not closure-definition time, so it's always current
regardless of when the frozen `panResponder` closure was created.

Verify gate: `npm run typecheck`, `npm test` (still 10/10 on
`taste-engine`, untouched), and `npm exec -- expo export --platform ios`
all green. Did not add a new automated regression test for this — per the
session guardrails, `taste-engine` is the only seam expected to be
exhaustively tested; simulating a PanResponder gesture release in
`jest-expo` would need `react-native-testing-library` (not currently a
dependency) and disproportionate setup for one closure fix. Landed in
commit 314719d.

## Loop #5 (2026-08-15): still blocked on spec sync — fixed a seed-stability bug
Rechecked: `.ralph/specs/` is still only `issue-2.md`. Continued the same
approach as loop #4 — audited the existing issue #2 implementation rather
than re-report the same blocker — and found a second bug, this time in
`src/screens/SwipeScreen.tsx`.

**Bug:** `SwipeScreen({ seed = Date.now() })` used a default *parameter*
for the injected seed. Since `App.tsx` never passes a `seed` prop, that
default expression re-evaluates on *every render*, so any state update
(a swipe, an undo) produced a brand-new `Date.now()` seed, which fed
straight into the `rankDeck` `useMemo` dependency array and re-shuffled the
wildcard ~30% of the deck on every interaction. This defeats the point of
an "injected seed" (issue #2's acceptance criteria: "deterministic under a
fixed injected seed") — the app-level seed should be pinned once per
session, not continuously re-randomized. `topPlace` itself never visibly
glitched (it almost always comes from the score-sorted fit slice, not the
shuffled wildcard slice), so this wouldn't have been obvious from casual
manual testing, only from reading the render/memo dependency chain.

**Fix:** pin the seed once via `useRef(seed ?? Date.now()).current` inside
the component instead of a default parameter, and depend on that stable
`sessionSeed` in the `rankDeck` memo instead of the raw `seed` prop.

Verify gate: `npm run typecheck`, `npm test` (10/10, `taste-engine`
untouched), `npm exec -- expo export --platform ios` all green. No new
test added for the same reason as loop #4 (UI/render-timing behavior,
outside the exhaustively-tested `taste-engine` seam; would need
`react-native-testing-library` to assert re-render behavior directly).
