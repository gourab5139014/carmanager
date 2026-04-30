import { renderVehicleManager } from './VehicleManager';
import { api } from '../api';
import { computeMetrics } from '../metrics';
import { logout } from '../auth';
import { renderLogFill } from './log-fill';

export async function renderDashboard(app: HTMLElement) {
  app.innerHTML = `
    <header style="padding: 16px 20px; border-bottom: 1px solid #2a2a2a; display: flex; justify-content: space-between; align-items: center;">
      <h1 style="font-size: 1.1rem; margin: 0;">Dashboard</h1>
      <div style="display: flex; gap: 12px; align-items: center;">
        <select id="vehicle-select" style="background: #1a1a1a; color: #fff; border: 1px solid #333; padding: 4px 8px; border-radius: 4px;"></select>
        <button id="manage-vehicles-btn" style="background: none; border: 1px solid #333; color: #888; padding: 4px 12px; border-radius: 4px; font-size: 0.8rem; cursor: pointer;">Manage Vehicles</button>
        <button id="logout-btn" style="background: none; border: 1px solid #333; color: #888; padding: 4px 12px; border-radius: 4px; font-size: 0.8rem; cursor: pointer;">Logout</button>
      </div>
    </header>
    <div style="padding: 20px;">
      <div style="display: flex; gap: 10px; margin-bottom: 20px;">
        <button id="nav-log" style="flex: 1; padding: 16px; border-radius: 12px; border: none; background: #4da6ff; color: #000; font-weight: 700; cursor: pointer;">+ Log Fill</button>
      </div>
      <div id="dashboard-content">Loading...</div>
    </div>
  `;

  document.querySelector('#logout-btn')?.addEventListener('click', logout);
  document.querySelector('#manage-vehicles-btn')?.addEventListener('click', () => renderVehicleManager(app, () => renderDashboard(app)));
  document.querySelector('#nav-log')?.addEventListener('click', () => renderLogFill(app, () => renderDashboard(app)));

  try {
    const vehicles = await api.getVehicles();
    const select = document.querySelector('#vehicle-select') as HTMLSelectElement;
    vehicles.forEach((v: any) => {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = `${v.name} (${v.make} ${v.model})`;
      select.appendChild(opt);
    });

    if (!vehicles.length) {
      document.querySelector('#dashboard-content')!.textContent = 'No vehicles found. Add a vehicle to get started.';
      return;
    }

    const activeVehicleId = localStorage.getItem('active_vehicle_id') || vehicles[0]?.id;
    if (activeVehicleId) select.value = activeVehicleId;

    select.addEventListener('change', () => {
      localStorage.setItem('active_vehicle_id', select.value);
      loadFills(select.value);
    });

    if (activeVehicleId) loadFills(activeVehicleId);
  } catch (err: any) {
    document.querySelector('#dashboard-content')!.textContent = 'Error: ' + err.message;
  }
}

async function loadFills(vehicleId: string) {
  const content = document.querySelector('#dashboard-content')!;
  content.innerHTML = 'Loading data...';
  try {
    const [fillRows, serviceRows, expenseRows] = await Promise.all([
      api.getRefuelings(vehicleId),
      api.getServices(vehicleId),
      api.getExpenses(vehicleId)
    ]);
    const data = computeMetrics(fillRows, serviceRows, expenseRows);
    const s = data.summary;

    content.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-bottom: 20px;">
        <div style="background: #1a1a1a; padding: 12px; border-radius: 8px; border: 1px solid #2a2a2a;">
          <div style="font-size: 0.7rem; color: #888; text-transform: uppercase;">Total Miles</div>
          <div id="stat-miles" style="font-size: 1.4rem; font-weight: 700; margin-top: 4px;"></div>
        </div>
        <div style="background: #1a1a1a; padding: 12px; border-radius: 8px; border: 1px solid #2a2a2a;">
          <div style="font-size: 0.7rem; color: #888; text-transform: uppercase;">Avg MPG</div>
          <div id="stat-mpg" style="font-size: 1.4rem; font-weight: 700; margin-top: 4px;"></div>
        </div>
        <div style="background: #1a1a1a; padding: 12px; border-radius: 8px; border: 1px solid #2a2a2a;">
          <div style="font-size: 0.7rem; color: #888; text-transform: uppercase;">Total Cost</div>
          <div id="stat-cost" style="font-size: 1.4rem; font-weight: 700; margin-top: 4px;"></div>
        </div>
        <div style="background: #1a1a1a; padding: 12px; border-radius: 8px; border: 1px solid #2a2a2a;">
          <div style="font-size: 0.7rem; color: #888; text-transform: uppercase;">Fills</div>
          <div id="stat-fills" style="font-size: 1.4rem; font-weight: 700; margin-top: 4px;"></div>
        </div>
      </div>

      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 0.9rem; color: #888; margin-bottom: 12px;">Refueling History</h2>
        <div style="background: #1a1a1a; border-radius: 8px; border: 1px solid #2a2a2a; overflow: hidden;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
            <thead style="background: #222; color: #888; text-transform: uppercase; font-size: 0.7rem;">
              <tr><th style="padding: 10px; text-align: left;">Date</th><th style="padding: 10px; text-align: left;">Odo</th><th style="padding: 10px; text-align: left;">Vol</th><th style="padding: 10px; text-align: left;">MPG</th><th style="padding: 10px; text-align: left;">Cost</th></tr>
            </thead>
            <tbody id="fills-tbody"></tbody>
          </table>
        </div>
      </div>

      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 0.9rem; color: #888; margin-bottom: 12px;">Service History</h2>
        <div style="background: #1a1a1a; border-radius: 8px; border: 1px solid #2a2a2a; overflow: hidden;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
            <thead style="background: #222; color: #888; text-transform: uppercase; font-size: 0.7rem;">
              <tr><th style="padding: 10px; text-align: left;">Date</th><th style="padding: 10px; text-align: left;">Description</th><th style="padding: 10px; text-align: left;">Cost</th><th style="padding: 10px; text-align: left;">Location</th></tr>
            </thead>
            <tbody id="services-tbody"></tbody>
          </table>
        </div>
      </div>

      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 0.9rem; color: #888; margin-bottom: 12px;">Expense History</h2>
        <div style="background: #1a1a1a; border-radius: 8px; border: 1px solid #2a2a2a; overflow: hidden;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
            <thead style="background: #222; color: #888; text-transform: uppercase; font-size: 0.7rem;">
              <tr><th style="padding: 10px; text-align: left;">Date</th><th style="padding: 10px; text-align: left;">Description</th><th style="padding: 10px; text-align: left;">Cost</th></tr>
            </thead>
            <tbody id="expenses-tbody"></tbody>
          </table>
        </div>
      </div>
    `;

    document.querySelector('#stat-miles')!.textContent = `${s.total_miles_driven.toLocaleString()} mi`;
    document.querySelector('#stat-mpg')!.textContent = s.avg_mpg ? String(s.avg_mpg) : '—';
    document.querySelector('#stat-cost')!.textContent = `$${s.total_cost_usd.toLocaleString()}`;
    document.querySelector('#stat-fills')!.textContent = String(s.total_fills);

    const tbodyFills = document.querySelector('#fills-tbody')!;
    data.fills.forEach((f: any) => {
      const tr = document.createElement('tr');
      tr.style.borderTop = '1px solid #222';
      [
        f.date,
        f.odometer != null ? f.odometer.toLocaleString() : '—',
        f.volume_gal ?? '—',
        f.mpg ?? '—',
        f.total_cost != null ? `$${f.total_cost}` : '—',
      ].forEach(val => {
        const td = document.createElement('td');
        td.style.padding = '10px';
        td.textContent = String(val);
        tr.appendChild(td);
      });
      tbodyFills.appendChild(tr);
    });

    const tbodyServices = document.querySelector('#services-tbody')!;
    data.services.forEach((s: any) => {
      const tr = document.createElement('tr');
      tr.style.borderTop = '1px solid #222';
      [
        s.date,
        s.description || '—',
        s.cost != null ? `$${s.cost}` : '—',
        s.location || '—',
      ].forEach(val => {
        const td = document.createElement('td');
        td.style.padding = '10px';
        td.textContent = String(val);
        tr.appendChild(td);
      });
      tbodyServices.appendChild(tr);
    });

    const tbodyExpenses = document.querySelector('#expenses-tbody')!;
    data.expenses.forEach((e: any) => {
      const tr = document.createElement('tr');
      tr.style.borderTop = '1px solid #222';
      [
        e.date,
        e.description || '—',
        e.cost != null ? `$${e.cost}` : '—',
      ].forEach(val => {
        const td = document.createElement('td');
        td.style.padding = '10px';
        td.textContent = String(val);
        tr.appendChild(td);
      });
      tbodyExpenses.appendChild(tr);
    });

  } catch (err: any) {
    content.textContent = 'Error: ' + err.message;
  }
}
