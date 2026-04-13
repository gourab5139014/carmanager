# Engineering & Product Brain

## Tech Stack
- **Frontend:** Vanilla JS + Plotly.js + Supabase SDK (CDN-based).
- **Backend:** Supabase Edge Functions + Hono (Deno-based).
- **Database:** Supabase Postgres.
- **Hosting:** GitHub Pages (Frontend), Supabase (Backend).
- **OCR Engine:** Claude-3-Haiku via Anthropic Vision API.

## Database Schema (v1.0)
- **refuelings**: `id`, `date`, `odometer`, `volume_gal`, `price_per_gal`, `total_cost`, `distance_mi`, `full_tank`, `fuel_type`, `notes`.
- **services**: `id`, `date`, `odometer`, `description`, `cost`, `category`, `notes`, `location`.
- **expenses**: `id`, `date`, `odometer`, `description`, `cost`, `category`, `notes`.

## Architectural Principles
1. **Portability First:** Core business logic lives in `src/` and is platform-agnostic.
2. **Vanilla Frontend:** No React/Tailwind. Use simple CSS and standard Web SDKs for speed.
3. **Async OCR:** Frontend converts images to JPEG/base64 before POSTing to the Edge Function.
4. **Hono as Adapter:** Use Hono to wrap Edge Function logic to allow future migration to Bun/Vercel/Node.

## Rules for AI Agents
- **Indentation:** 2 spaces.
- **Language:** TypeScript for backend logic, JavaScript for frontend.
- **Naming:** `volume_gal`, `distance_mi`, `price_per_gal` (be specific about units).
- **Errors:** Return graceful JSON in `ocr-service.ts`, never just crash.
- **Style:** Professional, fast, utilitarian UI.
