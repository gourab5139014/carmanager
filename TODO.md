# Project Issues & TODOs

## Security & Architecture

### [HIGH] Disable or restrict service_role key usage
**Goal:** Eventually disable or restrict the \`service_role\` key usage in local dev environments now that \`migrate.py\` uses the Unified API.
**Status:** Pending.

### [MEDIUM] Delete untracked handler.ts
**Goal:** \`supabase/functions/ocr-image/handler.ts\` is an untracked leftover from refactor — should be deleted.
**Status:** Done.

## v2.0 Roadmap

### [HIGH] Complete Unified API Multi-Tenant Refactor
**Goal:** Ensure all frontend operations use the \`/v1\` API and RLS is correctly enforced.
- [x] Multi-Tenant Schema (Migrated in 20260415 and 20260419)
- [x] Migrate Dashboard to Unified API
- [x] Migrate PWA Frontend to Unified API
