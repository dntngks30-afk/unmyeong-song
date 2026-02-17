# Hotfix Execution Log - env + top10 view

## Scope
- option 1 selective staging only
- no out-of-scope file touched
- target: env guard, top10 diagnostics, final_tracks_public_v verification

## Rules Source
- docs/codex/RULES.md not found
- fallback rules: `AGENTS.md` + `docs/contracts/*` (SSOT)

## Baseline (before changes)
- `git status --porcelain` executed
- `git diff --name-only` executed
- working tree had many pre-existing `M/??` out-of-scope files

## DB Apply / Verify
1. `npx supabase migration list`
2. `npx supabase db push --yes --include-all`
3. REST check:
   - `GET /rest/v1/final_tracks_public_v?select=id,title,artist,rank&limit=1`
   - expected: `HTTP 200` + JSON array payload

## Observed
- `npx supabase db push --yes --include-all`
  - `Applying migration 202602170001_create_final_tracks_public_v.sql...`
  - `Finished supabase db push.`
- `npx supabase migration list`
  - failed in this session due remote auth circuit breaker:
    - `password authentication failed for user "cli_login_postgres"`
    - `FATAL: Circuit breaker open: Too many authentication errors`
- `curl .../rest/v1/final_tracks_public_v?...`
  - `HTTP/1.1 200 OK`
  - body sample: `[{"id":"...","title":"ticket05-song","artist":"ticket05_artist","rank":1}]`

## QA Notes
- Missing env: must show `SUPABASE_CONFIG_MISSING` guidance instead of endless spinner.
- Whitespace polluted env value: must show whitespace contamination guidance.
- If DB view missing (PGRST205): UI must show diagnostic message including `final_tracks_public_v`.
