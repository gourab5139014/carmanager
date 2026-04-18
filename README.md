# Car Manager v2.0

![CI](https://github.com/gourab5139014/carmanager/actions/workflows/ci.yml/badge.svg)
![Deploy](https://github.com/gourab5139014/carmanager/actions/workflows/dashboard.yml/badge.svg)

A modern, multi-tenant car analytics platform and mobile fuel logger built with Supabase, Hono, and Claude Vision OCR.

**Live Dashboard:** [https://gourab5139014.github.io/carmanager/](https://gourab5139014.github.io/carmanager/)

## 🚀 Features

- **Multi-Vehicle Support:** Track fuel, services, and expenses for an unlimited number of vehicles.
- **Secure Multi-Tenancy:** Strict data isolation using Supabase Row Level Security (RLS).
- **Photo-First Logging:** Snap a photo of your odometer or gas pump; Claude Haiku extracts the data automatically via a unified API.
- **Unified Hono API:** A centralized REST API (`/v1`) that handles OCR, distance computations, and database operations.
- **PWA Frontend:** A modern, installable Single Page Application (SPA) built with Vite and TypeScript for a native mobile experience.
- **Interactive Analytics:** Plotly.js charts for MPG trends, cost analysis, and service history.

## 🛠 Architecture

- **Frontend:** Vite + TypeScript + Plotly.js (deployed to GitHub Pages).
- **Backend:** Hono API (deployed to Supabase Edge Functions).
- **Database:** Supabase Postgres (managed via migrations).
- **OCR:** Anthropic Claude Vision API.

## 💻 Development

### Prerequisites
- Node.js 20+
- Python 3.11+
- Supabase CLI

### Local Setup
1. Clone the repo.
2. Install frontend dependencies: `cd frontend && npm install`.
3. Set up environment variables: `cp frontend/.env.example frontend/.env` (add your Supabase keys).
4. Start local frontend server: `make serve`.

### Testing
- Run all tests (JS + Python): `make test`.
- Run JS metrics tests only: `make test-js`.
- Run Python migration tests only: `make test-py`.

### Deployment
- **Frontend:** Automatically deployed to GitHub Pages on every push to `main`.
- **API:** Deploy Supabase Edge Functions: `make deploy-fn`.
- **Database:** Run SQL migrations found in `supabase/migrations/` via the Supabase Dashboard.

## 📖 Documentation

For deep technical context, architectural decisions, and roadmaps, see the `.context/` directory:
- [Engineering & Product Brain](.context/product-eng.md)
- [DevOps & Infrastructure Brain](.context/ops.md)
- [Marketing & Growth Brain](.context/marketing.md)
