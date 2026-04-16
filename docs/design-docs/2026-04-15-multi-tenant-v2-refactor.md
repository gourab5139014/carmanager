# Multi-Tenant Car Manager (v2.0)
Date: 2026-04-15

## The Problem
The current v1.0 architecture is a single-user "personal" app with logic scattered between the frontend and a simple OCR proxy. To productize this, we need to:
1. Support multiple users securely.
2. Allow users to manage multiple vehicles.
3. Centralize business logic into a unified API to enable any frontend (Web, Mobile, MCP, etc.) to reuse it.

## The Solution
1. **Multi-Tenant Schema:** Add `user_id` and `vehicle_id` to all tables. Use Postgres RLS (Row Level Security) to ensure users can only ever see their own data.
2. **Unified Hono API:** Refactor the Edge Function into a full REST API (`/v1`) that handles auth, OCR, and DB operations in one place.
3. **PWA Frontend:** A modern, installable web app that interacts only with the `/v1` API.

## Technical Approach (The Bottleneck)
The core challenge is transitioning from a "public read" database to a strict "auth-only" multi-tenant system without losing existing data.

### 1. Database Architecture (Supabase/Postgres)
- **New Table:** `vehicles` (id, user_id, name, make, model, year, active).
- **Schema Updates:** Add `user_id` (uuid) and `vehicle_id` (uuid) to `refuelings`, `services`, and `expenses`.
- **Strict RLS:**
  ```sql
  -- Example Policy
  CREATE POLICY "User-specific access" ON refuelings
  FOR ALL USING (auth.uid() = user_id);
  ```

### 2. Backend Architecture (Hono on Supabase Edge)
- **Forwarded Auth:** The frontend passes the user's JWT in the `Authorization` header.
- **Auto-RLS Client:** Hono creates a Supabase client *using the user's JWT* for each request. This ensures the database automatically filters data based on the authenticated user.
- **Combined Routes:** 
  - `POST /v1/fills` now accepts an image + metadata. It runs OCR, computes distance, and inserts the record in a single atomic operation.

### 3. Implementation Plan
1. **Data Migration:**
   - Create the `vehicles` table.
   - Run a migration script to add `user_id` and `vehicle_id` to existing rows and link them to a default vehicle for the current user.
2. **Backend Refactor:**
   - Expand `src/app.ts` with Hono CRUD routes.
   - Add auth middleware to validate JWTs.
3. **Frontend Refactor:**
   - Migrate `index.html` and `mobile.html` into a unified Vite-based Single Page App (SPA).
   - Implement the "Vehicle Switcher" UI.
   - Configure the PWA manifest (`manifest.json`) for "Add to Home Screen" support.

## Success Metrics
- **Portability:** Any client with a valid JWT can log a fill via `POST /v1/fills`.
- **Security:** User A cannot see User B's data, even if they know the vehicle ID.
- **User Experience:** Zero manual entry (OCR) for any vehicle, on any device.
