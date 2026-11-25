import writeXlsxFile, { type Row, type Sheet } from 'write-excel-file/browser';
import type { TFunction } from 'i18next';
import { db } from '../db/schema';
import { alive } from '../db/repo';
import { getEffectiveBudget } from '../db/budget';
import { parseYearMonth, toYearMonth } from '../db/dates';
import { HOUSEHOLD_ID, type Category, type Expense, type FamilyMember, type Locale } from '../types';

/**
 * Excel workbook (.xlsx) generated on the phone (loaded only when the parent taps Export):
 * a Summary sheet (per month: total, budget, difference, count, amount per category) plus
 * one sheet per month with the columns Date, Category, Subcategory, For Whom, Paid By,
 * Amount (€), Note. Dates and amounts are real dates / numbers, so Excel and Google Sheets
 * can sort, filter and calculate with them.
 */

export type ExportScope = number | 'all';

const DATE_FORMAT = 'dd/mm/yyyy';
const MONEY_FORMAT = '#,##0.00';
const HEADER = { fontWeight: 'bold' as const, backgroundColor: '#EEEEEA', bottomBorderStyle: 'thin' as const };

/** Years that have at least one expense, newest first. */
export async function exportYears(): Promise<number[]> {
  const years = new Set(alive(await db.expenses.toArray()).map((e) => Number(e.date.slice(0, 4))));
  return [...years].sort((a, b) => b - a);
}

/** Calendar date as a UTC midnight Date, so the cell shows the same day in every time zone. */
const excelDate = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
};

export async function buildWorkbook(scope: ExportScope, { t, locale }: { t: TFunction; locale: Locale }): Promise<Blob> {
  const [allExpenses, categories, members] = await Promise.all([
    db.expenses.toArray(), db.categories.toArray(), db.familyMembers.toArray(),
  ]);
  const expenses = alive(allExpenses)
    .filter((e) => scope === 'all' || e.date.startsWith(`${scope}-`))
    .sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1));

  const catById = new Map<string, Category>(categories.map((c) => [c.id, c]));
  const memberById = new Map<string, FamilyMember>(members.map((m) => [m.id, m]));
  const name = (c: Category | undefined) => (c ? (locale === 'en' ? c.nameEn : c.nameEl) : '—');
  const who = (id: string) => (id === HOUSEHOLD_ID ? t('members.household') : (memberById.get(id)?.name ?? '—'));
  const topOf = (e: Expense) => {
    const sub = catById.get(e.categoryId);
    return sub?.parentId ? catById.get(sub.parentId) : sub;
  };
  const tops = categories.filter((c) => c.parentId === null && c.deletedAt === null).sort((a, b) => a.sortOrder - b.sortOrder);
  const monthName = (ym: string) => {
    const p = parseYearMonth(ym)!;
    return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'el-GR', { month: 'long', year: 'numeric' }).format(new Date(p.y, p.m, 1));
  };

  // Months covered: a year → all 12; "all" → from the first to the last month with expenses.
  const months: string[] = [];
  if (scope !== 'all') {
    for (let m = 0; m < 12; m++) months.push(toYearMonth(scope, m));
  } else if (expenses.length) {
    const first = parseYearMonth(expenses[0]!.date.slice(0, 7))!;
    const last = parseYearMonth(expenses[expenses.length - 1]!.date.slice(0, 7))!;
    for (let y = first.y, m = first.m; y < last.y || (y === last.y && m <= last.m); m === 11 ? (y++, (m = 0)) : m++) {
      months.push(toYearMonth(y, m));
    }
  }
  const byMonth = new Map<string, Expense[]>();
  for (const e of expenses) {
    const ym = e.date.slice(0, 7);
    byMonth.set(ym, [...(byMonth.get(ym) ?? []), e]);
  }

  // ---- Summary sheet
  const header: Row = [
    t('excel.month'), t('excel.total'), t('excel.budget'), t('excel.difference'), t('excel.count'), ...tops.map((c) => name(c)),
  ].map((value) => ({ value, ...HEADER }));
  const summaryRows: Row[] = [header];
  const totals = { total: 0, budget: 0, count: 0, perTop: tops.map(() => 0) };
  for (const ym of months) {
    const rows = byMonth.get(ym) ?? [];
    const total = rows.reduce((s, e) => s + e.amountCents, 0) / 100;
    const budgetCents = (await getEffectiveBudget(ym)).cents;
    const budget = budgetCents !== null ? budgetCents / 100 : null;
    const perTop = tops.map((top) => rows.filter((e) => topOf(e)?.id === top.id).reduce((s, e) => s + e.amountCents, 0) / 100);
    totals.total += total;
    totals.budget += budget ?? 0;
    totals.count += rows.length;
    perTop.forEach((v, i) => (totals.perTop[i]! += v));
    summaryRows.push([
      { value: monthName(ym) },
      { value: total, type: Number, format: MONEY_FORMAT },
      budget !== null ? { value: budget, type: Number, format: MONEY_FORMAT } : null,
      budget !== null ? { value: Math.round((budget - total) * 100) / 100, type: Number, format: MONEY_FORMAT } : null,
      { value: rows.length, type: Number },
      ...perTop.map((v) => ({ value: v, type: Number, format: MONEY_FORMAT })),
    ]);
  }
  summaryRows.push([
    { value: t('excel.total'), fontWeight: 'bold', topBorderStyle: 'thin' },
    { value: Math.round(totals.total * 100) / 100, type: Number, format: MONEY_FORMAT, fontWeight: 'bold', topBorderStyle: 'thin' },
    { value: totals.budget, type: Number, format: MONEY_FORMAT, fontWeight: 'bold', topBorderStyle: 'thin' },
    { value: Math.round((totals.budget - totals.total) * 100) / 100, type: Number, format: MONEY_FORMAT, fontWeight: 'bold', topBorderStyle: 'thin' },
    { value: totals.count, type: Number, fontWeight: 'bold', topBorderStyle: 'thin' },
    ...totals.perTop.map((v) => ({ value: Math.round(v * 100) / 100, type: Number, format: MONEY_FORMAT, fontWeight: 'bold' as const, topBorderStyle: 'thin' as const })),
  ]);

  const sheets: Sheet<Blob>[] = [{
    data: summaryRows,
    sheet: t('excel.summarySheet').slice(0, 31),
    columns: [{ width: 18 }, { width: 13 }, { width: 15 }, { width: 13 }, { width: 9 }, ...tops.map(() => ({ width: 16 }))],
    stickyRowsCount: 1,
    stickyColumnsCount: 1,
  }];

  // ---- One sheet per month with expenses
  const columnTitles = [
    t('excel.date'), t('excel.category'), t('excel.subcategory'), t('excel.forWhom'), t('excel.paidBy'), t('excel.amount'), t('excel.note'),
  ];
  for (const ym of months) {
    const rows = byMonth.get(ym);
    if (!rows?.length) continue;
    const data: Row[] = [columnTitles.map((value) => ({ value, ...HEADER }))];
    for (const e of rows) {
      const sub = catById.get(e.categoryId);
      const top = topOf(e);
      data.push([
        { value: excelDate(e.date), type: Date, format: DATE_FORMAT },
        { value: name(top) },
        { value: sub && sub.parentId ? name(sub) : '' },
        { value: who(e.forWhomId) },
        { value: who(e.paidById) },
        { value: e.amountCents / 100, type: Number, format: MONEY_FORMAT },
        { value: e.note },
      ]);
    }
    data.push([
      { value: t('excel.total'), fontWeight: 'bold', topBorderStyle: 'thin' }, null, null, null, null,
      { value: rows.reduce((s, e) => s + e.amountCents, 0) / 100, type: Number, format: MONEY_FORMAT, fontWeight: 'bold', topBorderStyle: 'thin' },
      null,
    ]);
    sheets.push({
      data,
      sheet: ym,
      columns: [{ width: 12 }, { width: 26 }, { width: 32 }, { width: 18 }, { width: 14 }, { width: 12 }, { width: 30 }],
      stickyRowsCount: 1,
    });
  }

  return writeXlsxFile(sheets, { fontFamily: 'Calibri', fontSize: 11 }).toBlob();
}
