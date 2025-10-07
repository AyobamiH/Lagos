// Minimal t() shim for string externalization
// Future: plug in real i18n library; currently just returns key or interpolation.

interface Dict { [k: string]: string | ((vars: Record<string, any>) => string); }
const dict: Dict = {};

export function registerStrings(entries: Record<string,string>) {
  Object.assign(dict, entries);
}

export function t(key: string, vars?: Record<string, any>) {
  const entry = dict[key];
  if (!entry) return key;
  if (typeof entry === 'function') return entry(vars||{});
  if (!vars) return entry;
  return entry.replace(/\{(\w+)\}/g, (_,k) => vars[k] ?? '');
}
