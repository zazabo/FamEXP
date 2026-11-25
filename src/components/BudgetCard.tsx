import { useTranslation } from 'react-i18next';
import { Pencil } from 'lucide-react';
import { budgetLevel } from '../db/budget';
import { formatMoney } from '../i18n/format';
import type { EffectiveBudget } from '../types';

interface Props {
  spentCents: number;
  count: number;
  budget: EffectiveBudget;
  onEdit: () => void;
}

/** Spent / budget with a colour-coded bar (green < 80 %, amber 80–99 %, red ≥ 100 %). Tap to change the budget. */
export function BudgetCard({ spentCents, count, budget, onEdit }: Props) {
  const { t } = useTranslation();
  const cents = budget.cents;
  const level = budgetLevel(spentCents, cents);
  const pct = cents ? Math.round((spentCents / cents) * 100) : 0;

  return (
    <button type="button" className={`card budget-card level-${level}`} onClick={onEdit} title={t('dashboard.budgetCardHint')}
      aria-label={`${t('dashboard.spent')} ${formatMoney(spentCents)}${cents ? `, ${t('dashboard.spentOf', { budget: formatMoney(cents) })}` : ''}. ${t('dashboard.budgetCardHint')}`}>
      <div className="row" style={{ minHeight: 0 }}>
        <span className="muted">{t('dashboard.spent')} · {t('dashboard.count', { count })}</span>
        <Pencil size={16} className="muted" aria-hidden="true" />
      </div>
      <div className="budget-amounts">
        <span className="budget-spent">{formatMoney(spentCents)}</span>
        {cents ? <span className="muted">{t('dashboard.spentOf', { budget: formatMoney(cents) })}</span> : null}
      </div>
      {cents ? (
        <>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(pct, 100)}
            title={t('dashboard.percentUsed', { pct })}>
            <span style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          <div className="row" style={{ minHeight: 0, fontSize: 'var(--fs-sm)' }}>
            <span className={`level-text level-${level}`}>
              {spentCents > cents
                ? t('dashboard.overBy', { amount: formatMoney(spentCents - cents) })
                : t('dashboard.remaining', { amount: formatMoney(cents - spentCents) })}
            </span>
            <span className="muted">{pct}% · {budget.source === 'month' ? t('dashboard.sourceMonth') : t('dashboard.sourceDefault')}</span>
          </div>
        </>
      ) : (
        <span className="link-btn" style={{ padding: 0, minHeight: 0 }}>{t('dashboard.setBudget')}</span>
      )}
    </button>
  );
}
