# Productization Phase: Unified API & PWA Frontend
Date: 2026-04-15

## The Problem
Currently, the "brains" of the app are scattered. `index.html` and `mobile.html` use the Supabase SDK to talk directly to the database. This logic is hard to reuse for other frontends (like a future MCP server). Alpha users need a modern, "installed-feeling" mobile app experience that doesn't cost us anything to host or maintain.

## The Solution
1. **Unified API Layer:** Move all database logic (CRUD) into our Hono Edge Function. The frontend only talks to our `/api/v1` routes, not Postgres directly. This "black-boxes" the data layer.
2. **PWA Frontend:** Deliver the dashboard as a Progressive Web App (PWA). Users can "Add to Home Screen" on iOS/Android for a native-like experience (custom icons, splash screens, offline support).
3. **No-Cost Hosting:** Continue using GitHub Pages or switch to **Vercel** for better CI/CD and easier preview deployments for alpha feedback.

## Technical Approach
The bottleneck is decoupling the Supabase SDK from the frontend.
1. **API Refactor:** Expand `src/app.ts` (Hono) to include authenticated REST routes:
   - `GET /api/v1/fills` -> List all refueling records (with multi-tenancy filter).
   - `POST /api/v1/fills` -> Log a new fill (includes OCR + distance logic).
   - `GET /api/v1/vehicles` -> List vehicles.
2. **Frontend Modernization:** 
   - Move to a simple SPA structure (Single Page App). 
   - Use a **Vite-based** build pipeline (standard for modern web) to enable easy PWA manifest generation.
   - Replace direct `sb.from('refuelings').select('*')` calls with `fetch('/api/v1/fills')`.
3. **Auth:** Pass the Supabase JWT from the frontend to the Hono API in the `Authorization: Bearer <token>` header. Hono validates this using a standard Supabase middleware.

## Success Metrics
- **The Feedback Loop:** Frontend works exactly as before but with *zero* direct DB queries.
- **Portability:** We can hit `GET /api/v1/fills` from a `curl` command or an MCP server and get the same results as the web app.
- **Cost:** Hosting remains $0.
