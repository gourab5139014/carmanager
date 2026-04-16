# MEMORY (Project Context & Handoff)

<objective>
Personal car analytics dashboard with photo-first mobile fuel logging, deployed free on GitHub Pages + Supabase.
</objective>

<status>
- **Current State:** v1.0 live. Supabase backend + Hono OCR edge function + GitHub Pages frontend. Main is clean.
- **Dashboard URL:** https://gourab5139014.github.io/carmanager/
- **Last Activity:** Apr 15 — code review session, bugs fixed, context saved.
</status>

<recent_wins>
1. **v1.0 Shipped:** 181 refuelings, 16 services, 6 expenses migrated from Drivvo. Dashboard live.
2. **Photo-First Mobile:** Tap photo card → Claude Haiku reads odometer/pump → form autofills.
3. **HEIF/HEIC Support:** iPhone photos work (Canvas → JPEG conversion, then heic2any fallback).
4. **Hono Architecture:** OCR logic in `src/ocr-service.ts` is portable — can move off Supabase Edge if needed.
5. **distance_mi Auto-Compute:** New fills get MPG automatically (queries prev odometer at insert time).
</recent_wins>

<blockers>
- None.
</blockers>

<next_steps>
1. **Cleanup:** Delete untracked `supabase/functions/ocr-image/handler.ts` (orphaned from refactor).
2. **Multi-Vehicle:** Add `vehicles` table + FK to all log tables. Design doc in `docs/design-docs/2026-04-15-multi-vehicle-support.md`.
3. **Observability:** Log drain from Hono middleware for OCR failure analysis. Design doc in `docs/design-docs/2026-04-15-edge-observability.md`.
4. **Auth UX:** Save form state to sessionStorage before session expiry hides the form.
</next_steps>

<context_files>
Full context for AI agents is in `.context/`:
- `handoff.md` — active handoff: what to do next, key files to read
- `product-eng.md` — architecture, file map, schema, coding conventions
- `ops.md` — deployment pipeline, env vars, runbooks
- `marketing.md` — positioning, target audience
- `support.md` — known issues, data policy
</context_files>
