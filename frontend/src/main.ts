import { initAuth, logout, supabase } from './auth';
import { api } from './api';
import { computeMetrics } from './metrics';

const app = document.querySelector('#app')!;

async function renderLogin() {
  app.innerHTML = `
    <div style="padding: 40px 20px; text-align: center;">
      <h1>Car Manager v2</h1>
      <p style="color: #666;">Sign in to continue</p>
      <form id="login-form" style="display: flex; flex-direction: column; gap: 12px; max-width: 320px; margin: 40px auto 0;">
        <input type="email" id="email" placeholder="Email" required style="padding: 12px; border-radius: 8px; border: 1px solid #333; background: #1a1a1a; color: #fff;">
        <input type="password" id="password" placeholder="Password" required style="padding: 12px; border-radius: 8px; border: 1px solid #333; background: #1a1a1a; color: #fff;">
        <button type="submit" style="padding: 14px; border-radius: 8px; border: none; background: #4da6ff; color: #000; font-weight: 700; cursor: pointer;">Sign In</button>
      </form>
      <div id="login-error" style="color: #cf6679; margin-top: 16px; font-size: 0.85rem; display: none;"></div>
    </div>
  `;

  const form = document.querySelector('#login-form') as HTMLFormElement;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (document.querySelector('#email') as HTMLInputElement).value;
    const password = (document.querySelector('#password') as HTMLInputElement).value;
    const errorEl = document.querySelector('#login-error') as HTMLDivElement;
    
    const btn = form.querySelector('button')!;
    btn.disabled = true;
    btn.textContent = 'Signing in...';
    errorEl.style.display = 'none';

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      errorEl.textContent = error.message;
      errorEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });
}

async function renderDashboard() {
  app.innerHTML = `
    <header style="padding: 16px 20px; border-bottom: 1px solid #2a2a2a; display: flex; justify-content: space-between; align-items: center;">
      <h1 style="font-size: 1.1rem; margin: 0;">Dashboard</h1>
      <div style="display: flex; gap: 12px; align-items: center;">
        <select id="vehicle-select" style="background: #1a1a1a; color: #fff; border: 1px solid #333; padding: 4px 8px; border-radius: 4px;"></select>
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
  document.querySelector('#nav-log')?.addEventListener('click', () => renderLogFill());

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
    const fillRows = await api.getRefuelings(vehicleId);
    const data = computeMetrics(fillRows);
    const s = data.summary;

    // Build summary cards — static text only, safe for innerHTML
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
          <div style="font-size: 0.7rem; color: #888; text-transform: uppercase;">Total Fuel Cost</div>
          <div id="stat-cost" style="font-size: 1.4rem; font-weight: 700; margin-top: 4px;"></div>
        </div>
        <div style="background: #1a1a1a; padding: 12px; border-radius: 8px; border: 1px solid #2a2a2a;">
          <div style="font-size: 0.7rem; color: #888; text-transform: uppercase;">Fills</div>
          <div id="stat-fills" style="font-size: 1.4rem; font-weight: 700; margin-top: 4px;"></div>
        </div>
      </div>
      <div style="background: #1a1a1a; border-radius: 8px; border: 1px solid #2a2a2a; overflow: hidden;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
          <thead style="background: #222; color: #888; text-transform: uppercase; font-size: 0.7rem;">
            <tr><th style="padding: 10px; text-align: left;">Date</th><th style="padding: 10px; text-align: left;">Odo</th><th style="padding: 10px; text-align: left;">Vol</th><th style="padding: 10px; text-align: left;">MPG</th><th style="padding: 10px; text-align: left;">Cost</th></tr>
          </thead>
          <tbody id="fills-tbody"></tbody>
        </table>
      </div>
    `;

    // Populate stats via textContent (safe)
    document.querySelector('#stat-miles')!.textContent = `${s.total_miles_driven.toLocaleString()} mi`;
    document.querySelector('#stat-mpg')!.textContent = s.avg_mpg ? String(s.avg_mpg) : '—';
    document.querySelector('#stat-cost')!.textContent = `$${s.total_fuel_cost_usd.toLocaleString()}`;
    document.querySelector('#stat-fills')!.textContent = String(s.total_fills);

    // Build table rows via DOM API — no innerHTML with user data
    const tbody = document.querySelector('#fills-tbody')!;
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
      tbody.appendChild(tr);
    });
  } catch (err: any) {
    content.textContent = 'Error: ' + err.message;
  }
}

async function renderLogFill() {
  app.innerHTML = `
    <header style="padding: 16px 20px; border-bottom: 1px solid #2a2a2a; display: flex; align-items: center; gap: 12px;">
      <button id="back-btn" style="background: none; border: none; color: #4da6ff; font-size: 0.9rem; cursor: pointer;">← Back</button>
      <h1 style="font-size: 1.1rem; margin: 0;">Log Fill</h1>
    </header>
    <div style="padding: 20px;">
      <p style="color: #888; font-size: 0.9rem;">The v2 unified form is coming soon. Using v1 for now.</p>
      <button id="done-btn" style="width: 100%; padding: 16px; border-radius: 12px; border: none; background: #4da6ff; color: #000; font-weight: 700; cursor: pointer;">I'm Finished</button>
    </div>
  `;
  document.querySelector('#back-btn')?.addEventListener('click', renderDashboard);
  document.querySelector('#done-btn')?.addEventListener('click', renderDashboard);
}

// Initial Auth check
initAuth((session) => {
  if (session) {
    renderDashboard();
  } else {
    renderLogin();
  }
});
