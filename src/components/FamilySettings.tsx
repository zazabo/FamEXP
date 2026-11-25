import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus } from 'lucide-react';
import { db } from '../db/schema';
import { setLocal } from '../db/init';
import { newSyncFields, touch } from '../db/repo';
import { getDefaultBudget, setDefaultBudget } from '../db/budget';
import { currentYearMonth } from '../db/dates';
import { formatAmountInput, parseMoney } from '../i18n/format';
import { useFamilyData } from '../state/useFamilyData';
import { useBudgetAlerts } from '../state/useBudgetAlerts';
import { useToast } from '../state/toast';
import type { FamilyMember } from '../types';

const thisYear = new Date().getFullYear();
const YEARS = Array.from({ length: 31 }, (_, i) => thisYear - i);

async function saveMember(m: FamilyMember, patch: Partial<FamilyMember>): Promise<void> {
  const current = await db.familyMembers.get(m.id);
  if (current) await db.familyMembers.put(touch({ ...current, ...patch }));
}

/** A name field that saves when it loses focus (and only if changed / not empty). */
function NameInput({ member, hint }: { member: FamilyMember; hint: string }) {
  const [value, setValue] = useState(member.name);
  useEffect(() => setValue(member.name), [member.name]);
  return (
    <input className="input" value={value} maxLength={30} autoComplete="off" title={hint} aria-label={member.name}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        const v = value.trim();
        if (v && v !== member.name) void saveMember(member, { name: v });
        else setValue(member.name);
      }} />
  );
}

/** Settings → Family & Budget: names, second parent, children & birth years, phone owner, default budget. */
export function FamilySettings() {
  const { t } = useTranslation();
  const family = useFamilyData();
  const defaultBudget = useLiveQuery(() => getDefaultBudget(), []);
  const runAlerts = useBudgetAlerts();
  const toast = useToast();
  const [budget, setBudget] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  useEffect(() => {
    if (defaultBudget !== undefined && budget === null) setBudget(formatAmountInput(defaultBudget));
  }, [defaultBudget, budget]);

  if (!family) return <p className="muted">{t('app.loading')}</p>;
  const { parents, children, ownerId } = family;

  const addParent2 = async () => {
    await db.familyMembers.add({
      ...newSyncFields(), role: 'parent', name: t('members.parentN', { n: 2 }), parentSlot: 2, birthYear: null, sortOrder: 1,
    });
  };
  const addChild = async () => {
    const n = children.length + 1;
    await db.familyMembers.add({
      ...newSyncFields(), role: 'child', name: t('members.childN', { n }), parentSlot: null, birthYear: thisYear,
      sortOrder: 10 + Math.max(0, ...children.map((c) => c.sortOrder - 9)),
    });
  };
  const removeChild = async (c: FamilyMember) => {
    if (confirmRemove !== c.id) return setConfirmRemove(c.id);
    setConfirmRemove(null);
    await saveMember(c, { deletedAt: Date.now() });
  };
  const saveBudget = async (cents: number | null) => {
    await setDefaultBudget(cents);
    setBudget(formatAmountInput(cents));
    toast.show(t('family.saved'), { durationMs: 2000 });
    await runAlerts(currentYearMonth());
  };
  const budgetCents = parseMoney(budget ?? '');
  const budgetValid = (budget ?? '').trim() === '' || (budgetCents !== null && budgetCents > 0);

  return (
    <div className="stack" style={{ gap: 'var(--sp-md)' }}>
      <div className="field">
        <span className="field-label">{t('family.parents')}</span>
        {parents.map((p) => <NameInput key={p.id} member={p} hint={t('family.nameHint')} />)}
        {parents.length < 2 && (
          <button type="button" className="btn" onClick={() => void addParent2()}><Plus size={18} /> {t('family.addParent2')}</button>
        )}
      </div>

      {parents.length > 1 && (
        <div className="field" title={t('family.ownerHint')}>
          <span className="field-label">{t('family.owner')}</span>
          <div className="segmented segmented-block" role="group" aria-label={t('family.owner')}>
            {parents.map((p) => (
              <button key={p.id} type="button" aria-pressed={ownerId === p.id} onClick={() => void setLocal('ownerParentId', p.id)}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="field">
        <span className="field-label">{t('family.children')}</span>
        {children.map((c) => (
          <div key={c.id} className="family-child">
            <NameInput member={c} hint={t('family.nameHint')} />
            <select className="select" value={c.birthYear ?? ''} title={t('onboarding.birthYearHint')} aria-label={t('onboarding.birthYear')}
              onChange={(e) => void saveMember(c, { birthYear: Number(e.target.value) })}>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <button type="button" className="link-btn" style={{ color: 'var(--c-danger)' }} title={t('family.removeChildHint')}
              onClick={() => void removeChild(c)}>
              {confirmRemove === c.id ? t('family.removeConfirm') : t('family.removeChild')}
            </button>
          </div>
        ))}
        <button type="button" className="btn" onClick={() => void addChild()}><Plus size={18} /> {t('family.addChild')}</button>
      </div>

      <div className="field" title={t('family.defaultBudgetHint')}>
        <span className="field-label">{t('family.defaultBudget')} (€)</span>
        <div className="family-budget">
          <input className="input" inputMode="decimal" autoComplete="off" value={budget ?? ''}
            placeholder={t('onboarding.budgetPlaceholder')} onChange={(e) => setBudget(e.target.value)} />
          <button type="button" className="btn btn-primary" disabled={!budgetValid}
            onClick={() => void saveBudget((budget ?? '').trim() ? budgetCents : null)}>
            {t('common.save')}
          </button>
          <button type="button" className="btn" onClick={() => void saveBudget(null)}>{t('family.noBudget')}</button>
        </div>
        <small className="muted">{t('family.defaultBudgetHint')}</small>
      </div>
    </div>
  );
}
