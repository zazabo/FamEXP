import type { ISODate, YearMonth } from '../types';

export const toYearMonth = (y: number, monthIndex0: number): YearMonth =>
  `${y}-${String(monthIndex0 + 1).padStart(2, '0')}`;

export const currentYearMonth = (d: Date = new Date()): YearMonth => toYearMonth(d.getFullYear(), d.getMonth());

export function parseYearMonth(ym: string | null | undefined): { y: number; m: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(ym ?? '');
  if (!match) return null;
  const m = Number(match[2]) - 1;
  return m >= 0 && m <= 11 ? { y: Number(match[1]), m } : null;
}

export function shiftYearMonth(ym: YearMonth, delta: number): YearMonth {
  const p = parseYearMonth(ym) ?? parseYearMonth(currentYearMonth())!;
  const d = new Date(p.y, p.m + delta, 1);
  return toYearMonth(d.getFullYear(), d.getMonth());
}

/** First and last calendar date of a month, inclusive. */
export function monthRange(ym: YearMonth): { start: ISODate; end: ISODate } {
  const p = parseYearMonth(ym)!;
  const last = new Date(p.y, p.m + 1, 0).getDate();
  return { start: `${ym}-01`, end: `${ym}-${String(last).padStart(2, '0')}` };
}

export const yearMonthOf = (date: ISODate): YearMonth => date.slice(0, 7);
