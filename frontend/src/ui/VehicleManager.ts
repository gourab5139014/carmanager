import { api } from '../api';

export async function renderVehicleManager(app: HTMLElement, onBack: () => void) {
  app.innerHTML = `
    <header style="padding: 16px 20px; border-bottom: 1px solid #2a2a2a; display: flex; align-items: center; gap: 12px;">
      <button id="back-btn" style="background: none; border: none; color: #4da6ff; font-size: 1rem; cursor: pointer; padding: 0;">← Back</button>
      <h1 style="font-size: 1.1rem; margin: 0;">Manage Vehicles</h1>
    </header>
    <div style="padding: 20px;">
      <div style="margin-bottom: 30px;">
        <h2 style="font-size: 1rem; margin-bottom: 16px;">Add New Vehicle</h2>
        <form id="add-vehicle-form" style="display: flex; flex-direction: column; gap: 12px; background: #1a1a1a; padding: 16px; border-radius: 8px; border: 1px solid #2a2a2a;">
          <input type="text" id="v-name" placeholder="Vehicle Name (e.g. Daily Driver)" required style="padding: 10px; background: #0f0f0f; border: 1px solid #333; color: #fff; border-radius: 6px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <input type="text" id="v-make" placeholder="Make (e.g. Honda)" style="padding: 10px; background: #0f0f0f; border: 1px solid #333; color: #fff; border-radius: 6px;">
            <input type="text" id="v-model" placeholder="Model (e.g. Civic)" style="padding: 10px; background: #0f0f0f; border: 1px solid #333; color: #fff; border-radius: 6px;">
          </div>
          <input type="number" id="v-year" placeholder="Year (e.g. 2020)" style="padding: 10px; background: #0f0f0f; border: 1px solid #333; color: #fff; border-radius: 6px;">
          <button type="submit" style="margin-top: 8px; padding: 12px; border-radius: 8px; border: none; background: #4da6ff; color: #000; font-weight: 700; cursor: pointer;">Add Vehicle</button>
        </form>
      </div>

      <div>
        <h2 style="font-size: 1rem; margin-bottom: 16px;">Your Vehicles</h2>
        <div id="vehicle-list" style="display: flex; flex-direction: column; gap: 12px;">
          Loading vehicles...
        </div>
      </div>
    </div>
  `;

  document.querySelector('#back-btn')?.addEventListener('click', onBack);

  const loadVehicles = async () => {
    const listEl = document.querySelector('#vehicle-list')!;
    try {
      const vehicles = await api.getVehicles();
      if (!vehicles.length) {
        listEl.innerHTML = '<p style="color: #888; font-size: 0.9rem;">No vehicles found.</p>';
        return;
      }

      listEl.innerHTML = '';
      vehicles.forEach((v: any) => {
        const container = document.createElement('div');
        container.style.background = '#1a1a1a';
        container.style.padding = '16px';
        container.style.borderRadius = '8px';
        container.style.border = '1px solid #2a2a2a';
        container.style.display = 'flex';
        container.style.justifyContent = 'space-between';
        container.style.alignItems = 'center';

        const infoDiv = document.createElement('div');

        const nameDiv = document.createElement('div');
        nameDiv.style.fontWeight = '600';
        nameDiv.style.marginBottom = '4px';
        nameDiv.textContent = v.name;

        const detailsDiv = document.createElement('div');
        detailsDiv.style.fontSize = '0.8rem';
        detailsDiv.style.color = '#888';
        detailsDiv.textContent = `${v.year || ''} ${v.make || ''} ${v.model || ''}`;

        infoDiv.appendChild(nameDiv);
        infoDiv.appendChild(detailsDiv);

        const statusDiv = document.createElement('div');
        statusDiv.style.fontSize = '0.8rem';
        statusDiv.style.color = v.active ? '#4caf50' : '#888';
        statusDiv.textContent = v.active ? 'Active' : 'Inactive';

        container.appendChild(infoDiv);
        container.appendChild(statusDiv);

        listEl.appendChild(container);
      });
    } catch (err: any) {
      listEl.innerHTML = `<p style="color: #cf6679;">Error loading vehicles: ${err.message}</p>`;
    }
  };

  await loadVehicles();

  const form = document.querySelector('#add-vehicle-form') as HTMLFormElement;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button')!;
    btn.disabled = true;
    btn.textContent = 'Adding...';

    const data = {
      name: (document.querySelector('#v-name') as HTMLInputElement).value,
      make: (document.querySelector('#v-make') as HTMLInputElement).value || null,
      model: (document.querySelector('#v-model') as HTMLInputElement).value || null,
      year: parseInt((document.querySelector('#v-year') as HTMLInputElement).value) || null,
    };

    try {
      await api.createVehicle(data);
      form.reset();
      await loadVehicles();
    } catch (err: any) {
      alert('Failed to add vehicle: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Add Vehicle';
    }
  });
}
