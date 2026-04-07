#!/usr/bin/env python3
"""
process.py — reads drivvo_ada_export.json, computes dashboard metrics, writes dashboard-data.json
Run locally: python3 process.py
Run via GitHub Actions: automatically on push
"""

import json
import sys
from datetime import datetime, timedelta
from collections import defaultdict

INPUT_FILE = "drivvo_ada_export.json"
OUTPUT_FILE = "dashboard-data.json"


def parse_date(s):
    if not s:
        return None
    try:
        return datetime.strptime(s[:19], "%Y-%m-%d %H:%M:%S")
    except Exception:
        return None


def main():
    with open(INPUT_FILE) as f:
        raw = json.load(f)

    refuelings = raw.get("refuelings", [])
    services = raw.get("services", [])
    expenses = raw.get("expenses", [])
    incomes = raw.get("incomes", [])

    # ── Refueling records ─────────────────────────────────────────────────────
    fills = []
    for r in refuelings:
        dt = parse_date(r.get("data"))
        if not dt:
            continue
        tanks = r.get("tanques") or []
        volume = tanks[0]["volume"] if tanks else (r.get("volume") or 0)
        price_per_gal = r.get("preco") or (tanks[0].get("volumes", [{}])[0].get("preco") if tanks else 0) or 0
        total_cost = r.get("valor_total") or (tanks[0].get("valor_total") if tanks else 0) or 0
        odometer = r.get("odometro") or 0
        distance = r.get("distancia")  # miles since last fill, may be None
        full_tank = r.get("tanque_cheio", False)
        fuel_type = r.get("combustivel") or "Unknown"
        fills.append({
            "date": dt.strftime("%Y-%m-%d"),
            "odometer": odometer,
            "volume_gal": round(float(volume), 3) if volume else None,
            "price_per_gal": round(float(price_per_gal), 3) if price_per_gal else None,
            "total_cost": round(float(total_cost), 2) if total_cost else None,
            "distance_mi": float(distance) if distance else None,
            "full_tank": full_tank,
            "fuel_type": fuel_type,
        })

    fills.sort(key=lambda x: x["date"])

    # Compute mpg and cost_per_mile for each fill
    for i, f in enumerate(fills):
        mpg = None
        cost_per_mile = None
        if f["distance_mi"] and f["volume_gal"] and f["volume_gal"] > 0:
            mpg = round(f["distance_mi"] / f["volume_gal"], 2)
        if f["distance_mi"] and f["total_cost"] and f["distance_mi"] > 0:
            cost_per_mile = round(f["total_cost"] / f["distance_mi"], 4)
        f["mpg"] = mpg
        f["cost_per_mile"] = cost_per_mile

    # Rolling 5-fill average mpg
    mpg_values = [f["mpg"] for f in fills]
    for i, f in enumerate(fills):
        window = [v for v in mpg_values[max(0, i - 4):i + 1] if v is not None]
        f["mpg_rolling5"] = round(sum(window) / len(window), 2) if window else None

    # ── Monthly aggregates ────────────────────────────────────────────────────
    monthly = defaultdict(lambda: {"cost": 0.0, "volume_gal": 0.0, "fills": 0, "miles": 0.0})
    for f in fills:
        ym = f["date"][:7]  # "YYYY-MM"
        monthly[ym]["cost"] += f["total_cost"] or 0
        monthly[ym]["volume_gal"] += f["volume_gal"] or 0
        monthly[ym]["fills"] += 1
        monthly[ym]["miles"] += f["distance_mi"] or 0

    monthly_list = []
    for ym in sorted(monthly.keys()):
        m = monthly[ym]
        monthly_list.append({
            "month": ym,
            "cost": round(m["cost"], 2),
            "volume_gal": round(m["volume_gal"], 2),
            "fills": m["fills"],
            "miles": round(m["miles"], 1),
        })

    # ── Yearly aggregates ─────────────────────────────────────────────────────
    yearly = defaultdict(lambda: {"cost": 0.0, "miles": 0.0, "fills": 0})
    for f in fills:
        yr = f["date"][:4]
        yearly[yr]["cost"] += f["total_cost"] or 0
        yearly[yr]["miles"] += f["distance_mi"] or 0
        yearly[yr]["fills"] += 1

    yearly_list = [
        {"year": yr, "cost": round(yearly[yr]["cost"], 2), "miles": round(yearly[yr]["miles"], 1), "fills": yearly[yr]["fills"]}
        for yr in sorted(yearly.keys())
    ]

    # ── Fuel type split ───────────────────────────────────────────────────────
    fuel_split = defaultdict(lambda: {"fills": 0, "cost": 0.0, "volume_gal": 0.0})
    for f in fills:
        ft = f["fuel_type"]
        fuel_split[ft]["fills"] += 1
        fuel_split[ft]["cost"] += f["total_cost"] or 0
        fuel_split[ft]["volume_gal"] += f["volume_gal"] or 0

    fuel_split_list = [
        {"fuel_type": ft, "fills": v["fills"], "cost": round(v["cost"], 2), "volume_gal": round(v["volume_gal"], 2)}
        for ft, v in fuel_split.items()
    ]

    # ── Services ──────────────────────────────────────────────────────────────
    service_list = []
    for s in services:
        dt = parse_date(s.get("data"))
        if not dt:
            continue
        types = s.get("tipos_servico") or []
        total = sum(t.get("valor", 0) or 0 for t in types)
        names = [t.get("nome", "Unknown") for t in types]
        location = (s.get("local") or {}).get("nome", "")
        service_list.append({
            "date": dt.strftime("%Y-%m-%d"),
            "odometer": s.get("odometro"),
            "total_cost": round(float(total), 2),
            "types": names,
            "location": location,
            "notes": s.get("observacao", ""),
        })
    service_list.sort(key=lambda x: x["date"])

    # ── Expenses ─────────────────────────────────────────────────────────────
    expense_list = []
    for e in expenses:
        dt = parse_date(e.get("data"))
        if not dt:
            continue
        types = e.get("tipos_despesa") or []
        total = sum(t.get("valor", 0) or 0 for t in types)
        names = [t.get("nome", "Unknown") for t in types]
        expense_list.append({
            "date": dt.strftime("%Y-%m-%d"),
            "odometer": e.get("odometro"),
            "total_cost": round(float(total), 2),
            "types": names,
            "notes": e.get("observacao", ""),
        })
    expense_list.sort(key=lambda x: x["date"])

    # ── Summary stats ─────────────────────────────────────────────────────────
    valid_mpg = [f["mpg"] for f in fills if f["mpg"]]
    valid_cpm = [f["cost_per_mile"] for f in fills if f["cost_per_mile"]]
    total_fuel_cost = sum(f["total_cost"] or 0 for f in fills)
    total_service_cost = sum(s["total_cost"] for s in service_list)
    total_expense_cost = sum(e["total_cost"] for e in expense_list)
    all_odometers = [f["odometer"] for f in fills if f["odometer"]]
    total_miles = (max(all_odometers) - min(all_odometers)) if len(all_odometers) >= 2 else 0

    # Days between fills
    fill_dates = [datetime.strptime(f["date"], "%Y-%m-%d") for f in fills]
    gaps = [(fill_dates[i + 1] - fill_dates[i]).days for i in range(len(fill_dates) - 1)]
    avg_days_between_fills = round(sum(gaps) / len(gaps), 1) if gaps else None

    summary = {
        "total_fills": len(fills),
        "total_fuel_cost_usd": round(total_fuel_cost, 2),
        "total_service_cost_usd": round(total_service_cost, 2),
        "total_expense_cost_usd": round(total_expense_cost, 2),
        "total_cost_usd": round(total_fuel_cost + total_service_cost + total_expense_cost, 2),
        "total_miles_driven": round(total_miles, 0),
        "odometer_start": min(all_odometers) if all_odometers else None,
        "odometer_end": max(all_odometers) if all_odometers else None,
        "avg_mpg": round(sum(valid_mpg) / len(valid_mpg), 2) if valid_mpg else None,
        "avg_cost_per_mile_usd": round(sum(valid_cpm) / len(valid_cpm), 4) if valid_cpm else None,
        "avg_days_between_fills": avg_days_between_fills,
        "date_range_start": fills[0]["date"] if fills else None,
        "date_range_end": fills[-1]["date"] if fills else None,
        "generated_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }

    output = {
        "summary": summary,
        "fills": fills,
        "monthly": monthly_list,
        "yearly": yearly_list,
        "fuel_split": fuel_split_list,
        "services": service_list,
        "expenses": expense_list,
    }

    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f, indent=2)

    print(f"✓ Wrote {OUTPUT_FILE}")
    print(f"  {summary['total_fills']} fills | {summary['total_miles_driven']:.0f} miles | ${summary['total_fuel_cost_usd']:,.2f} fuel | avg {summary['avg_mpg']} mpg")


if __name__ == "__main__":
    main()
