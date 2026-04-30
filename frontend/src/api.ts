/**
 * Unified API Client for Car Manager v2.0
 */
import { supabase } from './auth';

const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL && !import.meta.env.DEV) {
  console.warn('VITE_API_URL is missing. API calls will likely fail.');
}

// In development mode, default to the local Supabase edge function proxy if no URL is provided
const BASE_URL = API_URL || 'http://localhost:54321/functions/v1/ocr-image';


export async function request(path: string, options: RequestInit = {}) {

  // Always read the live session token — avoids stale JWT after Supabase background refresh
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(options.headers || {});
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
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
  getRefuelings: (vehicleId?: string) => request(`/v1/refuelings${vehicleId ? `?${new URLSearchParams({ vehicle_id: vehicleId })}` : ''}`),
  getServices: (vehicleId?: string) => request(`/v1/services${vehicleId ? `?${new URLSearchParams({ vehicle_id: vehicleId })}` : ''}`),
  getExpenses: (vehicleId?: string) => request(`/v1/expenses${vehicleId ? `?${new URLSearchParams({ vehicle_id: vehicleId })}` : ''}`),
  logRefueling: (data: any) => request('/v1/refuelings', { method: 'POST', body: JSON.stringify(data) }),
  runOcr: (data: any) => request('/v1/ocr', { method: 'POST', body: JSON.stringify(data) }),
};
