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

## Next Features (v2.0 Roadmap)

### 1. Unified API & Multi-Tenant Refactor (Planned: 2026-04-15)

**The Problem:** Currently, the "brains" of the app are scattered across frontend files. v1 is single-user and lacks structured reuse. Productization requires secure multi-tenancy, multiple vehicles per user, and a centralized API that any frontend (Web, Mobile, MCP) can use.

**The Solution:**
1. **Multi-Tenant Schema:** Add `user_id` and `vehicle_id` to all tables. Use Postgres RLS (Row Level Security) to ensure users can only ever see their own data.
2. **Unified Hono API:** Refactor the Edge Function into a full REST API (`/v1`) that handles auth, OCR, and DB operations in one place.
3. **PWA Frontend:** A modern, installable web app (SPA) that interacts ONLY with the `/v1` API.

**Technical Approach:**
1. **Database Architecture:**
   - New Table: `vehicles` (id, user_id, name, make, model, year, active).
   - Link existing records to a "Default" vehicle for the current user.
   - Strict RLS Policies: `CREATE POLICY "User-specific access" ON refuelings FOR ALL USING (auth.uid() = user_id);`
2. **Backend Architecture (Hono):**
   - Hono creates a Supabase client using the user's JWT from the `Authorization` header for each request.
   - `POST /v1/refuelings` handles image OCR + distance computation + DB insert in one operation.
3. **Frontend Architecture:**
   - Migrate to a Vite-based Single Page App (SPA).
   - PWA support for "Add to Home Screen" on iOS/Android.

**Success Metrics:**
- **Portability:** Any client with a valid JWT can log a fill via `POST /v1/refuelings`.
- **Security:** Strict isolation between users at the database level.
- **Speed:** Zero manual entry (OCR) remains fast on any device.

## Known Technical Debt

- `supabase/functions/ocr-image/handler.ts` is untracked leftover from refactor — should be deleted
- `select('*')` in index.html fetches all columns; could be explicit column lists to reduce payload
- `supabase-config.js` injection via `sed` in CI — if a secret contains `|`, sed breaks. Low risk since URL/JWT format doesn't allow `|`.
- tests/test_ocr.py hits live edge function and requires `~/Downloads/IMG_2337.heif` fixture on disk
