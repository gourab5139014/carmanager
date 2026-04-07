# Car Analytics

Personal car analytics dashboard built from Drivvo export data.

**Dashboard:** https://gourab5139014.github.io/carmanager/

## How it works

- `drivvo_ada_export.json` — source of truth (Drivvo export)
- `process.py` — computes metrics, writes `dashboard-data.json`
- `index.html` — Plotly.js dashboard, reads `dashboard-data.json`
- GitHub Actions runs `process.py` on every push and redeploys

## Adding a new record

Tell Claude Code the details (date, odometer, fuel type, gallons, price/gal, total) and it will append to `drivvo_ada_export.json` and commit.
