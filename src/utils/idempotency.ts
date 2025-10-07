// Simple idempotency key helper stored in sessionStorage per intent
const KEY_PREFIX = 'idemp:';
export function getOrCreateIdempotencyKey(seed: string): string {
  const storageKey = KEY_PREFIX + seed;
  let existing = sessionStorage.getItem(storageKey);
  if (existing) return existing;
  existing = crypto.randomUUID();
  sessionStorage.setItem(storageKey, existing);
  return existing;
}
export function clearIdempotencyKey(seed: string) {
  sessionStorage.removeItem(KEY_PREFIX + seed);
}
