// Dedicated ride service abstraction
import { api } from '../api/client';
import { parseLat, parseLng } from '../utils/validation';

export async function createRide(token: string, pickup:{lat:string,lng:string}, dropoff:{lat:string,lng:string}, productType: string) {
  const pLat = parseLat(pickup.lat); const pLng = parseLng(pickup.lng); const dLat = parseLat(dropoff.lat); const dLng = parseLng(dropoff.lng);
  if ([pLat,pLng,dLat,dLng].some(v=>v===null)) throw { error:'invalid_coordinates' };
  return api.rideRequest(token, { pickup:{lat:pLat!,lng:pLng!}, dropoff:{lat:dLat!,lng:dLng!}, productType });
}

export async function getReceipt(token: string, rideId: string) {
  return api.receipt(token, rideId);
}
