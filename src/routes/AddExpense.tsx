import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { Trash2, X } from 'lucide-react';
import { CategoryPicker } from '../components/CategoryPicker';
import { Pills } from '../components/Pills';
import { db } from '../db/schema';
import { deleteExpense, recentCategoryIds, restoreExpense, saveExpense } from '../db/expenses';
import { getEffectiveBudget } from '../db/budget';
import { currentYearMonth, yearMonthOf } from '../db/dates';
import { formatAmountInput, parseMoney, toISODate } from '../i18n/format';
import { requestNotificationPermission } from '../services/budgetAlerts';
import { useFamilyData } from '../state/useFamilyData';
import { useBudgetAlerts } from '../state/useBudgetAlerts';
import { useToast } from '../state/toast';
import { HOUSEHOLD_ID, type Expense } from '../types';

/**
 * Fast-entry modal (new) and edit screen (`/expense/:id`). Only the six essential fields:
 * amount, category/subcategory, for whom, paid by, date, optional note.
 */
export function AddExpense() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const family = useFamilyData();
  const recentIds = useLiveQuery(() => recentCategoryIds(), []) ?? [];
  const existing = useLiveQuery(async () => (id ? (await db.expenses.get(id)) ?? null : null), [id]);
  const hasBudget = useLiveQuery(async () => (await getEffectiveBudget(currentYearMonth())).cents !== null, []);
  const runAlerts = useBudgetAlerts();
  const toast = useToast();

  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [forWhomId, setForWhomId] = useState<string>(HOUSEHOLD_ID);
  const [paidById, setPaidById] = useState<string | null>(null);
  const [date, setDate] = useState(toISODate());
  const [note, setNote] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  // Fill the form: from the expense being edited, or defaults (paid by = this phone's owner).
  useEffect(() => {
    if (loaded || !family || existing === undefined) return;
    if (existing) {
      setAmount(formatAmountInput(existing.amountCents));
      setCategoryId(existing.categoryId);
      setForWhomId(existing.forWhomId);
      setPaidById(existing.paidById);
      setDate(existing.date);
      setNote(existing.note);
    } else {
      setPaidById(family.ownerId ?? family.parents[0]?.id ?? null);
    }
    setLoaded(true);
  }, [family, existing, loaded]);

  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate('/', { replace: true });
  };

  const amountCents = parseMoney(amount);
  const valid = amountCents !== null && amountCents > 0 && categoryId !== null && paidById !== null && /^\d{4}-\d{2}-\d{2}$/.test(date);

  const save = async () => {
    if (!valid || busy) return;
    if (hasBudget) requestNotificationPermission(); // must happen inside the tap
    setBusy(true);
    const saved = await saveExpense(
      { amountCents: amountCents!, categoryId: categoryId!, forWhomId, paidById: paidById!, date, note },
      existing ?? undefined,
    );
    toast.show(t('expense.saved'), { durationMs: 2500 });
    goBack();
    await runAlerts(yearMonthOf(saved.date));
    if (existing && yearMonthOf(existing.date) !== yearMonthOf(saved.date)) await runAlerts(yearMonthOf(existing.date));
  };

  const remove = async (row: Expense) => {
    setBusy(true);
    await deleteExpense(row.id);
    const month = yearMonthOf(row.date);
    toast.show(t('expense.deleted'), {
      actionLabel: t('expense.undo'),
      onAction: () => void restoreExpense(row.id).then(() => runAlerts(month)),
    });
    goBack();
    await runAlerts(month);
  };

  if (id && existing === null) {
    return (
      <div className="shell">
        <header className="modal-header">
          <strong>{t('expense.editTitle')}</strong>
          <button className="icon-btn" onClick={goBack} aria-label={t('common.close')} title={t('common.close')}><X /></button>
        </header>
        <main className="screen"><p className="muted">{t('expense.notFound')}</p></main>
      </div>
    );
  }

  const memberOptions = family
    ? [
        { value: HOUSEHOLD_ID, label: t('members.household') },
        ...family.parents.map((m) => ({ value: m.id, label: m.name })),
        ...family.children.map((m) => ({ value: m.id, label: m.name })),
      ]
    : [];
  const parentOptions = family ? family.parents.map((m) => ({ value: m.id, label: m.name })) : [];

  return (
    <div className="shell">
      <header className="modal-header">
        <button className="icon-btn" onClick={goBack} aria-label={t('common.close')} title={t('common.close')}><X /></button>
        <strong>{existing ? t('expense.editTitle') : t('expense.newTitle')}</strong>
        {existing ? (
          <button className="icon-btn" disabled={busy} onClick={() => void remove(existing)}
            aria-label={t('common.delete')} title={t('expense.deleteConfirmHint')} style={{ color: 'var(--c-danger)' }}>
            <Trash2 />
          </button>
        ) : <span style={{ width: 'var(--touch)' }} />}
      </header>

      <main className="screen" style={{ paddingBottom: 'var(--sp-xl)' }}>
        {!loaded || !family ? (
          <p className="muted">{t('app.loading')}</p>
        ) : (
          <div className="stack">
            <label className="field amount-field" title={t('expense.amountHint')}>
              <span className="field-label">{t('expense.amount')}</span>
              <div className="amount-wrap">
                <input className="input input-amount" inputMode="decimal" autoComplete="off" autoFocus={!existing}
                  placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)}
                  aria-invalid={amount !== '' && (amountCents === null || amountCents <= 0)} />
                <span className="amount-suffix" aria-hidden="true">€</span>
              </div>
            </label>

            <CategoryPicker categories={family.categories} bands={family.bands} recentIds={recentIds}
              value={categoryId} onChange={setCategoryId} />

            <div className="field">
              <span className="field-label">{t('expense.forWhom')}</span>
              <Pills options={memberOptions} value={forWhomId} onChange={setForWhomId}
                ariaLabel={t('expense.forWhom')} hint={t('expense.forWhomHint')} />
            </div>

            {parentOptions.length > 1 && (
              <div className="field">
                <span className="field-label">{t('expense.paidBy')}</span>
                <Pills options={parentOptions} value={paidById} onChange={setPaidById}
                  ariaLabel={t('expense.paidBy')} hint={t('expense.paidByHint')} />
              </div>
            )}

            <div className="child-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <label className="field" title={t('expense.dateHint')}>
                <span className="field-label">
                  {t('expense.date')}{date === toISODate() ? ` · ${t('common.today')}` : ''}
                </span>
                <input className="input" type="date" value={date} required onChange={(e) => setDate(e.target.value)} />
              </label>
              <label className="field" title={t('expense.noteHint')}>
                <span className="field-label">{t('expense.note')}</span>
                <input className="input" maxLength={60} autoComplete="off" value={note}
                  placeholder={t('expense.notePlaceholder')} onChange={(e) => setNote(e.target.value)} />
              </label>
            </div>
          </div>
        )}
      </main>

      <footer className="wizard-footer">
        <button type="button" className="btn btn-primary" disabled={!valid || busy} onClick={() => void save()}>
          {t('expense.save')}
        </button>
      </footer>
    </div>
  );
}
