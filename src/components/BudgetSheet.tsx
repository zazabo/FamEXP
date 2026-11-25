import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { X } from 'lucide-react';
import { clearMonthBudget, getDefaultBudget, getEffectiveBudget, setDefaultBudget, setMonthBudget } from '../db/budget';
import { parseYearMonth } from '../db/dates';
import { currentLocale } from '../i18n';
import { formatAmountInput, formatMoney, formatMonthYear, parseMoney } from '../i18n/format';
import type { BudgetSource, YearMonth } from '../types';

interface Props {
  month: YearMonth;
  onClose: () => void;
  /** Called after any change, so the caller can re-check alerts. */
  onSaved: () => void;
}

/**
 * Variable, user-chosen budget: set an amount for this month only, or as the default for
 * every month; remove the limit; or drop a month's own amount to go back to the default.
 */
export function BudgetSheet({ month, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const effective = useLiveQuery(() => getEffectiveBudget(month), [month]);
  const defaultCents = useLiveQuery(() => getDefaultBudget(), []);
  const [scope, setScope] = useState<BudgetSource | null>(null);
  const [amount, setAmount] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  // Initialise the form once the current values are loaded.
  useEffect(() => {
    if (!effective || scope !== null) return;
    setScope(effective.source);
    setAmount(formatAmountInput(effective.cents));
  }, [effective, scope]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const p = parseYearMonth(month)!;
  const monthLabel = formatMonthYear(p.y, p.m, currentLocale());

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    await action();
    setBusy(false);
    onSaved();
    onClose();
  };

  const save = () => {
    const cents = parseMoney(amount ?? '');
    if (cents === null || cents <= 0) return setError(true);
    void run(async () => {
      if (scope === 'month') await setMonthBudget(month, cents);
      else {
        await setDefaultBudget(cents);
        await clearMonthBudget(month); // this month follows the new default
      }
    });
  };

  const removeLimit = () =>
    void run(async () => {
      if (scope === 'month') await setMonthBudget(month, null);
      else {
        await setDefaultBudget(null);
        await clearMonthBudget(month);
      }
    });

  const resetToDefault = () => void run(() => clearMonthBudget(month));

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={t('budget.titleMonth', { month: monthLabel })}
        onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={{ padding: 0, border: 'none', marginBottom: 'var(--sp-md)' }}>
          <strong>{t('budget.titleMonth', { month: monthLabel })}</strong>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('common.close')} title={t('common.close')}><X /></button>
        </div>

        {scope === null ? (
          <p className="muted">{t('app.loading')}</p>
        ) : (
          <div className="stack">
            <label className="field" title={t('budget.amountHint')}>
              <span className="field-label">{t('budget.amount')}</span>
              <input className="input input-amount" inputMode="decimal" autoComplete="off" autoFocus value={amount ?? ''}
                placeholder={t('onboarding.budgetPlaceholder')}
                onChange={(e) => { setAmount(e.target.value); setError(false); }}
                onKeyDown={(e) => e.key === 'Enter' && save()} />
              <p className="error">{error ? t('budget.invalid') : ''}</p>
            </label>

            <div className="field" title={t('budget.scopeHint')}>
              <span className="field-label">{t('budget.scope')}</span>
              <div className="segmented segmented-block" role="group" aria-label={t('budget.scope')}>
                <button type="button" aria-pressed={scope === 'month'} onClick={() => setScope('month')}>{t('budget.scopeMonth')}</button>
                <button type="button" aria-pressed={scope === 'default'} onClick={() => setScope('default')}>{t('budget.scopeDefault')}</button>
              </div>
              <small className="muted">
                {defaultCents ? t('budget.currentDefault', { amount: formatMoney(defaultCents) }) : t('budget.noDefault')}
              </small>
            </div>

            <button type="button" className="btn btn-primary btn-block" disabled={busy} onClick={save}>{t('common.save')}</button>
            <button type="button" className="btn btn-block" disabled={busy} onClick={removeLimit} title={t('budget.noneHint')}>
              {t('budget.none')}
            </button>
            {effective?.source === 'month' && (
              <button type="button" className="link-btn" disabled={busy} onClick={resetToDefault} title={t('budget.resetHint')}>
                {defaultCents ? t('budget.resetToDefault', { amount: formatMoney(defaultCents) }) : t('budget.resetToDefaultNone')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
