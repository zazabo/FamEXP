import { db } from './schema';
import { alive } from './repo';
import { getEffectiveBudget } from './budget';
import { toYearMonth } from './dates';
import { toISODate } from '../i18n/format';
import { HOUSEHOLD_ID, type Category, type Expense, type FamilyMember, type ISODate, type Locale } from '../types';

/**
 * Analytics for a week (Monday–Sunday, as usual in Greece), a month or a year:
 * a trend split into buckets, a breakdown by category (with subcategories) and by family
 * member, and the period's budget. Pure functions + one loader, shared by the screen and the PDF.
 */

export type Period = 'week' | 'month' | 'year';

export interface PeriodRange {
  period: Period;
  start: ISODate;
  end: ISODate;
}

export interface Bucket {
  key: string;
  /** Short axis label, e.g. `Δευ 23`, `2–8`, `Ιαν`. */
  label: string;
  /** Long label for tooltips, e.g. `Δευτέρα 23 Νοεμβρίου`. */
  fullLabel: string;
  cents: number;
  /** Year view only: that month's budget, if any. */
  budgetCents: number | null;
}

export interface Share {
  id: string;
  name: string;
  cents: number;
  /** 0..1 of the period total. */
  share: number;
}

export interface CategoryShare extends Share {
  icon: string;
  /** Fixed palette slot (follows the category, never its rank). */
  colorIndex: number;
  subs: (Share & { icon: string })[];
}

export interface MemberShare extends Share {
  colorIndex: number;
}

export interface PeriodSummary {
  range: PeriodRange;
  totalCents: number;
  count: number;
  /** Average per day over the days elapsed in the period (whole period if it is in the past). */
  dailyAvgCents: number;
  buckets: Bucket[];
  byCategory: CategoryShare[];
  byMember: MemberShare[];
  /** Month: that month's budget. Year: sum of the months that have one. Week: null. */
  budgetCents: number | null;
}

// ---------------------------------------------------------------- dates

const parse = (iso: ISODate): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
};
const addDays = (d: Date, n: number): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const intlLocale = (locale: Locale): string => (locale === 'en' ? 'en-GB' : 'el-GR');

export function periodRange(period: Period, anchor: ISODate | Date): PeriodRange {
  const d = typeof anchor === 'string' ? parse(anchor) : anchor;
  if (period === 'week') {
    const monday = addDays(d, -((d.getDay() + 6) % 7));
    return { period, start: toISODate(monday), end: toISODate(addDays(monday, 6)) };
  }
  if (period === 'month') {
    return { period, start: toISODate(new Date(d.getFullYear(), d.getMonth(), 1)), end: toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
  }
  return { period, start: `${d.getFullYear()}-01-01`, end: `${d.getFullYear()}-12-31` };
}

export function shiftRange(range: PeriodRange, delta: number): PeriodRange {
  const s = parse(range.start);
  if (range.period === 'week') return periodRange('week', addDays(s, 7 * delta));
  if (range.period === 'month') return periodRange('month', new Date(s.getFullYear(), s.getMonth() + delta, 1));
  return periodRange('year', new Date(s.getFullYear() + delta, 0, 1));
}

export const isCurrentRange = (range: PeriodRange, today: ISODate = toISODate()): boolean =>
  range.start <= today && today <= range.end;

/** `23–29 Νοε 2026`, `30 Νοε – 6 Δεκ 2026`, `Νοέμβριος 2026`, `2026`. */
export function rangeTitle(range: PeriodRange, locale: Locale): string {
  const loc = intlLocale(locale);
  const s = parse(range.start);
  const e = parse(range.end);
  if (range.period === 'year') return String(s.getFullYear());
  if (range.period === 'month') return new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' }).format(s);
  const dm = new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short' });
  if (s.getMonth() === e.getMonth()) return `${s.getDate()}–${dm.format(e)} ${e.getFullYear()}`;
  return `${dm.format(s)} – ${dm.format(e)} ${e.getFullYear()}`;
}

function emptyBuckets(range: PeriodRange, locale: Locale): Omit<Bucket, 'cents' | 'budgetCents'>[] {
  const loc = intlLocale(locale);
  const s = parse(range.start);
  const e = parse(range.end);
  if (range.period === 'week') {
    const wd = new Intl.DateTimeFormat(loc, { weekday: 'short' });
    const full = new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'long' });
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(s, i);
      return { key: toISODate(d), label: `${wd.format(d)} ${d.getDate()}`, fullLabel: full.format(d) };
    });
  }
  if (range.period === 'month') {
    // Calendar weeks inside the month: a new bucket starts on the 1st and on every Monday.
    const out: Omit<Bucket, 'cents' | 'budgetCents'>[] = [];
    const mon = new Intl.DateTimeFormat(loc, { month: 'short' }).format(s);
    let first = s;
    for (let d = s; d <= e; d = addDays(d, 1)) {
      const next = addDays(d, 1);
      if (next > e || next.getDay() === 1) {
        const a = first.getDate();
        const b = d.getDate();
        out.push({ key: toISODate(first), label: a === b ? `${a}` : `${a}–${b}`, fullLabel: a === b ? `${a} ${mon}` : `${a}–${b} ${mon}` });
        first = next;
      }
    }
    return out;
  }
  const short = new Intl.DateTimeFormat(loc, { month: 'short' });
  const long = new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' });
  return Array.from({ length: 12 }, (_, m) => {
    const d = new Date(s.getFullYear(), m, 1);
    return { key: toYearMonth(s.getFullYear(), m), label: short.format(d).replace('.', ''), fullLabel: long.format(d) };
  });
}

/** Index of the bucket an expense date falls into (keys are each bucket's first day / month). */
function bucketIndex(range: PeriodRange, keys: string[], date: ISODate): number {
  if (range.period === 'year') return keys.indexOf(date.slice(0, 7));
  let idx = -1;
  for (let i = 0; i < keys.length; i++) if (keys[i]! <= date) idx = i;
  return idx;
}

// ---------------------------------------------------------------- aggregation

export const CATEGORY_SLOTS = 8;
/** Member donut: household + parents + first children; the rest fold into "others". */
export const MEMBER_SLOTS = 7;
export const OTHERS_ID = '__others__';

interface Context {
  categories: Category[];
  members: FamilyMember[];
  locale: Locale;
  householdLabel: string;
  othersLabel: string;
  /** Effective budget per `YYYY-MM` for the months of the range. */
  monthBudgets: Map<string, number | null>;
  today?: ISODate;
}

export function summarize(range: PeriodRange, expenses: Expense[], ctx: Context): PeriodSummary {
  const rows = expenses.filter((e) => e.deletedAt === null && e.date >= range.start && e.date <= range.end);
  const totalCents = rows.reduce((s, e) => s + e.amountCents, 0);
  const share = (c: number) => (totalCents > 0 ? c / totalCents : 0);
  const name = (c: Category) => (ctx.locale === 'en' ? c.nameEn : c.nameEl);

  // Trend buckets
  const base = emptyBuckets(range, ctx.locale);
  const keys = base.map((b) => b.key);
  const sums = new Array<number>(base.length).fill(0);
  for (const e of rows) {
    const i = bucketIndex(range, keys, e.date);
    if (i >= 0) sums[i]! += e.amountCents;
  }
  const buckets: Bucket[] = base.map((b, i) => ({
    ...b, cents: sums[i]!, budgetCents: range.period === 'year' ? (ctx.monthBudgets.get(b.key) ?? null) : null,
  }));

  // Categories (top level, fixed colour slot by display order) with subcategories
  const byId = new Map(ctx.categories.map((c) => [c.id, c]));
  const tops = ctx.categories.filter((c) => c.parentId === null).sort((a, b) => a.sortOrder - b.sortOrder);
  const slot = new Map(tops.map((c, i) => [c.id, Math.min(i, CATEGORY_SLOTS - 1)]));
  const topSum = new Map<string, number>();
  const subSum = new Map<string, number>();
  for (const e of rows) {
    const sub = byId.get(e.categoryId);
    const topId = sub?.parentId ?? sub?.id ?? 'unknown';
    topSum.set(topId, (topSum.get(topId) ?? 0) + e.amountCents);
    subSum.set(e.categoryId, (subSum.get(e.categoryId) ?? 0) + e.amountCents);
  }
  const byCategory: CategoryShare[] = [...topSum.entries()]
    .map(([id, cents]) => {
      const top = byId.get(id);
      const subs = [...subSum.entries()]
        .filter(([sid]) => (byId.get(sid)?.parentId ?? sid) === id && sid !== id)
        .map(([sid, c]) => {
          const s = byId.get(sid);
          return { id: sid, name: s ? name(s) : '—', icon: s?.icon ?? '', cents: c, share: share(c) };
        })
        .sort((a, b) => b.cents - a.cents);
      return {
        id, name: top ? name(top) : '—', icon: top?.icon ?? '', colorIndex: slot.get(id) ?? CATEGORY_SLOTS - 1,
        cents, share: share(cents), subs,
      };
    })
    .sort((a, b) => b.cents - a.cents);

  // Members: household, parents, children in display order; colour slot follows the member
  const ordered = [
    { id: HOUSEHOLD_ID, name: ctx.householdLabel },
    ...ctx.members.filter((m) => m.role === 'parent').sort((a, b) => (a.parentSlot ?? 0) - (b.parentSlot ?? 0)),
    ...ctx.members.filter((m) => m.role === 'child').sort((a, b) => a.sortOrder - b.sortOrder),
  ];
  const memberSlot = new Map(ordered.map((m, i) => [m.id, i < MEMBER_SLOTS - 1 ? i : MEMBER_SLOTS - 1]));
  const memberSum = new Map<string, number>();
  for (const e of rows) {
    const known = memberSlot.has(e.forWhomId);
    const slotIdx = known ? memberSlot.get(e.forWhomId)! : MEMBER_SLOTS - 1;
    const key = slotIdx === MEMBER_SLOTS - 1 && (!known || ordered.length > MEMBER_SLOTS) ? OTHERS_ID : e.forWhomId;
    memberSum.set(key, (memberSum.get(key) ?? 0) + e.amountCents);
  }
  const byMember: MemberShare[] = [...memberSum.entries()]
    .map(([id, cents]) => ({
      id,
      name: id === OTHERS_ID ? ctx.othersLabel : (ordered.find((m) => m.id === id)?.name ?? '—'),
      cents, share: share(cents),
      colorIndex: id === OTHERS_ID ? MEMBER_SLOTS - 1 : (memberSlot.get(id) ?? MEMBER_SLOTS - 1),
    }))
    .sort((a, b) => b.cents - a.cents);

  // Daily average over the elapsed days
  const today = ctx.today ?? toISODate();
  const lastDay = today < range.start ? null : today > range.end ? range.end : today;
  const days = lastDay ? Math.round((parse(lastDay).getTime() - parse(range.start).getTime()) / 86_400_000) + 1 : 0;

  // Period budget
  let budgetCents: number | null = null;
  if (range.period === 'month') budgetCents = ctx.monthBudgets.get(range.start.slice(0, 7)) ?? null;
  if (range.period === 'year') {
    const vals = [...ctx.monthBudgets.values()].filter((v): v is number => v !== null && v > 0);
    budgetCents = vals.length ? vals.reduce((s, v) => s + v, 0) : null;
  }

  return {
    range, totalCents, count: rows.length, dailyAvgCents: days > 0 ? Math.round(totalCents / days) : 0,
    buckets, byCategory, byMember, budgetCents,
  };
}

/** Load everything a period needs from IndexedDB and summarise it. */
export async function loadSummary(range: PeriodRange, labels: { household: string; others: string }, locale: Locale): Promise<PeriodSummary> {
  const [expenses, categories, members] = await Promise.all([
    db.expenses.where('date').between(range.start, range.end, true, true).toArray(),
    db.categories.toArray(),
    db.familyMembers.toArray(),
  ]);
  const monthBudgets = new Map<string, number | null>();
  if (range.period !== 'week') {
    const s = parse(range.start);
    const months = range.period === 'month' ? [s.getMonth()] : Array.from({ length: 12 }, (_, i) => i);
    for (const m of months) {
      const ym = toYearMonth(s.getFullYear(), m);
      monthBudgets.set(ym, (await getEffectiveBudget(ym)).cents);
    }
  }
  return summarize(range, alive(expenses), {
    categories, members: members.filter((m) => m.deletedAt === null || expenses.some((e) => e.forWhomId === m.id)),
    locale, householdLabel: labels.household, othersLabel: labels.others, monthBudgets,
  });
}
