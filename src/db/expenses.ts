import { db } from './schema';
import { getLocal } from './init';
import { alive, newSyncFields, touch } from './repo';
import { monthRange } from './dates';
import type { Expense, ISODate, YearMonth } from '../types';

export interface ExpenseInput {
  amountCents: number;
  categoryId: string;
  forWhomId: string;
  paidById: string;
  date: ISODate;
  note: string;
}

/** Live (not deleted) expenses of a month, newest first. */
export async function listMonthExpenses(month: YearMonth): Promise<Expense[]> {
  const { start, end } = monthRange(month);
  const rows = await db.expenses.where('date').between(start, end, true, true).toArray();
  return alive(rows).sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));
}

export async function monthTotalCents(month: YearMonth): Promise<number> {
  return (await listMonthExpenses(month)).reduce((sum, e) => sum + e.amountCents, 0);
}

/** Create (no id) or update (with existing row) an expense — local first. */
export async function saveExpense(input: ExpenseInput, existing?: Expense): Promise<Expense> {
  const clean = { ...input, note: input.note.trim().slice(0, 60) };
  const row: Expense = existing
    ? touch({ ...existing, ...clean })
    : { ...newSyncFields(), ...clean, createdAt: Date.now() };
  await db.expenses.put(row);
  return row;
}

/** Soft delete (tombstone syncs to the other phone). Returns the deleted row for undo. */
export async function deleteExpense(id: string): Promise<Expense | undefined> {
  const row = await db.expenses.get(id);
  if (!row || row.deletedAt !== null) return undefined;
  const deleted = { ...touch(row), deletedAt: Date.now() };
  await db.expenses.put(deleted);
  return deleted;
}

export async function restoreExpense(id: string): Promise<void> {
  const row = await db.expenses.get(id);
  if (!row) return;
  await db.expenses.put({ ...touch(row), deletedAt: null });
}

/** Most recently used subcategory ids (for the quick-pick row), newest first. */
export async function recentCategoryIds(limit = 6): Promise<string[]> {
  const rows = alive(await db.expenses.orderBy('updatedAt').reverse().limit(60).toArray());
  const ids: string[] = [];
  for (const r of rows) {
    if (!ids.includes(r.categoryId)) ids.push(r.categoryId);
    if (ids.length >= limit) break;
  }
  return ids;
}

/** The parent who owns this phone (default for "Paid by"). */
export const getOwnerParentId = (): Promise<string | undefined> => getLocal<string>('ownerParentId');
