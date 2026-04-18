/**
 * metrics.ts — pure functions for computing dashboard metrics from raw Supabase data.
 *
 * Input:  arrays of rows from the Supabase refuelings / services / expenses tables
 * Output: dashboard-data.json shape so index.html chart code is unchanged
 */

function round1(v: number) { return Math.round(v * 10) / 10; }
export function round2(v: number) { return Math.round(v * 100) / 100; }
function round4(v: number) { return Math.round(v * 10000) / 10000; }

/**
 * Compute p95 of an array using linear interpolation.
 */
export function p95(sorted: number[]) {
  if (!sorted.length) return null;
  const idx = (sorted.length - 1) * 0.95;
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, sorted.length - 1);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function computeMetrics(fillRows: any[], serviceRows: any[] = [], expenseRows: any[] = []) {
  // ── Sort fills chronologically ──────────────────────────────────────────────
  const fills = [...fillRows].filter(r => r.date).sort((a, b) => a.date.localeCompare(b.date));

  // ── Per-fill MPG and cost-per-mile ─────────────────────────────────────────
  fills.forEach(f => {
    const d = f.distance_mi, v = f.volume_gal, c = f.total_cost;
    f.mpg          = (d && v && v > 0)  ? round2(d / v)    : null;
    f.cost_per_mile = (d && c && d > 0) ? round4(c / d)    : null;
  });

  // ── Rolling p95 MPG — 20-fill window ──────────────────────────────────────
  const mpgValues = fills.map(f => f.mpg);
  fills.forEach((f, i) => {
    const window = mpgValues
      .slice(Math.max(0, i - 19), i + 1)
      .filter(v => v != null)
      .sort((a, b) => a - b);
    f.mpg_p95 = window.length ? round2(p95(window as number[])!) : null;
  });

  // ── Monthly aggregates ─────────────────────────────────────────────────────
  const monthlyMap: Record<string, any> = {};
  fills.forEach(f => {
    const ym = f.date.slice(0, 7);
    if (!monthlyMap[ym]) monthlyMap[ym] = { cost: 0, volume_gal: 0, fills: 0, miles: 0 };
    monthlyMap[ym].cost       += Number(f.total_cost)  || 0;
    monthlyMap[ym].volume_gal += Number(f.volume_gal)  || 0;
    monthlyMap[ym].fills      += 1;
    monthlyMap[ym].miles      += Number(f.distance_mi) || 0;
  });
  const monthly = Object.keys(monthlyMap).sort().map(ym => ({
    month:      ym,
    cost:       round2(monthlyMap[ym].cost),
    volume_gal: round2(monthlyMap[ym].volume_gal),
    fills:      monthlyMap[ym].fills,
    miles:      round1(monthlyMap[ym].miles),
  }));

  // ── Yearly aggregates ──────────────────────────────────────────────────────
  const yearlyMap: Record<string, any> = {};
  fills.forEach(f => {
    const yr = f.date.slice(0, 4);
    if (!yearlyMap[yr]) yearlyMap[yr] = { cost: 0, miles: 0, fills: 0 };
    yearlyMap[yr].cost  += Number(f.total_cost)  || 0;
    yearlyMap[yr].miles += Number(f.distance_mi) || 0;
    yearlyMap[yr].fills += 1;
  });
  const yearly = Object.keys(yearlyMap).sort().map(yr => ({
    year:  yr,
    cost:  round2(yearlyMap[yr].cost),
    miles: round1(yearlyMap[yr].miles),
    fills: yearlyMap[yr].fills,
  }));

  // ── Fuel type split ────────────────────────────────────────────────────────
  const fuelMap: Record<string, any> = {};
  fills.forEach(f => {
    const ft = f.fuel_type || 'Unknown';
    if (!fuelMap[ft]) fuelMap[ft] = { fills: 0, cost: 0, volume_gal: 0 };
    fuelMap[ft].fills      += 1;
    fuelMap[ft].cost       += Number(f.total_cost)  || 0;
    fuelMap[ft].volume_gal += Number(f.volume_gal)  || 0;
  });
  const fuel_split = Object.entries(fuelMap).map(([ft, v]: [string, any]) => ({
    fuel_type:  ft,
    fills:      v.fills,
    cost:       round2(v.cost),
    volume_gal: round2(v.volume_gal),
  }));

  // ── Summary stats ─────────────────────────────────────────────────────────
  const valid_mpg = fills.map(f => f.mpg).filter(v => v != null);
  const valid_cpm = fills.map(f => f.cost_per_mile).filter(v => v != null);
  const total_fuel_cost = fills.reduce((sum, f) => sum + (Number(f.total_cost) || 0), 0);
  const total_service_cost = serviceRows.reduce((sum, s) => sum + (Number(s.cost) || 0), 0);
  const total_expense_cost = expenseRows.reduce((sum, e) => sum + (Number(e.cost) || 0), 0);
  const all_odometers = fills.map(f => f.odometer).filter(o => o != null);
  const odometer_start = all_odometers.length ? Math.min(...all_odometers) : null;
  const odometer_end = all_odometers.length ? Math.max(...all_odometers) : null;
  const total_miles = (odometer_end !== null && odometer_start !== null) ? (odometer_end - odometer_start) : 0;

  const summary = {
    total_fills: fills.length,
    total_fuel_cost_usd: round2(total_fuel_cost),
    total_service_cost_usd: round2(total_service_cost),
    total_expense_cost_usd: round2(total_expense_cost),
    total_cost_usd: round2(total_fuel_cost + total_service_cost + total_expense_cost),
    total_miles_driven: round1(total_miles),
    odometer_start,
    odometer_end,
    avg_mpg: valid_mpg.length ? round2(valid_mpg.reduce((a, b) => a + b, 0) / valid_mpg.length) : null,
    avg_cost_per_mile_usd: valid_cpm.length ? round4(valid_cpm.reduce((a, b) => a + b, 0) / valid_cpm.length) : null,
    date_range_start: fills[0]?.date || null,
    date_range_end: fills[fills.length - 1]?.date || null,
  };

  const services = serviceRows.map(s => ({ ...s, total_cost: round2(Number(s.cost) || 0) }));
  const expenses = expenseRows.map(e => ({ ...e, total_cost: round2(Number(e.cost) || 0) }));

  return {
    summary,
    fills,
    monthly,
    yearly,
    fuel_split,
    services,
    expenses,
  };
}
