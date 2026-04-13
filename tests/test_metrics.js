/**
 * tests/test_metrics.js — standalone tests for metrics.js
 * Run: node tests/test_metrics.js
 */

const { computeMetrics, p95, round2 } = require('../metrics.js');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}`);
    failed++;
  }
}

function assertEqual(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}  →  got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
    failed++;
  }
}

// ── p95 ───────────────────────────────────────────────────────────────────────
console.log('\np95():');
assertEqual(p95([1]), 1, 'single element returns itself');
assertEqual(round2(p95([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])), 9.55, 'p95 of 1..10');
assertEqual(p95([10, 20]), 19.5, 'p95 of [10,20]');
assert(p95([]) === null, 'empty array returns null');

// ── MPG computation ───────────────────────────────────────────────────────────
console.log('\nMPG:');
const simpleFills = [
  { date: '2024-01-01', odometer: 1000, volume_gal: 10, total_cost: 40, distance_mi: 300, fuel_type: 'Gasoline', full_tank: true },
  { date: '2024-02-01', odometer: 1300, volume_gal: 12, total_cost: 48, distance_mi: 360, fuel_type: 'Gasoline', full_tank: true },
  { date: '2024-03-01', odometer: 1660, volume_gal: 8,  total_cost: 32, distance_mi: null, fuel_type: 'Gasoline', full_tank: false },
];
const r1 = computeMetrics(simpleFills, [], []);
assertEqual(r1.fills[0].mpg, 30, 'fill 0: 300mi / 10gal = 30mpg');
assertEqual(r1.fills[1].mpg, 30, 'fill 1: 360mi / 12gal = 30mpg');
assertEqual(r1.fills[2].mpg, null, 'fill 2: no distance_mi → mpg null');

// ── cost_per_mile ─────────────────────────────────────────────────────────────
console.log('\ncost_per_mile:');
assertEqual(r1.fills[0].cost_per_mile, 0.1333, 'fill 0: $40 / 300mi (round4)');
assertEqual(r1.fills[2].cost_per_mile, null, 'fill 2: no distance → cost_per_mile null');

// ── Rolling p95 MPG ───────────────────────────────────────────────────────────
console.log('\nRolling p95 MPG:');
// Window of 1 for first fill: p95([30]) = 30
assertEqual(r1.fills[0].mpg_p95, 30, 'fill 0: p95 window=[30]');
// Window of 2 for second fill: sorted [30,30], p95 = 30
assertEqual(r1.fills[1].mpg_p95, 30, 'fill 1: p95 window=[30,30]');
// Third fill has no mpg, window stays [30,30]
assertEqual(r1.fills[2].mpg_p95, 30, 'fill 2: p95 window=[30,30] (null excluded)');

// ── Monthly aggregates ────────────────────────────────────────────────────────
console.log('\nMonthly aggregates:');
assertEqual(r1.monthly.length, 3, '3 fills in 3 different months → 3 monthly rows');
const jan = r1.monthly.find(m => m.month === '2024-01');
assert(jan !== undefined, 'January exists');
assertEqual(jan.cost, 40, 'Jan cost = $40');
assertEqual(jan.volume_gal, 10, 'Jan volume = 10 gal');
assertEqual(jan.fills, 1, 'Jan fills = 1');
assertEqual(jan.miles, 300, 'Jan miles = 300');

// ── Yearly aggregates ─────────────────────────────────────────────────────────
console.log('\nYearly aggregates:');
assertEqual(r1.yearly.length, 1, 'All 3 fills in 2024 → 1 yearly row');
assertEqual(r1.yearly[0].year, '2024', 'year = 2024');
assertEqual(r1.yearly[0].cost, 120, 'total cost = $120');
assertEqual(r1.yearly[0].fills, 3, 'fills = 3');

// ── Fuel split ────────────────────────────────────────────────────────────────
console.log('\nFuel split:');
assertEqual(r1.fuel_split.length, 1, 'only Gasoline → 1 split entry');
assertEqual(r1.fuel_split[0].fuel_type, 'Gasoline', 'fuel_type = Gasoline');
assertEqual(r1.fuel_split[0].fills, 3, 'fills = 3');
assertEqual(r1.fuel_split[0].cost, 120, 'cost = $120');

// Multi-type split
const mixedFills = [
  { date: '2024-01-01', odometer: 100, volume_gal: 10, total_cost: 40, distance_mi: 300, fuel_type: 'Gasoline',    full_tank: true },
  { date: '2024-02-01', odometer: 400, volume_gal: 8,  total_cost: 36, distance_mi: 250, fuel_type: 'Gas Premium', full_tank: true },
];
const r2 = computeMetrics(mixedFills, [], []);
assertEqual(r2.fuel_split.length, 2, 'two fuel types → 2 split entries');

// ── Summary stats ─────────────────────────────────────────────────────────────
console.log('\nSummary stats:');
assertEqual(r1.summary.total_fills, 3, 'total_fills = 3');
assertEqual(r1.summary.total_fuel_cost_usd, 120, 'total_fuel_cost_usd = 120');
assertEqual(r1.summary.odometer_start, 1000, 'odometer_start = 1000');
assertEqual(r1.summary.odometer_end, 1660, 'odometer_end = 1660');
assertEqual(r1.summary.total_miles_driven, 660, 'total_miles_driven = 660');
assertEqual(r1.summary.avg_mpg, 30, 'avg_mpg = 30 (only 2 fills have mpg)');
assertEqual(r1.summary.date_range_start, '2024-01-01', 'date_range_start');
assertEqual(r1.summary.date_range_end, '2024-03-01', 'date_range_end');

// ── Services / expenses ───────────────────────────────────────────────────────
console.log('\nServices & expenses:');
const svcRows = [
  { date: '2024-02-15', odometer: 1200, description: 'Oil Change', cost: 75.00, notes: 'Synthetic' },
];
const expRows = [
  { date: '2024-01-10', odometer: null, description: 'Registration', cost: 120.00, notes: null },
];
const r3 = computeMetrics(simpleFills, svcRows, expRows);
assertEqual(r3.summary.total_service_cost_usd, 75, 'service cost = $75');
assertEqual(r3.summary.total_expense_cost_usd, 120, 'expense cost = $120');
assertEqual(r3.summary.total_cost_usd, 315, 'total cost = $120 fuel + $75 svc + $120 exp = $315');
assertEqual(r3.services[0].total_cost, 75, 'services[0].total_cost normalized from .cost');
assertEqual(r3.expenses[0].total_cost, 120, 'expenses[0].total_cost normalized from .cost');

// ── Empty inputs ──────────────────────────────────────────────────────────────
console.log('\nEmpty inputs:');
const empty = computeMetrics([], [], []);
assertEqual(empty.summary.total_fills, 0, 'total_fills = 0');
assertEqual(empty.summary.date_range_start, null, 'date_range_start = null');
assertEqual(empty.fills.length, 0, 'fills = []');
assertEqual(empty.monthly.length, 0, 'monthly = []');

// ── Result ────────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
