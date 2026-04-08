#!/usr/bin/env python3
"""
sanitize.py — strips PII from drivvo_ada_export.json before public commit.

Removes:
  - Fuel station names, addresses, GPS coordinates (posto_combustivel)
  - Service/expense shop names, addresses, GPS coordinates (local)
  - Drivvo user ID (id_usuario_acao) and vehicle ID (id_veiculo)
  - Internal Drivvo UUIDs (id_unico) and record IDs
  - Action timestamps (data_acao) — app-internal metadata
  - Payment method fields
  - Driver name field (motorista)
  - File attachment lists (arquivos)
  - Time-of-day from timestamps (keep YYYY-MM-DD only)
  - Shop names from free-text notes (observacao)

Keeps:
  - Date (date only, no time)
  - Odometer readings
  - Fuel type, volume, price, total cost, distance, full-tank flag
  - Service type names (Oil Change, Battery, etc.) — generic categories
  - Service and expense costs
  - Anonymized sequential record IDs
"""

import json
import re

INPUT = "drivvo_ada_export.json"
OUTPUT = "drivvo_ada_export.json"  # overwrite in place

# Shop names found in notes — scrub these from observacao text
SHOP_NAMES_TO_SCRUB = [
    "Sunset 76",
    "Twin Peaks Petroleum",
    "Mission Tires",
    "American Tires Paso Robles",
    "American Tires",
    "Noe Valley Auto Works",
    "Noe Valley",
    "JT's Auto",
    "JT's",
    "Jiffy Lube Geary",
    "Jiffy Lube",
    "Amazon",
]

SHOP_WORD_PATTERNS = []

# Patterns that look like addresses or invoice numbers to scrub from notes
NOTE_SCRUB_PATTERNS = [
    r"Invoice\s*#\s*\d+",          # Invoice #139477
    r"\d{3,4}\s+\w+\s+(St|Ave|Blvd|Dr|Rd|Ln|Way|Pl)",  # street addresses
    r"[A-Z]{2}\s+\d{5}",           # state + ZIP
]


def scrub_date(s):
    """Keep YYYY-MM-DD only, drop time."""
    if not s:
        return s
    return s[:10]


def scrub_notes(text):
    """Remove shop names and identifiable references from free-text notes."""
    if not text:
        return text
    for name in SHOP_NAMES_TO_SCRUB:
        text = re.sub(re.escape(name), "[shop]", text, flags=re.IGNORECASE)
    for pattern in SHOP_WORD_PATTERNS:
        text = re.sub(pattern, "[shop]", text, flags=re.IGNORECASE)
    for pattern in NOTE_SCRUB_PATTERNS:
        text = re.sub(pattern, "[redacted]", text, flags=re.IGNORECASE)
    return text.strip()


def clean_refueling(r, idx):
    return {
        "id": idx + 1,
        "data": scrub_date(r.get("data")),
        "combustivel": r.get("combustivel"),
        "odometro": r.get("odometro"),
        "preco": r.get("preco"),
        "valor_total": r.get("valor_total"),
        "volume": r.get("tanques", [{}])[0].get("volume") if r.get("tanques") else r.get("volume"),
        "distancia": r.get("distancia"),
        "tanque_cheio": r.get("tanque_cheio"),
        "esqueceu_anterior": r.get("esqueceu_anterior"),
        "observacao": scrub_notes(r.get("observacao")),
    }


def clean_service(s, idx):
    tipos = []
    for t in (s.get("tipos_servico") or []):
        tipos.append({
            "nome": t.get("nome"),
            "valor": t.get("valor"),
        })
    return {
        "id": idx + 1,
        "data": scrub_date(s.get("data")),
        "odometro": s.get("odometro"),
        "tipos_servico": tipos,
        "observacao": scrub_notes(s.get("observacao")),
    }


def clean_expense(e, idx):
    tipos = []
    for t in (e.get("tipos_despesa") or []):
        tipos.append({
            "nome": t.get("nome"),
            "valor": t.get("valor"),
        })
    return {
        "id": idx + 1,
        "data": scrub_date(e.get("data")),
        "odometro": e.get("odometro"),
        "tipos_despesa": tipos,
        "observacao": scrub_notes(e.get("observacao")),
    }


def clean_income(i, idx):
    return {
        "id": idx + 1,
        "data": scrub_date(i.get("data")),
        "odometro": i.get("odometro"),
        "tipo_receita": i.get("tipo_receita"),
        "valor": i.get("valor"),
        "observacao": scrub_notes(i.get("observacao")),
    }


def main():
    with open(INPUT) as f:
        raw = json.load(f)

    clean = {
        "vehicle": {
            "make": "Lexus",
            "model": "ES 350",
            "year": 2010,
            "engine": "3.5L V6",
        },
        "refuelings": [clean_refueling(r, i) for i, r in enumerate(raw.get("refuelings", []))],
        "services":   [clean_service(s, i)   for i, s in enumerate(raw.get("services", []))],
        "expenses":   [clean_expense(e, i)   for i, e in enumerate(raw.get("expenses", []))],
        "incomes":    [clean_income(i, idx)  for idx, i in enumerate(raw.get("incomes", []))],
    }

    with open(OUTPUT, "w") as f:
        json.dump(clean, f, indent=2)

    print(f"✓ Sanitized {INPUT}")
    print(f"  Refuelings: {len(clean['refuelings'])}")
    print(f"  Services:   {len(clean['services'])}")
    print(f"  Expenses:   {len(clean['expenses'])}")
    print()
    print("Removed: station names/addresses/GPS, shop names/addresses, user ID,")
    print("         vehicle ID, Drivvo UUIDs, action timestamps, payment methods,")
    print("         driver field, file lists, time-of-day from timestamps.")
    print("Scrubbed: shop names and invoice numbers from free-text notes.")


if __name__ == "__main__":
    main()
