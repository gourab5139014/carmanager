/**
 * metrics.js — pure functions for computing dashboard metrics from raw Supabase data.
 *
 * Input:  arrays of rows from the Supabase refuelings / services / expenses tables
 * Output: same shape as the old dashboard-data.json so index.html chart code is unchanged
 *
 * Exported for both browser (<script src="metrics.js">) and Node.js (require / tests).
 */

/**
 * Compute p95 of an array using linear interpolation (matches Python's numpy.percentile).
 * @param {number[]} sorted - sorted numeric array (ascending)
 * @returns {number|null}
 */
function p95(sorted) {
  if (!sorted.length) return null;
  const idx = (sorted.length - 1) * 0.95;
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, sorted.length - 1);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Compute all dashboard metrics from raw Supabase rows.
 *
 * @param {object[]} fillRows    - rows from `refuelings` table, any order
 * @param {object[]} serviceRows - rows from `services` table
 * @param {object[]} expenseRows - rows from `expenses` table
 * @returns {object} - { summary, fills, monthly, yearly, fuel_split, services, expenses }
 */
function computeMetrics(fillRows, serviceRows, expenseRows) {
  // ── Sort fills chronologically ──────────────────────────────────────────────
  const fills = [...fillRows].filter(r => r.date).sort((a, b) => a.date.localeCompare(b.date));

  // ── Per-fill MPG and cost-per-mile ─────────────────────────────────────────
  fills.forEach(f => {
    const d = f.distance_mi, v = f.volume_gal, c = f.total_cost;
    f.mpg          = (d && v && v > 0)  ? round2(d / v)    : null;
    f.cost_per_mile = (d && c && d > 0) ? round4(c / d)    : null;
  });

  // ── Rolling p95 MPG — 20-fill window ──────────────────────────────────────
  // P95 with window=20 is robust to missed-fill distance spikes:
  // it excludes ~1 outlier per window, so a doubled-distance fill doesn't
  // dominate the trend line the way a simple mean or max would.
  const mpgValues = fills.map(f => f.mpg);
  fills.forEach((f, i) => {
    const window = mpgValues
      .slice(Math.max(0, i - 19), i + 1)
      .filter(v => v != null)
      .sort((a, b) => a - b);
    f.mpg_p95 = window.length ? round2(p95(window)) : null;
  });

  // ── Monthly aggregates ─────────────────────────────────────────────────────
  const monthlyMap = {};
  fills.forEach(f => {
    const ym = f.date.slice(0, 7);
    if (!monthlyMap[ym]) monthlyMap[ym] = { cost: 0, volume_gal: 0, fills: 0, miles: 0 };
    monthlyMap[ym].cost       += f.total_cost  || 0;
    monthlyMap[ym].volume_gal += f.volume_gal  || 0;
    monthlyMap[ym].fills      += 1;
    monthlyMap[ym].miles      += f.distance_mi || 0;
  });
  const monthly = Object.keys(monthlyMap).sort().map(ym => ({
    month:      ym,
    cost:       round2(monthlyMap[ym].cost),
    volume_gal: round2(monthlyMap[ym].volume_gal),
    fills:      monthlyMap[ym].fills,
    miles:      round1(monthlyMap[ym].miles),
  }));

  // ── Yearly aggregates ──────────────────────────────────────────────────────
  const yearlyMap = {};
  fills.forEach(f => {
    const yr = f.date.slice(0, 4);
    if (!yearlyMap[yr]) yearlyMap[yr] = { cost: 0, miles: 0, fills: 0 };
    yearlyMap[yr].cost  += f.total_cost  || 0;
    yearlyMap[yr].miles += f.distance_mi || 0;
    yearlyMap[yr].fills += 1;
  });
  const yearly = Object.keys(yearlyMap).sort().map(yr => ({
    year:  yr,
    cost:  round2(yearlyMap[yr].cost),
    miles: round1(yearlyMap[yr].miles),
    fills: yearlyMap[yr].fills,
  }));

  // ── Fuel type split ────────────────────────────────────────────────────────
  const fuelMap = {};
  fills.forEach(f => {
    const ft = f.fuel_type || 'Unknown';
    if (!fuelMap[ft]) fuelMap[ft] = { fills: 0, cost: 0, volume_gal: 0 };
    fuelMap[ft].fills      += 1;
    fuelMap[ft].cost       += f.total_cost  || 0;
    fuelMap[ft].volume_gal += f.volume_gal  || 0;
  });
  const fuel_split = Object.entries(fuelMap).map(([ft, v]) => ({
    fuel_type:  ft,
    fills:      v.fills,
    cost:       round2(v.cost),
    volume_gal: round2(v.volume_gal),
  }));

  // ── Services / expenses — normalise field names ────────────────────────────
  // Supabase schema uses `cost`; old dashboard-data.json used `total_cost`.
  // Expose both so the services table in index.html keeps working unchanged.
  const services = [...serviceRows]
    .filter(r => r.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(s => ({
      ...s,
      total_cost: s.cost ?? s.total_cost ?? 0,
      types: s.types || (s.description ? [s.description] : []),
      notes: s.notes || '',
    }));

  const expenses = [...expenseRows]
    .filter(r => r.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(e => ({
      ...e,
      total_cost: e.cost ?? e.total_cost ?? 0,
      types: e.types || (e.description ? [e.description] : []),
      notes: e.notes || '',
    }));

  // ── Summary stats ──────────────────────────────────────────────────────────
  const validMpg  = fills.filter(f => f.mpg).map(f => f.mpg);
  const validCpm  = fills.filter(f => f.cost_per_mile).map(f => f.cost_per_mile);
  const totalFuel = fills.reduce((s, f) => s + (f.total_cost || 0), 0);
  const totalSvc  = services.reduce((s, sv) => s + (sv.total_cost || 0), 0);
  const totalExp  = expenses.reduce((s, e)  => s + (e.total_cost  || 0), 0);
  const odoms     = fills.map(f => f.odometer).filter(Boolean);
  const odomMax   = odoms.length ? odoms.reduce((m, v) => Math.max(m, v), -Infinity) : null;
  const odomMin   = odoms.length ? odoms.reduce((m, v) => Math.min(m, v), Infinity)  : null;

  // Days between consecutive fills
  const fillDates = fills.map(f => new Date(f.date.slice(0, 10) + 'T12:00:00Z').getTime());
  const gaps = fillDates.slice(1).map((d, i) => Math.round((d - fillDates[i]) / 86400000));
  const avgGap = gaps.length ? round1(gaps.reduce((s, g) => s + g, 0) / gaps.length) : null;

  const summary = {
    total_fills:            fills.length,
    total_fuel_cost_usd:    round2(totalFuel),
    total_service_cost_usd: round2(totalSvc),
    total_expense_cost_usd: round2(totalExp),
    total_cost_usd:         round2(totalFuel + totalSvc + totalExp),
    total_miles_driven:     odoms.length >= 2 ? Math.round(odomMax - odomMin) : 0,
    odometer_start:         odomMin,
    odometer_end:           odomMax,
    avg_mpg:                validMpg.length  ? round2(validMpg.reduce((s, v) => s + v, 0) / validMpg.length)  : null,
    avg_cost_per_mile_usd:  validCpm.length  ? round4(validCpm.reduce((s, v) => s + v, 0) / validCpm.length)  : null,
    avg_days_between_fills: avgGap,
    date_range_start:       fills.length ? fills[0].date                  : null,
    date_range_end:         fills.length ? fills[fills.length - 1].date   : null,
  };

  return { summary, fills, monthly, yearly, fuel_split, services, expenses };
}

// ── Rounding helpers ─────────────────────────────────────────────────────────
function round1(v) { return Math.round(v * 10) / 10; }
function round2(v) { return Math.round(v * 100) / 100; }
function round4(v) { return Math.round(v * 10000) / 10000; }

// Support both browser and Node.js (tests)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { computeMetrics, p95, round2 };
}
