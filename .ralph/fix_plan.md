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
