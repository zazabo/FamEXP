import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Minus, Plus } from 'lucide-react';
import { PinPad } from '../components/PinPad';
import { Switch } from '../components/Switch';
import { createFamily } from '../db/family';
import { parseMoney } from '../i18n/format';
import { createPinHash } from '../services/pin';
import { isPasskeyAvailable, registerPasskey } from '../services/passkey';
import { useSession } from '../state/session';
import type { ParentSlot } from '../types';
import { JoinFamily } from './JoinFamily';

interface ChildDraft {
  name: string;
  birthYear: number | null;
}

export interface Draft {
  parent1: string;
  parent2: string;
  owner: ParentSlot;
  children: ChildDraft[];
  pin: string;
  biometricCredentialId: string | null;
  budget: string;
}

const MAX_CHILDREN = 12;
const TOTAL_STEPS = 3;
const thisYear = new Date().getFullYear();
const YEARS = Array.from({ length: 31 }, (_, i) => thisYear - i);

/** First-run setup: "New family" (3 steps, first phone) or "Join family" (second phone, via Dropbox). */
export function Onboarding() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { completeOnboarding } = useSession();

  const [step, setStep] = useState(0);
  const [joining, setJoining] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    parent1: '', parent2: '', owner: 1, children: [], pin: '', biometricCredentialId: null, budget: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  const budgetCents = parseMoney(draft.budget);
  const budgetValid = draft.budget.trim() === '' || (budgetCents !== null && budgetCents > 0);
  const stepValid =
    step === 1 ? draft.parent1.trim() !== '' && (draft.owner === 1 || draft.parent2.trim() !== '')
      : step === 2 ? draft.children.every((c) => c.birthYear !== null)
        : step === 3 ? draft.pin.length === 4 && budgetValid
          : true;

  async function finish() {
    setSaving(true);
    setSaveError(false);
    try {
      const parents: { slot: ParentSlot; name: string }[] = [{ slot: 1, name: draft.parent1 }];
      if (draft.parent2.trim()) parents.push({ slot: 2, name: draft.parent2 });
      await createFamily({
        parents,
        children: draft.children.map((c, i) => ({
          name: c.name.trim() || t('members.childN', { n: i + 1 }),
          birthYear: c.birthYear ?? thisYear,
        })),
        ownerSlot: draft.owner,
        monthlyBudgetCents: draft.budget.trim() ? budgetCents : null,
        pinHash: await createPinHash(draft.pin),
        biometricCredentialId: draft.biometricCredentialId,
      });
      completeOnboarding();
      navigate('/', { replace: true });
    } catch (err) {
      console.error(err);
      setSaveError(true);
      setSaving(false);
    }
  }

  if (joining) return <JoinFamily onCancel={() => setJoining(false)} />;

  if (step === 0) {
    return (
      <div className="shell">
        <main className="screen">
          <h1 className="screen-title">{t('onboarding.welcome')}</h1>
          <button type="button" className="choice-card" onClick={() => setStep(1)} title={t('onboarding.newFamilyHint')}>
            <strong>{t('onboarding.newFamily')}</strong>
            <span className="muted">{t('onboarding.newFamilyHint')}</span>
          </button>
          <button type="button" className="choice-card" onClick={() => setJoining(true)} title={t('onboarding.joinFamilyHint')}>
            <strong>{t('onboarding.joinFamily')}</strong>
            <span className="muted">{t('onboarding.joinFamilyHint')}</span>
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="shell">
      <main className="screen">
        <div className="progress-steps" aria-hidden="true">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => <span key={i} className={i < step ? 'done' : ''} />)}
        </div>
        <p className="muted" style={{ margin: 0 }}>{t('onboarding.stepOf', { n: step, total: TOTAL_STEPS })}</p>

        {step === 1 && <StepParents draft={draft} patch={patch} />}
        {step === 2 && <StepChildren draft={draft} patch={patch} />}
        {step === 3 && <StepSecurity draft={draft} patch={patch} budgetValid={budgetValid} />}

        {saveError && <p className="error">{t('onboarding.saveError')}</p>}
      </main>
      <footer className="wizard-footer">
        <button type="button" className="btn" onClick={() => setStep(step - 1)} disabled={saving}>
          {t('common.back')}
        </button>
        {step < TOTAL_STEPS ? (
          <button type="button" className="btn btn-primary" disabled={!stepValid} onClick={() => setStep(step + 1)}>
            {t('common.continue')}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" disabled={!stepValid || saving} onClick={() => void finish()}>
            {saving ? t('onboarding.saving') : t('onboarding.finish')}
          </button>
        )}
      </footer>
    </div>
  );
}

export interface StepProps {
  draft: Draft;
  patch: (p: Partial<Draft>) => void;
}

function StepParents({ draft, patch }: StepProps) {
  const { t } = useTranslation();
  const hasSecond = draft.parent2.trim() !== '';
  return (
    <>
      <h1 className="screen-title">{t('onboarding.parentsTitle')}</h1>
      <div className="stack">
        <label className="field" title={t('onboarding.parentNameHint')}>
          <span className="field-label">{t('onboarding.parent1Label')}</span>
          <input className="input" value={draft.parent1} autoComplete="off" maxLength={30}
            placeholder={t('onboarding.parentNamePlaceholder')} onChange={(e) => patch({ parent1: e.target.value })} />
        </label>
        <label className="field" title={t('onboarding.parentNameHint')}>
          <span className="field-label">{t('onboarding.parent2Label')}</span>
          <input className="input" value={draft.parent2} autoComplete="off" maxLength={30}
            placeholder={t('onboarding.parentNamePlaceholder')}
            onChange={(e) => patch({ parent2: e.target.value, owner: e.target.value.trim() ? draft.owner : 1 })} />
        </label>
        {draft.parent1.trim() !== '' && hasSecond && (
          <div className="field" title={t('onboarding.ownerHint')}>
            <span className="field-label">{t('onboarding.ownerTitle')}</span>
            <div className="segmented" role="group" aria-label={t('onboarding.ownerTitle')}>
              {([1, 2] as const).map((slot) => (
                <button key={slot} type="button" aria-pressed={draft.owner === slot} onClick={() => patch({ owner: slot })}>
                  {slot === 1 ? draft.parent1 : draft.parent2}
                </button>
              ))}
            </div>
            <small className="muted">{t('onboarding.ownerHint')}</small>
          </div>
        )}
      </div>
    </>
  );
}

function StepChildren({ draft, patch }: StepProps) {
  const { t } = useTranslation();
  const count = draft.children.length;
  const setCount = (n: number) => {
    const next = draft.children.slice(0, n);
    while (next.length < n) next.push({ name: '', birthYear: null });
    patch({ children: next });
  };
  const setChild = (i: number, c: Partial<ChildDraft>) =>
    patch({ children: draft.children.map((x, j) => (j === i ? { ...x, ...c } : x)) });

  return (
    <>
      <h1 className="screen-title">{t('onboarding.childrenTitle')}</h1>
      <div className="stack">
        <div className="row" title={t('onboarding.childrenCountHint')}>
          <span>{t('onboarding.childrenCount')}</span>
          <div className="stepper">
            <button type="button" className="icon-btn" disabled={count === 0} onClick={() => setCount(count - 1)}
              aria-label={t('onboarding.decrease')} title={t('onboarding.decrease')}><Minus /></button>
            <span className="stepper-value" aria-live="polite">{count}</span>
            <button type="button" className="icon-btn" disabled={count >= MAX_CHILDREN} onClick={() => setCount(count + 1)}
              aria-label={t('onboarding.increase')} title={t('onboarding.increase')}><Plus /></button>
          </div>
        </div>
        {draft.children.map((c, i) => (
          <div key={i} className="child-row">
            <label className="field" title={t('onboarding.childNameHint')}>
              <span className="field-label">{t('members.childN', { n: i + 1 })}</span>
              <input className="input" value={c.name} autoComplete="off" maxLength={30}
                placeholder={t('onboarding.childNamePlaceholder', { n: i + 1 })}
                onChange={(e) => setChild(i, { name: e.target.value })} />
            </label>
            <label className="field" title={t('onboarding.birthYearHint')}>
              <span className="field-label">{t('onboarding.birthYear')}</span>
              <select className="select" value={c.birthYear ?? ''}
                onChange={(e) => setChild(i, { birthYear: e.target.value ? Number(e.target.value) : null })}>
                <option value="">{t('onboarding.selectYear')}</option>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
          </div>
        ))}
      </div>
    </>
  );
}

export function StepSecurity({ draft, patch, budgetValid, showBudget = true }: StepProps & { budgetValid: boolean; showBudget?: boolean }) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<'enter' | 'confirm' | 'set'>(draft.pin ? 'set' : 'enter');
  const [first, setFirst] = useState('');
  const [entry, setEntry] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const [passkeyOk, setPasskeyOk] = useState<boolean | null>(null);
  const [passkeyError, setPasskeyError] = useState(false);

  useEffect(() => {
    void isPasskeyAvailable().then(setPasskeyOk);
  }, []);

  const onComplete = (pin: string) => {
    if (phase === 'enter') {
      setFirst(pin);
      setEntry('');
      setMismatch(false);
      setPhase('confirm');
    } else if (pin === first) {
      patch({ pin });
      setPhase('set');
    } else {
      setMismatch(true);
      setFirst('');
      setEntry('');
      setPhase('enter');
    }
  };

  const toggleBiometrics = async (on: boolean) => {
    setPasskeyError(false);
    if (!on) return patch({ biometricCredentialId: null });
    try {
      const owner = draft.owner === 2 ? draft.parent2 : draft.parent1;
      patch({ biometricCredentialId: await registerPasskey(t('app.name'), owner.trim() || t('app.shortName')) });
    } catch {
      setPasskeyError(true);
    }
  };

  return (
    <>
      <h1 className="screen-title">{t('onboarding.securityTitle')}</h1>
      <div className="stack">
        {phase === 'set' ? (
          <div className="row" title={t('onboarding.pinHint')}>
            <span className="success">✓ {t('onboarding.pinSet')}</span>
            <button type="button" className="link-btn" onClick={() => { patch({ pin: '' }); setPhase('enter'); }}>
              {t('common.change')}
            </button>
          </div>
        ) : (
          <div className="card" title={t('onboarding.pinHint')}>
            <p style={{ textAlign: 'center', marginTop: 0 }}>
              <strong>{phase === 'enter' ? t('onboarding.pin') : t('onboarding.confirmPin')}</strong>
              <br />
              <small className="muted">{t('onboarding.pinHint')}</small>
            </p>
            <PinPad value={entry} onChange={setEntry} onComplete={onComplete} />
            <p className="error" style={{ textAlign: 'center' }}>{mismatch ? t('onboarding.pinMismatch') : ''}</p>
          </div>
        )}

        {phase === 'set' && (
          <>
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="row" title={t('onboarding.biometricsHint')}>
                <span>{t('onboarding.biometricsLabel')}</span>
                <Switch checked={draft.biometricCredentialId !== null} disabled={passkeyOk !== true}
                  label={t('onboarding.biometricsLabel')} hint={t('onboarding.biometricsHint')}
                  onChange={(on) => void toggleBiometrics(on)} />
              </div>
              <small className="muted">
                {passkeyOk === false ? t('onboarding.biometricsUnsupported') : t('onboarding.biometricsHint')}
              </small>
              {passkeyError && <p className="error">{t('onboarding.biometricsFailed')}</p>}
            </div>

            {showBudget && <label className="field" title={t('onboarding.budgetHint')}>
              <span className="field-label">{t('onboarding.budget')} · {t('common.optional')}</span>
              <input className="input" inputMode="decimal" autoComplete="off" value={draft.budget}
                placeholder={t('onboarding.budgetPlaceholder')} onChange={(e) => patch({ budget: e.target.value })} />
              <small className="muted">{t('onboarding.budgetHint')}</small>
              <p className="error">{budgetValid ? '' : t('onboarding.budgetInvalid')}</p>
            </label>}
          </>
        )}
      </div>
    </>
  );
}
