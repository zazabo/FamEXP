import { getLocal, setLocal } from '../db/init';
import { getEffectiveBudget } from '../db/budget';
import { monthTotalCents } from '../db/expenses';
import type { YearMonth } from '../types';

export type Threshold = 80 | 100;
const THRESHOLDS: Threshold[] = [80, 100];

/**
 * Per month, which thresholds have already alerted on this phone, and for which budget
 * amount. Changing that month's budget re-arms both thresholds; deleting / undoing
 * expenses does not (so a delete + undo never repeats an alert).
 */
type MonthFlags = { budgetCents: number | null } & Partial<Record<Threshold, boolean>>;
type AlertState = Record<YearMonth, MonthFlags>;

export interface BudgetAlert {
  month: YearMonth;
  threshold: Threshold;
  spentCents: number;
  budgetCents: number;
}

/**
 * Run after every local insert / edit / delete, budget change and (Phase 4) sync merge.
 * Each threshold fires once per month per phone (per budget amount).
 * Returns the highest newly crossed threshold, if any.
 */
export async function evaluateBudgetAlerts(month: YearMonth): Promise<BudgetAlert | null> {
  const budget = await getEffectiveBudget(month);
  const state = (await getLocal<AlertState>('budgetAlerts')) ?? {};
  const prev = state[month];
  const flags: MonthFlags = prev && prev.budgetCents === budget.cents ? { ...prev } : { budgetCents: budget.cents };

  let fired: Threshold | null = null;
  let spentCents = 0;
  if (budget.cents && budget.cents > 0) {
    spentCents = await monthTotalCents(month);
    const pct = (spentCents / budget.cents) * 100;
    for (const th of THRESHOLDS) {
      if (pct >= th && !flags[th]) {
        flags[th] = true;
        fired = th; // keep the highest
      }
    }
  }

  await setLocal('budgetAlerts', { ...state, [month]: flags });
  return fired && budget.cents ? { month, threshold: fired, spentCents, budgetCents: budget.cents } : null;
}

/**
 * Ask for notification permission — call directly from a tap (browsers require a gesture).
 * On iPhone this only exists once the app is added to the home screen.
 */
export function requestNotificationPermission(): void {
  try {
    if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission();
  } catch {
    /* unsupported */
  }
}

/** Show a system notification if allowed. iOS needs the service worker's showNotification. */
export async function showSystemNotification(title: string, body: string): Promise<void> {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'budget' });
    else new Notification(title, { body });
  } catch {
    /* best effort — the in-app banner is always shown */
  }
}
