import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { currentLocale } from '../i18n';
import { formatMoney, formatMonthYear } from '../i18n/format';
import { parseYearMonth } from '../db/dates';
import { evaluateBudgetAlerts, showSystemNotification } from '../services/budgetAlerts';
import { useToast } from './toast';
import type { YearMonth } from '../types';

/** Evaluate the 80 % / 100 % thresholds for a month and, if newly crossed, show banner + notification. */
export function useBudgetAlerts(): (month: YearMonth) => Promise<void> {
  const { t } = useTranslation();
  const toast = useToast();

  return useCallback(
    async (month: YearMonth) => {
      const alert = await evaluateBudgetAlerts(month);
      if (!alert) return;
      const p = parseYearMonth(month)!;
      const message = t(alert.threshold === 100 ? 'alerts.reached100' : 'alerts.reached80', {
        month: formatMonthYear(p.y, p.m, currentLocale()),
        spent: formatMoney(alert.spentCents),
        budget: formatMoney(alert.budgetCents),
      });
      // Small delay so the banner does not collide with a "saved" message.
      window.setTimeout(() => toast.show(message, { tone: alert.threshold === 100 ? 'danger' : 'warning', durationMs: 7000 }), 400);
      await showSystemNotification(t('alerts.title'), message);
    },
    [t, toast],
  );
}
