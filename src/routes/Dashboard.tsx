import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { BudgetCard } from '../components/BudgetCard';
import { BudgetSheet } from '../components/BudgetSheet';
import { CategoryIcon } from '../components/CategoryIcon';
import { SwipeRow } from '../components/SwipeRow';
import { getEffectiveBudget } from '../db/budget';
import { categoryName } from '../db/categories';
import { currentYearMonth, parseYearMonth, shiftYearMonth } from '../db/dates';
import { deleteExpense, listMonthExpenses, restoreExpense } from '../db/expenses';
import { currentLocale } from '../i18n';
import { formatMoney, formatMonthYear, formatShortDate } from '../i18n/format';
import { memberLabel, useFamilyData } from '../state/useFamilyData';
import { useBudgetAlerts } from '../state/useBudgetAlerts';
import { useToast } from '../state/toast';
import type { Expense } from '../types';

/** Tab 1 — month switcher, budget card, this month's expenses, `+` fast entry. */
export function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const locale = currentLocale();
  const [params, setParams] = useSearchParams();
  const month = parseYearMonth(params.get('m')) ? params.get('m')! : currentYearMonth();
  const p = parseYearMonth(month)!;

  const family = useFamilyData();
  const expenses = useLiveQuery(() => listMonthExpenses(month), [month]);
  const budget = useLiveQuery(() => getEffectiveBudget(month), [month]);
  const runAlerts = useBudgetAlerts();
  const toast = useToast();
  const [editingBudget, setEditingBudget] = useState(false);

  const setMonth = (m: string) => setParams(m === currentYearMonth() ? {} : { m }, { replace: true });
  const spent = (expenses ?? []).reduce((s, e) => s + e.amountCents, 0);

  const remove = async (e: Expense) => {
    await deleteExpense(e.id);
    toast.show(t('expense.deleted'), {
      actionLabel: t('expense.undo'),
      onAction: () => void restoreExpense(e.id).then(() => runAlerts(month)),
    });
    await runAlerts(month);
  };

  return (
    <>
      <div className="row" style={{ marginBottom: 'var(--sp-md)' }}>
        <button className="icon-btn" onClick={() => setMonth(shiftYearMonth(month, -1))}
          aria-label={t('dashboard.previousMonth')} title={t('dashboard.previousMonth')}>
          <ChevronLeft />
        </button>
        <strong className="month-title">{formatMonthYear(p.y, p.m, locale)}</strong>
        <button className="icon-btn" onClick={() => setMonth(shiftYearMonth(month, 1))}
          aria-label={t('dashboard.nextMonth')} title={t('dashboard.nextMonth')}>
          <ChevronRight />
        </button>
      </div>

      {budget && expenses && (
        <BudgetCard spentCents={spent} count={expenses.length} budget={budget} onEdit={() => setEditingBudget(true)} />
      )}

      <h2 className="section-title">{t('dashboard.recent')}</h2>
      {expenses && expenses.length === 0 && <p className="muted">{t('dashboard.empty')}</p>}
      {expenses && family && expenses.length > 0 && (
        <ul className="expense-list" title={t('dashboard.swipeHint')}>
          {expenses.map((e) => {
            const cat = family.categoryById.get(e.categoryId);
            const name = cat ? categoryName(cat, locale) : '—';
            const forWhom = memberLabel(e.forWhomId, family.allMembers, t);
            const payer = memberLabel(e.paidById, family.allMembers, t);
            return (
              <li key={e.id}>
                <SwipeRow onTap={() => navigate(`/expense/${e.id}`)} onDelete={() => void remove(e)}
                  label={`${name}, ${formatMoney(e.amountCents)}, ${forWhom}`} hint={t('dashboard.swipeHint')}
                  deleteLabel={t('common.delete')}>
                  <span className="exp-icon"><CategoryIcon name={cat?.icon ?? ''} size={20} /></span>
                  <span className="exp-main">
                    <span className="exp-title">{name}</span>
                    <span className="exp-sub">
                      {formatShortDate(e.date, locale)}{e.note ? ` · ${e.note}` : ''}
                    </span>
                  </span>
                  <span className="exp-side">
                    <span className="exp-amount">{formatMoney(e.amountCents)}</span>
                    <span className="exp-meta">
                      <span className="member-pill">{forWhom}</span>
                      <span className="payer" title={t('dashboard.paidByShort', { name: payer })}
                        aria-label={t('dashboard.paidByShort', { name: payer })}>
                        {payer.charAt(0).toUpperCase()}
                      </span>
                    </span>
                  </span>
                </SwipeRow>
              </li>
            );
          })}
        </ul>
      )}

      <Link to="/add-expense" className="fab" aria-label={t('dashboard.addExpense')} title={t('dashboard.addExpense')}>
        <Plus size={30} strokeWidth={2.2} />
      </Link>

      {editingBudget && (
        <BudgetSheet month={month} onClose={() => setEditingBudget(false)}
          onSaved={() => { toast.show(t('budget.saved'), { durationMs: 2500 }); void runAlerts(month); }} />
      )}
    </>
  );
}
