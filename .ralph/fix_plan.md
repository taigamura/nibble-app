# Ralph Fix Plan (queue item)

## Current Task
- [x] Implement GitHub issue #9
  - Spec: .ralph/specs/issue-9.md

Notes: anonymous-first auth landed behind the existing Store/AuthProvider
interfaces (LocalStore on AsyncStorage, SupabaseStore + SupabaseAppleAuthProvider
over plain fetch, pure mergeTasteGraphs/migrateLocalDataToCloud for lossless
migration). No native build was run against a real Apple/Supabase account
(no device/simulator or deployed backend in this environment) -- verified via
typecheck, jest, and `expo export`.
