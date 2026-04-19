#!/usr/bin/env python3
"""
migrate.py — import of drivvo_ada_export.json into Supabase.

Usage:
    export SUPABASE_URL=https://xxxx.supabase.co
    export SUPABASE_SERVICE_KEY=eyJ...
    export SUPABASE_SCHEMA=legacy       # Optional, defaults to legacy
    export USER_ID=your-user-uuid
    export VEHICLE_ID=your-vehicle-uuid
    python3 migrate.py [--dry-run]
"""

import json
import os
import sys
import argparse
import urllib.request
import urllib.error
from datetime import datetime

INPUT_FILE = "drivvo_ada_export.json"


def parse_date(s):
    if not s:
        return None
    try:
        return datetime.strptime(s[:10], "%Y-%m-%d").strftime("%Y-%m-%d")
    except Exception:
        return None


def parse_refuelings(raw_refuelings, user_id=None, vehicle_id=None):
    rows = []
    for r in raw_refuelings:
        date = parse_date(r.get("data"))
        if not date:
            continue
        tanks = r.get("tanques") or []
        volume      = tanks[0]["volume"] if tanks else (r.get("volume") or 0)
        price_pg    = r.get("preco") or (tanks[0].get("volumes", [{}])[0].get("preco") if tanks else 0) or 0
        total_cost  = r.get("valor_total") or (tanks[0].get("valor_total") if tanks else 0) or 0
        odometer    = r.get("odometro") or 0
        distance    = r.get("distancia")
        full_tank   = bool(r.get("tanque_cheio", False))
        fuel_type   = r.get("combustivel") or "Unknown"
        notes       = r.get("observacao") or ""
        row = {
            "date":          date,
            "odometer":      int(odometer) if odometer else None,
            "volume_gal":    round(float(volume), 3)    if volume    else None,
            "price_per_gal": round(float(price_pg), 3)  if price_pg  else None,
            "total_cost":    round(float(total_cost), 2) if total_cost else None,
            "distance_mi":   round(float(distance), 1)  if distance  else None,
            "full_tank":     full_tank,
            "fuel_type":     fuel_type,
            "notes":         notes or None,
        }
        if user_id: row["user_id"] = user_id
        if vehicle_id: row["vehicle_id"] = vehicle_id
        rows.append(row)
    return rows


def parse_services(raw_services, user_id=None, vehicle_id=None):
    rows = []
    for s in raw_services:
        date = parse_date(s.get("data"))
        if not date:
            continue
        types       = s.get("tipos_servico") or []
        total_cost  = sum(t.get("valor", 0) or 0 for t in types)
        description = ", ".join(t.get("nome", "Unknown") for t in types) or "Service"
        location    = (s.get("local") or {}).get("nome", "") or None
        notes       = s.get("observacao") or None
        row = {
            "date":        date,
            "odometer":    s.get("odometro") or None,
            "description": description,
            "cost":        round(float(total_cost), 2),
            "category":    description.split(",")[0].strip() if description else None,
            "notes":       notes,
            "location":    location,
        }
        if user_id: row["user_id"] = user_id
        if vehicle_id: row["vehicle_id"] = vehicle_id
        rows.append(row)
    return rows


def parse_expenses(raw_expenses, user_id=None, vehicle_id=None):
    rows = []
    for e in raw_expenses:
        date = parse_date(e.get("data"))
        if not date:
            continue
        types       = e.get("tipos_despesa") or []
        total_cost  = sum(t.get("valor", 0) or 0 for t in types)
        description = ", ".join(t.get("nome", "Unknown") for t in types) or "Expense"
        notes       = e.get("observacao") or None
        row = {
            "date":        date,
            "odometer":    e.get("odometro") or None,
            "description": description,
            "cost":        round(float(total_cost), 2),
            "category":    description.split(",")[0].strip() if description else None,
            "notes":       notes,
        }
        if user_id: row["user_id"] = user_id
        if vehicle_id: row["vehicle_id"] = vehicle_id
        rows.append(row)
    return rows


def supabase_insert(url, service_key, table, rows, dry_run=False, schema='legacy'):
    """Bulk insert rows into a Supabase table via the REST API."""
    if not rows:
        print(f"  {table}: 0 rows, skipping")
        return 0

    if dry_run:
        print(f"  {table}: {len(rows)} rows (dry run — not inserted)")
        for r in rows[:3]:
            print(f"    {r}")
        if len(rows) > 3:
            print(f"    ... and {len(rows) - 3} more")
        return len(rows)

    endpoint = f"{url}/rest/v1/{table}"
    payload  = json.dumps(rows).encode()
    req = urllib.request.Request(
        endpoint,
        data=payload,
        headers={
            "apikey":          service_key,
            "Authorization":   f"Bearer {service_key}",
            "Content-Type":    "application/json",
            "Prefer":          "return=minimal",
            "Content-Profile": schema,
            "Accept-Profile":  schema,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"  {table}: inserted {len(rows)} rows into '{schema}' schema (HTTP {resp.status})")
            return len(rows)
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  ERROR inserting into {table} (schema: {schema}): HTTP {e.code} — {body}", file=sys.stderr)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Migrate drivvo_ada_export.json to Supabase")
    parser.add_argument("--dry-run", action="store_true", help="Parse and print, do not insert")
    args = parser.parse_args()

    supabase_url    = os.environ.get("SUPABASE_URL", "").rstrip("/")
    service_key     = os.environ.get("SUPABASE_SERVICE_KEY", "")
    supabase_schema = os.environ.get("SUPABASE_SCHEMA", "legacy")
    user_id         = os.environ.get("USER_ID", "")
    vehicle_id      = os.environ.get("VEHICLE_ID", "")

    if not args.dry_run:
        if not supabase_url:
            print("ERROR: set SUPABASE_URL environment variable", file=sys.stderr)
            sys.exit(1)
        if not service_key:
            print("ERROR: set SUPABASE_SERVICE_KEY environment variable", file=sys.stderr)
            sys.exit(1)
        if not user_id:
            print("ERROR: set USER_ID environment variable", file=sys.stderr)
            sys.exit(1)
        if not vehicle_id:
            print("ERROR: set VEHICLE_ID environment variable", file=sys.stderr)
            sys.exit(1)

    print(f"Reading {INPUT_FILE} ...")
    with open(INPUT_FILE) as f:
        raw = json.load(f)

    refueling_rows = parse_refuelings(raw.get("refuelings", []), user_id, vehicle_id)
    service_rows   = parse_services(raw.get("services", []), user_id, vehicle_id)
    expense_rows   = parse_expenses(raw.get("expenses", []), user_id, vehicle_id)

    print(f"Parsed: {len(refueling_rows)} refuelings, {len(service_rows)} services, {len(expense_rows)} expenses")
    print()

    if args.dry_run:
        print("DRY RUN — no data will be inserted")
    else:
        print(f"Inserting into {supabase_url} (schema: {supabase_schema}) ...")

    supabase_insert(supabase_url, service_key, "refuelings", refueling_rows, args.dry_run, supabase_schema)
    supabase_insert(supabase_url, service_key, "services",   service_rows,   args.dry_run, supabase_schema)
    supabase_insert(supabase_url, service_key, "expenses",   expense_rows,   args.dry_run, supabase_schema)

    print()
    print("Done.")
    if args.dry_run:
        print("Re-run without --dry-run to actually insert data.")


if __name__ == "__main__":
    main()
