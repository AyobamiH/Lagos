// Central validation & parsing helpers
export function validatePhone(phone: string): { ok: boolean; reason?: string } {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return { ok: false, reason: 'too_short' };
  if (digits.length > 15) return { ok: false, reason: 'too_long' };
  if (!/^[0-9]+$/.test(digits)) return { ok: false, reason: 'invalid_chars' };
  return { ok: true };
}

export function validatePassword(pw: string): { ok: boolean; reason?: string } {
  if (pw.length < 8) return { ok: false, reason: 'too_short' };
  // At least one letter & one number for minimal strength.
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return { ok: false, reason: 'weak' };
  return { ok: true };
}

export function isValidLat(lat: number): boolean { return Number.isFinite(lat) && lat >= -90 && lat <= 90; }
export function isValidLng(lng: number): boolean { return Number.isFinite(lng) && lng >= -180 && lng <= 180; }

export function parseCoordinate(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function parseLat(value: string): number | null {
  const n = parseCoordinate(value);
  if (n === null) return null;
  return isValidLat(n) ? n : null;
}

export function parseLng(value: string): number | null {
  const n = parseCoordinate(value);
  if (n === null) return null;
  return isValidLng(n) ? n : null;
}
