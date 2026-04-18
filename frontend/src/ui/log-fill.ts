import { api } from '../api';

export async function renderLogFill(app: HTMLElement, onBack: () => void) {
  const activeVehicleId = localStorage.getItem('active_vehicle_id');
  
  app.innerHTML = `
    <header style="padding: 16px 20px; border-bottom: 1px solid #2a2a2a; display: flex; align-items: center; gap: 12px;">
      <button id="back-btn" style="background: none; border: none; color: #4da6ff; font-size: 0.9rem; cursor: pointer;">← Back</button>
      <h1 style="font-size: 1.1rem; margin: 0;">Log Fill</h1>
    </header>
    
    <div id="log-form-container" style="padding: 20px; display: flex; flex-direction: column; gap: 20px;">
      <div id="step-1">
        <p style="margin: 0 0 10px; color: #888; font-size: 0.85rem; text-transform: uppercase;">Step 1: Capture Photos</p>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div id="capture-odo" style="aspect-ratio: 1; background: #1a1a1a; border: 2px dashed #333; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; text-align: center; padding: 10px;">
            <span style="font-size: 1.5rem; margin-bottom: 4px;">📸</span>
            <span style="font-size: 0.75rem; font-weight: 600;">Odometer</span>
          </div>
          <div id="capture-pump" style="aspect-ratio: 1; background: #1a1a1a; border: 2px dashed #333; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; text-align: center; padding: 10px;">
            <span style="font-size: 1.5rem; margin-bottom: 4px;">⛽️</span>
            <span style="font-size: 0.75rem; font-weight: 600;">Pump Display</span>
          </div>
        </div>
        <input type="file" id="file-input" accept="image/*" capture="environment" style="display: none;">
      </div>

      <div id="processing-status" style="display: none; padding: 16px; background: #1a1a1a; border-radius: 8px; border: 1px solid #333; text-align: center;">
        <div class="spinner" style="margin-bottom: 8px;">🔄</div>
        <div id="status-text" style="font-size: 0.9rem;">Processing images...</div>
      </div>

      <div id="confirm-data" style="display: none;">
        <p style="margin: 0 0 10px; color: #888; font-size: 0.85rem; text-transform: uppercase;">Step 2: Confirm & Save</p>
        <form id="fill-form" style="display: flex; flex-direction: column; gap: 12px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <label style="display: flex; flex-direction: column; gap: 4px; font-size: 0.8rem; color: #888;">
              Date
              <input type="date" id="f-date" required style="padding: 10px; background: #1a1a1a; border: 1px solid #333; color: #fff; border-radius: 6px;">
            </label>
            <label style="display: flex; flex-direction: column; gap: 4px; font-size: 0.8rem; color: #888;">
              Odometer
              <input type="number" id="f-odo" required style="padding: 10px; background: #1a1a1a; border: 1px solid #333; color: #fff; border-radius: 6px;">
            </label>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <label style="display: flex; flex-direction: column; gap: 4px; font-size: 0.8rem; color: #888;">
              Gallons
              <input type="number" step="0.001" id="f-vol" required style="padding: 10px; background: #1a1a1a; border: 1px solid #333; color: #fff; border-radius: 6px;">
            </label>
            <label style="display: flex; flex-direction: column; gap: 4px; font-size: 0.8rem; color: #888;">
              Total Cost ($)
              <input type="number" step="0.01" id="f-total" required style="padding: 10px; background: #1a1a1a; border: 1px solid #333; color: #fff; border-radius: 6px;">
            </label>
          </div>
          <button type="submit" style="margin-top: 10px; padding: 16px; border-radius: 12px; border: none; background: #4da6ff; color: #000; font-weight: 700; cursor: pointer;">Save Refueling</button>
        </form>
      </div>
    </div>
  `;

  const backBtn = document.querySelector('#back-btn')!;
  const captureOdo = document.querySelector('#capture-odo') as HTMLElement;
  const capturePump = document.querySelector('#capture-pump') as HTMLElement;
  const fileInput = document.querySelector('#file-input') as HTMLInputElement;
  const statusDiv = document.querySelector('#processing-status') as HTMLDivElement;
  const statusText = document.querySelector('#status-text')!;
  const confirmDiv = document.querySelector('#confirm-data') as HTMLDivElement;
  const form = document.querySelector('#fill-form') as HTMLFormElement;

  backBtn.addEventListener('click', onBack);

  let currentType: 'odometer' | 'pump' | null = null;
  const extractedData: any = {
    date: new Date().toISOString().split('T')[0],
    vehicle_id: activeVehicleId,
    full_tank: true,
    fuel_type: 'Gasoline'
  };

  const showStatus = (msg: string) => {
    statusDiv.style.display = 'block';
    statusText.textContent = msg;
  };

  captureOdo.addEventListener('click', () => { currentType = 'odometer'; fileInput.click(); });
  capturePump.addEventListener('click', () => { currentType = 'pump'; fileInput.click(); });

  fileInput.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file || !currentType) return;

    showStatus(`Reading ${currentType} image...`);
    
    try {
      const base64 = await toBase64(file);
      const result = await api.runOcr({
        image: base64.split(',')[1],
        mediaType: file.type,
        type: currentType
      });

      if (result.error) throw new Error(result.error);

      Object.assign(extractedData, result);
      
      // Update form fields
      (document.querySelector('#f-date') as HTMLInputElement).value = extractedData.date;
      if (extractedData.odometer) (document.querySelector('#f-odo') as HTMLInputElement).value = extractedData.odometer;
      if (extractedData.volume_gal) (document.querySelector('#f-vol') as HTMLInputElement).value = extractedData.volume_gal;
      if (extractedData.total_cost) (document.querySelector('#f-total') as HTMLInputElement).value = extractedData.total_cost;

      confirmDiv.style.display = 'block';
      statusDiv.style.display = 'none';
      
      // Visual feedback on the capture boxes
      const box = currentType === 'odometer' ? captureOdo : capturePump;
      box.style.borderColor = '#4da6ff';
      box.querySelector('span:first-child')!.textContent = '✅';

    } catch (err: any) {
      alert('OCR Failed: ' + err.message);
      statusDiv.style.display = 'none';
      confirmDiv.style.display = 'block'; // Let user enter manually
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button')!;
    btn.disabled = true;
    btn.textContent = 'Saving...';

    const data = {
      ...extractedData,
      date: (document.querySelector('#f-date') as HTMLInputElement).value,
      odometer: parseInt((document.querySelector('#f-odo') as HTMLInputElement).value),
      volume_gal: parseFloat((document.querySelector('#f-vol') as HTMLInputElement).value),
      total_cost: parseFloat((document.querySelector('#f-total') as HTMLInputElement).value),
      price_per_gal: extractedData.price_per_gal || 
        parseFloat(((document.querySelector('#f-total') as HTMLInputElement).valueAsNumber / 
                    (document.querySelector('#f-vol') as HTMLInputElement).valueAsNumber).toFixed(3))
    };

    try {
      await api.logRefueling(data);
      onBack(); // Return to dashboard
    } catch (err: any) {
      alert('Save Failed: ' + err.message);
      btn.disabled = false;
      btn.textContent = 'Save Refueling';
    }
  });
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}
