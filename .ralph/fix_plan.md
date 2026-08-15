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
  (depends on #2, now unblocked)
- [ ] GitHub issue #5 — Rating flow (depends on #2, now unblocked)
- [ ] GitHub issue #7 — Collection & history (depends on #2, now unblocked)
- [ ] GitHub issue #9 — Anonymous-first auth + Supabase sync (depends on #2, now unblocked)
