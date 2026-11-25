import { db } from './schema';
import { touch } from './repo';
import { SHARED_SETTINGS_ID, type EffectiveBudget, type MonthBudget, type YearMonth } from '../types';

/**
 * The budget is variable and chosen by the parents:
 * - a default monthly budget (applies to every month), and
 * - optional per-month overrides (a different amount, or "no budget", for one month).
 */
export async function getEffectiveBudget(month: YearMonth): Promise<EffectiveBudget> {
  const override = await db.budgets.get(month);
  if (override && override.deletedAt === null) return { cents: override.amountCents, source: 'month' };
  const shared = await db.settings.get(SHARED_SETTINGS_ID);
  return { cents: shared?.monthlyBudgetCents ?? null, source: 'default' };
}

export async function getDefaultBudget(): Promise<number | null> {
  return (await db.settings.get(SHARED_SETTINGS_ID))?.monthlyBudgetCents ?? null;
}

/** Set the default budget for all months (null = no default budget). */
export async function setDefaultBudget(cents: number | null): Promise<void> {
  const shared = await db.settings.get(SHARED_SETTINGS_ID);
  if (!shared) throw new Error('Shared settings missing');
  await db.settings.put(touch({ ...shared, monthlyBudgetCents: cents }));
}

/** Set a budget for one month only (null = no budget for that month). */
export async function setMonthBudget(month: YearMonth, cents: number | null): Promise<void> {
  const existing = await db.budgets.get(month);
  const row: MonthBudget = existing
    ? touch({ ...existing, amountCents: cents, deletedAt: null })
    : touch({ id: month, amountCents: cents, updatedAt: 0, deletedAt: null, deviceId: '' });
  await db.budgets.put(row);
}

/** Remove a month's override so the default applies again (soft delete, syncs). */
export async function clearMonthBudget(month: YearMonth): Promise<void> {
  const existing = await db.budgets.get(month);
  if (!existing || existing.deletedAt !== null) return;
  await db.budgets.put({ ...touch(existing), deletedAt: Date.now() });
}

export type BudgetLevel = 'ok' | 'warning' | 'over';

/** Green < 80 %, amber 80–99 %, red ≥ 100 %. */
export function budgetLevel(spentCents: number, budgetCents: number | null): BudgetLevel {
  if (!budgetCents || budgetCents <= 0) return 'ok';
  const ratio = spentCents / budgetCents;
  return ratio >= 1 ? 'over' : ratio >= 0.8 ? 'warning' : 'ok';
}
