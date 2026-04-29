# Engineering & Product Brain

_Last updated: 2026-04-29. Reflects Unified API Completion._

## Current State

v2.0 is live on `feat/unified-api-completion`. Core loop is centralized:
- **Unified API**: All DB operations (refuelings, services, expenses) flow through `/v1` Hono API.
- **Multi-Tenant**: RLS enforced via User JWT. `vehicle_id` ownership verified at API layer.
- **PWA Frontend**: Vite-based SPA with dashboard tracking total cost of ownership.
- **Spec-First**: `openapi.yaml` defines the contract; verified by `tests/test_api_contract.py`.

## Tech Stack

| Layer | What | Notes |
|-------|------|-------|
| Frontend | Vite + React/TS (PWA) | SPA architecture. |
| Backend | Hono (src/) | Deployed to Supabase Edge Functions. |
| OCR | Claude Haiku 4.5 | via Anthropic Vision API. |
| Database | Supabase Postgres | Schema: `dev` (v2), `legacy` (v1). |
| Docs | OpenAPI 3.0 | `openapi.yaml` + `swagger-ui.html`. |

## File Map

```
/
├── frontend/                Vite-based SPA (PWA)
│   ├── src/api.ts           Unified API client
│   └── src/ui/              Dashboard & Log Fill views
├── src/                     Hono backend logic
│   ├── app.ts               API Routes (Multi-tenant)
│   └── ocr-service.ts       OCR extraction
├── migrate.py               CLI Migration tool (Uses API + User JWT)
├── openapi.yaml             API Specification
├── swagger-ui.html          Local API Docs viewer
├── Makefile                 Dev workflow: make test / serve
└── tests/                   Contract, Unit, and Integration tests
```

## Database Schema (v2.0)

**Schema**: `dev`
- **vehicles**: `id`, `user_id`, `name`, `make`, `model`, `year`, `active`
- **refuelings**: `id`, `date`, `odometer`, `volume_gal`, `total_cost`, `distance_mi`, `vehicle_id`, `user_id`
- **services**: `id`, `date`, `odometer`, `description`, `cost`, `vehicle_id`, `user_id`
- **expenses**: `id`, `date`, `odometer`, `description`, `cost`, `vehicle_id`, `user_id`

## v2.0 Roadmap Progress

- [x] **Multi-Tenant Schema**: Links records to `user_id` and `vehicle_id`.
- [x] **Unified Hono API**: `/v1` endpoints for all resources with IDOR protection.
- [x] **PWA Frontend**: Dashboard migrated to Unified API; total cost tracking active.
- [x] **Secure Migration**: `migrate.py` refactored to use User JWT instead of `service_role`.

## Next Features & Security Hardening

### 1. Security: service_role Key Restriction
- **The Problem**: Local dev and some legacy scripts still have access to the `service_role` key, which bypasses RLS.
- **Goal**: Disable or strictly restrict `service_role` usage.
- **Action**: Audit all remaining `service_role` references and transition them to restricted service keys or API-based access.

### 2. Frontend: Multi-Vehicle Management
- **Goal**: Add UI for creating and managing multiple vehicles.
- **Action**: Create `VehicleManager.ts` view in `frontend/src/ui/`.

### 3. API: Batch Optimization
- **Goal**: Optimize `POST /v1/refuelings` for large migrations.
- **Action**: Refactor looping inserts into a single bulk PostgreSQL insert.

## Known Technical Debt

- `select('*')` in some queries could be optimized for specific column lists.
- `tests/test_ocr.py` requires local fixtures for integration testing.
- `supabase-config.js` injection logic remains brittle for complex secrets.
