import type { ISODate, Locale } from '../types';

/**
 * Money is always shown Greek-style in both languages, as requested: `1.250,50 €`.
 * A non-breaking space keeps the € on the same line as the number.
 */
const moneyFmt = new Intl.NumberFormat('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatMoney(cents: number): string {
  return `${moneyFmt.format(cents / 100)} €`;
}

/**
 * Parse what a parent types into the amount field ("12", "12,5", "12.50", "1.250,50")
 * into integer cents. Returns null for empty/invalid input.
 */
export function parseMoney(input: string): number | null {
  const s = input.trim().replace(/\s|€/g, '');
  if (!s) return null;
  let normalized: string;
  if (s.includes(',')) {
    // Greek style: dots are thousands separators, comma is decimal.
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else {
    const parts = s.split('.');
    // "1.250" (3 digits after a single dot) is ambiguous; treat a dot followed by exactly 3 digits as thousands.
    normalized = parts.length === 2 && parts[1]!.length === 3 ? parts.join('') : s;
    if (parts.length > 2) normalized = parts.join('');
  }
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return null;
  return Math.round(parseFloat(normalized) * 100);
}

const intlLocale = (locale: Locale): string => (locale === 'en' ? 'en-GB' : 'el-GR');

/** `Νοέμβριος 2026` / `November 2026` */
export function formatMonthYear(year: number, monthIndex0: number, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { month: 'long', year: 'numeric' }).format(
    new Date(year, monthIndex0, 1),
  );
}

/** Short date for lists, e.g. `24 Νοε` / `24 Nov`. */
export function formatShortDate(date: ISODate, locale: Locale): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Intl.DateTimeFormat(intlLocale(locale), { day: 'numeric', month: 'short' }).format(
    new Date(y!, (m ?? 1) - 1, d ?? 1),
  );
}

export function formatDateTime(epochMs: number, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(epochMs));
}

/** Local calendar date as `YYYY-MM-DD`. */
export function toISODate(d: Date = new Date()): ISODate {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Amount for an editable input: plain digits with a decimal comma, no thousands separators (e.g. `1500` or `12,50`). */
export function formatAmountInput(cents: number | null): string {
  if (cents === null) return '';
  const euros = Math.floor(cents / 100);
  const rest = cents % 100;
  return rest === 0 ? String(euros) : `${euros},${String(rest).padStart(2, '0')}`;
}
