# DevOps & Infrastructure Brain

_Last updated: 2026-04-15. Reflects merged main._

## Live Deployment

- **Frontend (Dashboard):** https://gourab5139014.github.io/carmanager/
- **Frontend (Mobile logger):** https://gourab5139014.github.io/carmanager/mobile.html
- **Supabase project:** https://cofmlyvqhxjkmyzbtrsy.supabase.co
- **Edge function URL:** https://cofmlyvqhxjkmyzbtrsy.supabase.co/functions/v1/ocr-image

## Deployment Pipeline

| Component | How | Trigger |
|-----------|-----|---------|
| Frontend | GitHub Actions → `actions/upload-pages-artifact` → GitHub Pages | push to main |
| Edge Function | `make deploy-fn` (manual) | Developer runs locally |
| Database | Supabase dashboard (manual DDL) | On schema changes |

CI config: `.github/workflows/dashboard.yml`
- Checkout → `sed` inject `SUPABASE_URL` and `SUPABASE_ANON_KEY` into `supabase-config.template.js` → upload to Pages

## Environment Variables

| Variable | Where set | Purpose |
|----------|-----------|---------|
| `SUPABASE_URL` | GitHub Secrets + local `supabase-config.js` | Supabase project endpoint |
| `SUPABASE_ANON_KEY` | GitHub Secrets + local `supabase-config.js` | Public key for frontend queries |
| `SUPABASE_SERVICE_KEY` | Local only (never committed) | Migration script bypass RLS |
| `ANTHROPIC_API_KEY` | Supabase secrets (`supabase secrets set`) | Edge function Anthropic calls |

To check what Supabase secrets are set: `make secrets`

## Local Development

```bash
make serve          # Start server at localhost:9000 (kills existing first)
make test           # Run all unit tests (JS + Python)
make test-ocr       # Run OCR integration tests (hits live edge function, needs network)
make deploy-fn      # Deploy edge function to Supabase
make migrate-dry    # Parse drivvo_ada_export.json without inserting
```

Prerequisites:
- `supabase-config.js` populated (copy from template, add real keys)
- `supabase` CLI installed + `supabase link --project-ref cofmlyvqhxjkmyzbtrsy`
- `ANTHROPIC_API_KEY` set in Supabase secrets for OCR to work

## Database Access

- Project ref: `cofmlyvqhxjkmyzbtrsy`
- Anon key: in `supabase-config.js` (gitignored locally)
- Auth test user: `gourab@carmanager.app` / `changeme123` (stored in `~/Documents/_DoNotDelete/carmanager/carmanager_test_user.txt`)

## Data

- Historical data: 181 refuelings, 16 services, 6 expenses (imported from `drivvo_ada_export.json` via `migrate.py`)
- Migration was verified Apr 12: top 5 records matched exactly against source JSON
- New fills logged via mobile.html auto-compute `distance_mi` from previous fill's odometer

## Observability

### Current (Limited)
- Edge function logs: `supabase functions logs ocr-image` (transient, not searchable)
- Hono logger middleware active in `src/app.ts` — logs request/response to Deno stdout

### Planned: Edge Observability (2026-04-15)

**The Problem:** Debugging OCR failures currently requires running `supabase functions logs` in a terminal, which is slow, transient, and lacks structured search. If a user's photo fails to parse, we have no persistent record of the error or the LLM's raw response, making it hard to improve the prompt.

**The Solution:** Implement a structured log drain in the Hono app (`src/app.ts`).
- Capture: Request headers (anonymized), OCR results, LLM latency, and error stack traces.
- Sink: Send logs via HTTP POST to an external provider (Axiom or a custom Supabase table) using `ctx.executionCtx.waitUntil` to avoid blocking the user response.

**Technical Approach:** The bottleneck is logging without adding latency.
1. Create a `logger-middleware.ts`.
2. Use `c.executionCtx.waitUntil` (Deno/Cloudflare standard) to ship logs after the response is sent.
3. Add a `LOG_DRAIN_URL` and `LOG_DRAIN_TOKEN` to Supabase secrets.

**Success Metrics:**
- **The Feedback Loop:** Real-time visibility into OCR "confidence" and failure modes in a searchable dashboard.
- **Reliability:** 100% capture of OCR failures for post-mortem analysis.

## Runbooks

**Deploy edge function after code change:**
```bash
# Make sure supabase CLI is linked
supabase link --project-ref cofmlyvqhxjkmyzbtrsy
make deploy-fn
# Verify: curl -X POST https://cofmlyvqhxjkmyzbtrsy.supabase.co/functions/v1/ocr-image ...
```

**Add a new database column:**
1. Write ALTER TABLE SQL
2. Run in Supabase dashboard SQL editor
3. Update schema in `.context/product-eng.md`
4. Update TypeScript types in `src/ocr-service.ts` if relevant

**Rotate ANTHROPIC_API_KEY:**
```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
make deploy-fn   # redeploy to pick up new secret
```

**Debug a failing OCR request:**
1. Check `supabase functions logs ocr-image`
2. Reproduce with curl: `curl -X POST $EDGE_URL -H "Authorization: Bearer $ANON_KEY" -H "Content-Type: application/json" -d @test_payload.json`
3. Hono app logs `[APP-LOG]` and `[OCR-SERVICE]` prefixed lines
