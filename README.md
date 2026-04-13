# Car Analytics

![CI](https://github.com/gourab5139014/carmanager/actions/workflows/ci.yml/badge.svg)
![Deploy](https://github.com/gourab5139014/carmanager/actions/workflows/dashboard.yml/badge.svg)

Personal car analytics dashboard and mobile fuel logger built with Supabase and Claude OCR.

**Dashboard:** https://gourab5139014.github.io/carmanager/

## Features

- **Photo-first Logging:** Snap a photo of your odometer or gas pump, and Claude Haiku extracts the data automatically.
- **Supabase Backend:** Real-time data storage and Edge Functions for OCR.
- **Portable Architecture:** Hono-based backend logic can be deployed to any JS runtime (Supabase, Vercel, Node, etc.).
- **Interactive Dashboard:** Plotly.js charts for fuel efficiency, cost trends, and service history.

## Development

- `make test` — Run all tests (Python and Node.js).
- `make serve` — Start local development server.
- `make deploy-fn` — Deploy Supabase Edge Functions.

## Documentation

See the `.context/` directory for detailed startup-style departmental documentation and `MEMORY.md` for current project state.
