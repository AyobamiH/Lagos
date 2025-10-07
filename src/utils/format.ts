// Currency & number formatting utilities
const ngnFormatter = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', currencyDisplay: 'symbol', maximumFractionDigits: 2 });

export function formatCurrencyNGN(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '';
  const num = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(num)) return '';
  return ngnFormatter.format(num);
}
