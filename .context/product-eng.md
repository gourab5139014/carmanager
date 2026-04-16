# Engineering & Product Brain

_Last updated: 2026-04-15. Reflects merged main._

## Current State

v1.0 is live on GitHub Pages. Core loop works:
- User signs into mobile.html on phone
- Snaps photos of odometer + pump display
- Claude Haiku extracts numbers via OCR edge function
- User reviews autofilled form → taps submit
- Dashboard at index.html shows MPG trends, costs, service history

## Tech Stack

| Layer | What | Notes |
|-------|------|-------|
| Frontend | Vanilla JS + Plotly.js + Supabase SDK (CDN) | No build step. Lives on GitHub Pages. |
| Backend | Hono app (src/) deployed to Supabase Edge Functions | Deno runtime |
| OCR | Claude Haiku 4.5 via Anthropic Vision API | claude-haiku-4-5-20251001 |
| Database | Supabase Postgres | RLS enabled: public SELECT, authenticated INSERT |
| Hosting | GitHub Pages (frontend) + Supabase (backend + auth) | Free tier |

## File Map

```
/
├── index.html               Dashboard (Plotly charts, Supabase queries)
├── mobile.html              Mobile fill logging (photo OCR + form)
├── metrics.js               Pure JS: computeMetrics(fills, services, expenses)
├── migrate.py               One-time import: drivvo_ada_export.json → Supabase
├── supabase-config.js       LOCAL ONLY (gitignored) — has real keys
├── supabase-config.template.js  Template injected by CI via sed
├── Makefile                 Dev commands (make serve / test / deploy-fn)
│
├── src/                     Portable business logic (runtime-agnostic)
│   ├── app.ts               Hono app: CORS middleware + POST route
│   ├── ocr-service.ts       runOcr() — calls Anthropic API, parses result
│   └── server.ts            Node.js/Bun entry point (for non-Supabase deploy)
│
├── supabase/functions/ocr-image/
│   ├── index.ts             Supabase entry point: Deno.serve(app.fetch)
│   └── handler.ts           UNTRACKED leftover — safe to delete
│
├── tests/
│   ├── test_metrics.js      44 unit tests for metrics.js (node)
│   ├── test_migrate.py      29 unit tests for migrate.py (python unittest)
│   └── test_ocr.py          Integration tests hitting live edge function (pytest)
│
└── docs/design-docs/        Future feature specs (see Next Features below)
```

## Database Schema (v1.0)

**refuelings**: `id`, `date`, `odometer`, `volume_gal`, `price_per_gal`, `total_cost`, `distance_mi`, `full_tank`, `fuel_type`, `notes`, `created_at`

**services**: `id`, `date`, `odometer`, `description`, `cost`, `category`, `notes`, `location`, `created_at`

**expenses**: `id`, `date`, `odometer`, `description`, `cost`, `category`, `notes`, `created_at`

Note: `distance_mi` is computed at insert time by mobile.html — queries previous fill's odometer, diffs it. Rows from Drivvo import already have it pre-computed.

## Architecture Decisions

**Why Hono?** Extracting OCR logic into `src/ocr-service.ts` makes it portable: same code runs on Supabase Edge, Vercel, Node, or Bun. The Supabase `index.ts` is a 3-line wrapper.

**Why no build step?** GitHub Pages + CDN scripts = zero CI complexity. Fast iteration.

**Why Canvas→JPEG for images?** Claude Vision API doesn't support HEIF/HEIC (iPhone default). Browser Canvas converts any format to JPEG before sending to edge function. Capped at 1600px long edge for OCR quality vs. payload size.

## Coding Conventions (for AI agents)

- Indentation: 2 spaces
- Language: TypeScript for `src/` and Supabase functions; JavaScript for frontend HTML files
- Unit names in variable names: `volume_gal`, `distance_mi`, `price_per_gal`
- OCR errors: always return `{field: null, error: "reason"}` with HTTP 200 — UI shows "enter manually", never crashes
- No React, no Tailwind, no build tools in frontend

## Next Features (design docs exist in docs/design-docs/)

### 1. Multi-Vehicle Support (`docs/design-docs/2026-04-15-multi-vehicle-support.md`)
Add `vehicles` table. Link existing records to a "Default" vehicle. Vehicle switcher in mobile UI. This is the highest-priority next feature — the current flat schema breaks if user has 2 cars.

Schema change needed:
```sql
CREATE TABLE vehicles (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, name text, make text, model text, year int);
ALTER TABLE refuelings ADD COLUMN vehicle_id uuid REFERENCES vehicles(id);
-- same for services, expenses
```

### 2. Edge Observability (`docs/design-docs/2026-04-15-edge-observability.md`)
Structured log drain from Hono middleware. Use `c.executionCtx.waitUntil` to POST logs after response. Captures OCR confidence, LLM latency, errors. Sinks: Axiom or custom Supabase table. New secrets needed: `LOG_DRAIN_URL`, `LOG_DRAIN_TOKEN`.

## Known Technical Debt

- `supabase/functions/ocr-image/handler.ts` is untracked leftover from refactor — should be deleted
- `select('*')` in index.html fetches all columns; could be explicit column lists to reduce payload
- `supabase-config.js` injection via `sed` in CI — if a secret contains `|`, sed breaks. Low risk since URL/JWT format doesn't allow `|`.
- tests/test_ocr.py hits live edge function and requires `~/Downloads/IMG_2337.heif` fixture on disk
