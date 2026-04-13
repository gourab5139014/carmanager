#!/usr/bin/env python3
"""
tests/test_migrate.py — unit tests for migrate.py parsing functions.
Run: python3 tests/test_migrate.py
"""

import sys
import os
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from migrate import parse_refuelings, parse_services, parse_expenses, parse_date


class TestParseDate(unittest.TestCase):
    def test_iso_date(self):
        self.assertEqual(parse_date("2024-03-15"), "2024-03-15")

    def test_datetime_string_truncated(self):
        self.assertEqual(parse_date("2024-03-15T10:30:00"), "2024-03-15")

    def test_none_returns_none(self):
        self.assertIsNone(parse_date(None))

    def test_empty_string_returns_none(self):
        self.assertIsNone(parse_date(""))

    def test_invalid_format_returns_none(self):
        self.assertIsNone(parse_date("not-a-date"))


class TestParseRefuelings(unittest.TestCase):
    def _make_raw(self, **kwargs):
        base = {
            "data": "2024-03-15",
            "odometro": 50000,
            "volume": 12.5,
            "preco": 3.799,
            "valor_total": 47.49,
            "distancia": 350.0,
            "tanque_cheio": True,
            "combustivel": "Gasoline",
            "observacao": "Shell on Main St",
            "tanques": [],
        }
        base.update(kwargs)
        return base

    def test_basic_fields_mapped(self):
        rows = parse_refuelings([self._make_raw()])
        self.assertEqual(len(rows), 1)
        r = rows[0]
        self.assertEqual(r["date"], "2024-03-15")
        self.assertEqual(r["odometer"], 50000)
        self.assertAlmostEqual(r["volume_gal"], 12.5, places=3)
        self.assertAlmostEqual(r["price_per_gal"], 3.799, places=3)
        self.assertAlmostEqual(r["total_cost"], 47.49, places=2)
        self.assertAlmostEqual(r["distance_mi"], 350.0, places=1)
        self.assertTrue(r["full_tank"])
        self.assertEqual(r["fuel_type"], "Gasoline")
        self.assertEqual(r["notes"], "Shell on Main St")

    def test_missing_date_skipped(self):
        rows = parse_refuelings([self._make_raw(data=None)])
        self.assertEqual(len(rows), 0)

    def test_empty_notes_becomes_none(self):
        rows = parse_refuelings([self._make_raw(observacao="")])
        self.assertIsNone(rows[0]["notes"])

    def test_null_observation_becomes_none(self):
        rows = parse_refuelings([self._make_raw(observacao=None)])
        self.assertIsNone(rows[0]["notes"])

    def test_missing_distance_is_none(self):
        rows = parse_refuelings([self._make_raw(distancia=None)])
        self.assertIsNone(rows[0]["distance_mi"])

    def test_missing_price_is_none(self):
        rows = parse_refuelings([self._make_raw(preco=None)])
        self.assertIsNone(rows[0]["price_per_gal"])

    def test_odometer_cast_to_int(self):
        rows = parse_refuelings([self._make_raw(odometro=50000.7)])
        self.assertIsInstance(rows[0]["odometer"], int)
        self.assertEqual(rows[0]["odometer"], 50000)

    def test_full_tank_false(self):
        rows = parse_refuelings([self._make_raw(tanque_cheio=False)])
        self.assertFalse(rows[0]["full_tank"])

    def test_volume_rounded_to_3_decimals(self):
        rows = parse_refuelings([self._make_raw(volume=12.5678)])
        self.assertEqual(rows[0]["volume_gal"], 12.568)

    def test_total_cost_rounded_to_2_decimals(self):
        rows = parse_refuelings([self._make_raw(valor_total=47.4999)])
        self.assertEqual(rows[0]["total_cost"], 47.50)

    def test_multiple_records(self):
        raw = [self._make_raw(data="2024-01-01"), self._make_raw(data="2024-02-01")]
        rows = parse_refuelings(raw)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["date"], "2024-01-01")
        self.assertEqual(rows[1]["date"], "2024-02-01")

    def test_empty_input(self):
        self.assertEqual(parse_refuelings([]), [])


class TestParseServices(unittest.TestCase):
    def _make_raw(self, **kwargs):
        base = {
            "data": "2024-03-20",
            "odometro": 50500,
            "tipos_servico": [
                {"nome": "Oil Change", "valor": 45.00},
                {"nome": "Filter", "valor": 15.00},
            ],
            "local": {"nome": "Jiffy Lube"},
            "observacao": "Full synthetic",
        }
        base.update(kwargs)
        return base

    def test_basic_fields(self):
        rows = parse_services([self._make_raw()])
        self.assertEqual(len(rows), 1)
        r = rows[0]
        self.assertEqual(r["date"], "2024-03-20")
        self.assertEqual(r["odometer"], 50500)
        self.assertAlmostEqual(r["cost"], 60.0, places=2)
        self.assertEqual(r["description"], "Oil Change, Filter")
        self.assertEqual(r["category"], "Oil Change")
        self.assertEqual(r["location"], "Jiffy Lube")
        self.assertEqual(r["notes"], "Full synthetic")

    def test_missing_date_skipped(self):
        rows = parse_services([self._make_raw(data=None)])
        self.assertEqual(len(rows), 0)

    def test_single_service_type(self):
        raw = self._make_raw(tipos_servico=[{"nome": "Tire Rotation", "valor": 25.00}])
        rows = parse_services([raw])
        self.assertEqual(rows[0]["description"], "Tire Rotation")
        self.assertEqual(rows[0]["category"], "Tire Rotation")

    def test_cost_summed_across_types(self):
        raw = self._make_raw(tipos_servico=[
            {"nome": "Brakes", "valor": 200.00},
            {"nome": "Pads", "valor": 80.00},
        ])
        rows = parse_services([raw])
        self.assertAlmostEqual(rows[0]["cost"], 280.0, places=2)

    def test_no_location_is_none(self):
        rows = parse_services([self._make_raw(local=None)])
        self.assertIsNone(rows[0]["location"])

    def test_empty_service_types(self):
        raw = self._make_raw(tipos_servico=[])
        rows = parse_services([raw])
        self.assertEqual(rows[0]["description"], "Service")
        self.assertAlmostEqual(rows[0]["cost"], 0.0, places=2)

    def test_empty_input(self):
        self.assertEqual(parse_services([]), [])


class TestParseExpenses(unittest.TestCase):
    def _make_raw(self, **kwargs):
        base = {
            "data": "2024-04-01",
            "odometro": 51000,
            "tipos_despesa": [{"nome": "Registration", "valor": 120.00}],
            "observacao": "Annual renewal",
        }
        base.update(kwargs)
        return base

    def test_basic_fields(self):
        rows = parse_expenses([self._make_raw()])
        self.assertEqual(len(rows), 1)
        r = rows[0]
        self.assertEqual(r["date"], "2024-04-01")
        self.assertEqual(r["odometer"], 51000)
        self.assertAlmostEqual(r["cost"], 120.0, places=2)
        self.assertEqual(r["description"], "Registration")
        self.assertEqual(r["category"], "Registration")
        self.assertEqual(r["notes"], "Annual renewal")

    def test_missing_date_skipped(self):
        rows = parse_expenses([self._make_raw(data=None)])
        self.assertEqual(len(rows), 0)

    def test_multiple_expense_types_cost_summed(self):
        raw = self._make_raw(tipos_despesa=[
            {"nome": "Parking", "valor": 30.00},
            {"nome": "Toll", "valor": 10.00},
        ])
        rows = parse_expenses([raw])
        self.assertAlmostEqual(rows[0]["cost"], 40.0, places=2)

    def test_null_notes_is_none(self):
        rows = parse_expenses([self._make_raw(observacao=None)])
        self.assertIsNone(rows[0]["notes"])

    def test_empty_input(self):
        self.assertEqual(parse_expenses([]), [])


if __name__ == "__main__":
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    suite.addTests(loader.loadTestsFromTestCase(TestParseDate))
    suite.addTests(loader.loadTestsFromTestCase(TestParseRefuelings))
    suite.addTests(loader.loadTestsFromTestCase(TestParseServices))
    suite.addTests(loader.loadTestsFromTestCase(TestParseExpenses))

    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
