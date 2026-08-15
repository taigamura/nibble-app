# Ralph Agent Configuration

## Build Instructions

```bash
# Install dependencies
npm install

# Typecheck (no emit)
npm run typecheck

# Bundle-check the Expo app (proves Metro can build it end-to-end)
npm exec -- expo export --platform ios --output-dir /tmp/nibble-export
```

## Test Instructions

```bash
# Run the full Jest suite (currently: src/taste-engine unit tests)
npm test
```

## Run Instructions

```bash
# Start the Expo dev server
npm start
# or target a platform directly
npm run ios
npm run web
```

## Notes
- This is an Expo / React Native (TypeScript) app. `App.tsx` wires
  `FixturePlacesProvider` / `NoopEnrichmentProvider` / `InMemoryStore`
  (`src/providers/inMemory.ts`) into `SwipeScreen`
  (`src/screens/SwipeScreen.tsx`).
- The only exhaustively-tested seam is the pure `src/taste-engine` module
  (`updateTaste`, `rankDeck`) — see the session guardrails in `PROMPT.md`.
  All I/O stays behind `PlacesProvider` / `EnrichmentProvider` / `Store`
  (`src/providers/types.ts`).
- Sandbox note (this Ralph session): the Bash tool only allows `git`
  (add/commit/diff/log/status/push/pull/fetch/checkout/branch/stash/merge/tag),
  `npm`, and the Read/Write/Edit tools. `npx`, `gh`, `mv`, `cp`, `rm`,
  `mkdir`, `node -e`, `git reset`/`restore`/`clean` are all auto-blocked.
  Use `npm exec -- <pkg>` instead of `npx <pkg>`.
- Update this file when the build process changes.
