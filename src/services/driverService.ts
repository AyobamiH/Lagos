import { api, request } from '../api/client';

export async function getAvailability(token: string) { return api.availability(token); }
export async function setAvailability(token: string, available: boolean) {
  return request('/drivers/availability', { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body: JSON.stringify({ available }) });
}
