/**
 * Unified API Client for Car Manager v2.0
 */
const BASE_URL = \`\${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-image\`;

export async function request(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('cm_jwt');
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  headers.set('Content-Type', 'application/json');

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown API error' }));
    throw new Error(err.error || `API error ${res.status}`);
  }

  return res.json();
}

export const api = {
  getVehicles: () => request('/v1/vehicles'),
  getRefuelings: (vehicleId?: string) => request(`/v1/refuelings${vehicleId ? `?vehicle_id=${vehicleId}` : ''}`),
  logRefueling: (data: any) => request('/v1/refuelings', { method: 'POST', body: JSON.stringify(data) }),
  runOcr: (data: any) => request('/v1/ocr', { method: 'POST', body: JSON.stringify(data) }),
};
