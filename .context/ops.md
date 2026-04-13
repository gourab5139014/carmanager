# DevOps & Infrastructure Brain

## Deployment Pipeline
- **Frontend:** GitHub Actions (`.github/workflows/dashboard.yml`) deploys to GitHub Pages on `main` push.
- **Backend:** `make deploy-fn` to Supabase Edge Functions. Requires `supabase` CLI and project link.
- **Data:** `migrate.py` for one-time JSON to Postgres import via `SUPABASE_SERVICE_KEY`.

## Environment Variables
Required secrets in GitHub/Supabase:
- `SUPABASE_URL`: Project endpoint.
- `SUPABASE_ANON_KEY`: Public anon key for frontend queries.
- `SUPABASE_SERVICE_KEY`: Service role key for migrations (NOT FOR FRONTEND).
- `ANTHROPIC_API_KEY`: Vision API key for Edge Functions.

## Runbooks
1. **Adding a Column:** Update `supabase/schema.sql` -> Run SQL in Dashboard -> Update `product-eng.md`.
2. **Local Testing:** `make serve` starts local server at port 9000.
3. **Function Deployment:** Link project first: `supabase link --project-ref <REF>`.
4. **Secret Management:** `supabase secrets set KEY=VALUE`.

## Observability
- **CLI Logs:** `supabase functions logs ocr-image` (note: may be buggy in current CLI version).
- **Hono Middleware:** Use `logger()` in `src/app.ts` to capture request/response flow.
- **Manual Debug:** Hit the endpoint directly via `curl` with `test_payload.json`.
