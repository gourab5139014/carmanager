# Active Handoff

_Written: 2026-04-15. For any AI agent resuming work on this project._

## Where Things Stand

v1.0 is live and working. Two PRs shipped today:
- **PR #5** (feat/supabase-mobile-logging): Supabase migration + photo-first mobile form
- **PR #6** (feat/portable-hono-ocr): Refactored OCR into portable Hono architecture

Main branch is clean. No open PRs. No failing CI.

## Immediate Cleanup Needed

**Delete the leftover handler.ts:**
```bash
rm supabase/functions/ocr-image/handler.ts
git add -A && git commit -m "clean: remove leftover handler.ts from Hono refactor"
```
This file (`supabase/functions/ocr-image/handler.ts`) is an untracked leftover from before the refactor. The current entry point is `index.ts` which imports from `src/app.ts`. `handler.ts` is orphaned and will confuse anyone reading the function directory.

## Next Features (Priority Order)

### 1. Multi-Vehicle Support (HIGH)
Design doc: `docs/design-docs/2026-04-15-multi-vehicle-support.md`

The core problem: two cars = broken MPG. Current schema has no vehicle_id.

What needs to happen:
1. Create `vehicles` table in Supabase
2. Add `vehicle_id` FK to `refuelings`, `services`, `expenses`
3. Migrate existing 181 rows to a "Default Vehicle" record
4. Add vehicle switcher to `mobile.html` header
5. Update `metrics.js` to filter by vehicle
6. Update dashboard queries in `index.html`

Start here. Do the schema migration first and verify record counts before touching the frontend.

### 2. Edge Observability (MEDIUM)
Design doc: `docs/design-docs/2026-04-15-edge-observability.md`

The core problem: OCR failures are invisible. No way to improve the prompt without data.

What needs to happen:
1. Add `logger-middleware.ts` in `src/`
2. Use `c.executionCtx.waitUntil()` to ship logs post-response (non-blocking)
3. Decide log sink: Axiom (external) or new `ocr_logs` Supabase table (simpler, free)
4. Add `LOG_DRAIN_URL` and `LOG_DRAIN_TOKEN` to Supabase secrets
5. Deploy updated edge function

The Supabase table approach is simpler and keeps everything in one place. Create a table with: `id`, `timestamp`, `type` (odometer|pump), `success` (bool), `odometer_result`, `llm_latency_ms`, `error`.

### 3. Auth UX (LOW — but annoying)
The sign-in flow on mobile.html is bare-bones. If session expires mid-fill, the app hides the form and shows the login screen, losing unsaved form data. Consider saving form state to `sessionStorage` before `onAuthStateChange` fires.

## Open Questions

- Should `distance_mi` be computed client-side at insert time (current approach) or server-side in a Postgres trigger? Server-side is more reliable if someone inserts via another client.
- `test_ocr.py` requires `~/Downloads/IMG_2337.heif` on disk as a fixture. This will fail on any machine without that file. Should we commit a test fixture image instead?

## Key Files for Context

If you need to understand the codebase quickly, read these in order:
1. `src/ocr-service.ts` — OCR core logic (platform-agnostic)
2. `src/app.ts` — Hono routes + error handling
3. `supabase/functions/ocr-image/index.ts` — 3-line Supabase entry point
4. `mobile.html` (lines 400–620) — photo capture → OCR → form autofill → Supabase insert
5. `metrics.js` — all dashboard computations

## Git Workflow Rules

- NEVER push directly to main
- Always branch → PR → wait for human review before merging
- Always `git pull --rebase origin main` before pushing (Actions auto-commits dashboard-data.json)
- Branch naming: `feat/`, `fix/`, `chore/`
