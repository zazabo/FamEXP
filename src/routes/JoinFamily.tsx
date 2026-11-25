import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DropboxConnect } from '../components/DropboxConnect';
import { PassphraseForm } from '../components/PassphraseForm';
import { Pills } from '../components/Pills';
import { db } from '../db/schema';
import { completeJoin, listMembers } from '../db/family';
import { alive } from '../db/repo';
import { isConnected } from '../services/dropbox';
import { createPinHash } from '../services/pin';
import { hasFamilyKey, syncNow, SyncError } from '../services/sync';
import { useSession } from '../state/session';
import { StepSecurity, type Draft } from './Onboarding';
import type { FamilyMember } from '../types';

type Step = 'dropbox' | 'pass' | 'download' | 'who' | 'security';
const STEPS: Step[] = ['dropbox', 'pass', 'who', 'security'];

/**
 * Second phone: connect the same Dropbox, enter the family passphrase, download and merge
 * the family's data, choose which parent this phone belongs to, then set PIN / Face ID.
 */
export function JoinFamily({ onCancel }: { onCancel: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { completeOnboarding } = useSession();
  const [step, setStep] = useState<Step | null>(null);
  const [parents, setParents] = useState<FamilyMember[]>([]);
  const [expenseCount, setExpenseCount] = useState(0);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<Draft>({
    parent1: '', parent2: '', owner: 1, children: [], pin: '', biometricCredentialId: null, budget: '',
  });
  const [saving, setSaving] = useState(false);

  // Resume where we were if the app was closed while copying the Dropbox code.
  useEffect(() => {
    void (async () => {
      if (!(await isConnected())) setStep('dropbox');
      else if (!(await hasFamilyKey())) setStep('pass');
      else setStep('download');
    })();
  }, []);

  const download = useCallback(async () => {
    setError('');
    setStep('download');
    try {
      await syncNow();
      const members = await listMembers();
      const ps = members.filter((m) => m.role === 'parent');
      setParents(ps);
      setExpenseCount(alive(await db.expenses.toArray()).length);
      if (!ps.length) {
        setError(t('join.noParents'));
        return;
      }
      setOwnerId((cur) => cur ?? ps[0]!.id);
      setStep('who');
    } catch (err) {
      const kind = err instanceof SyncError ? err.kind : 'other';
      setError(kind === 'offline' ? t('sync.errOffline') : kind === 'auth' ? t('sync.errAuth')
        : kind === 'badkey' ? t('sync.errKey') : t('sync.errOther'));
    }
  }, [t]);

  useEffect(() => {
    if (step === 'download' && !error && !parents.length) void download();
  }, [step]);

  const finish = async () => {
    if (!ownerId || draft.pin.length !== 4) return;
    setSaving(true);
    try {
      await completeJoin({ ownerParentId: ownerId, pinHash: await createPinHash(draft.pin), biometricCredentialId: draft.biometricCredentialId });
      completeOnboarding();
      navigate('/', { replace: true });
    } catch (err) {
      console.error(err);
      setError(t('onboarding.saveError'));
      setSaving(false);
    }
  };

  const index = step === 'download' ? 1 : STEPS.indexOf(step ?? 'dropbox');
  const ownerName = parents.find((p) => p.id === ownerId)?.name ?? '';

  return (
    <div className="shell">
      <main className="screen">
        <div className="progress-steps" aria-hidden="true">
          {STEPS.map((s, i) => <span key={s} className={i <= index ? 'done' : ''} />)}
        </div>
        <h1 className="screen-title">{t('join.title')}</h1>

        {step === 'dropbox' && <DropboxConnect onConnected={() => setStep('pass')} />}
        {step === 'pass' && <PassphraseForm mode="join" onDone={() => setStep('download')} />}
        {step === 'download' && (
          <div className="stack">
            {!error && <p className="muted">{t('join.downloading')}</p>}
            {error && (
              <>
                <p className="error">{error}</p>
                <button type="button" className="btn btn-primary btn-block" onClick={() => void download()}>{t('sync.syncNow')}</button>
              </>
            )}
          </div>
        )}
        {step === 'who' && (
          <div className="stack">
            <p className="success" style={{ margin: 0 }}>✓ {t('join.found', { count: expenseCount })}</p>
            <div className="field">
              <span className="field-label">{t('join.whoTitle')}</span>
              <Pills options={parents.map((p) => ({ value: p.id, label: p.name }))} value={ownerId}
                onChange={setOwnerId} ariaLabel={t('join.whoTitle')} hint={t('join.whoHint')} />
              <small className="muted">{t('join.whoHint')}</small>
            </div>
          </div>
        )}
        {step === 'security' && (
          <StepSecurity draft={{ ...draft, parent1: ownerName, owner: 1 }} budgetValid showBudget={false}
            patch={(p) => setDraft((d) => ({ ...d, ...p }))} />
        )}
        {error && step === 'security' && <p className="error">{error}</p>}
      </main>
      <footer className="wizard-footer">
        <button type="button" className="btn" disabled={saving}
          onClick={() => (step === 'security' ? setStep('who') : onCancel())}>
          {t('common.back')}
        </button>
        {step === 'who' && (
          <button type="button" className="btn btn-primary" disabled={!ownerId} onClick={() => setStep('security')}>
            {t('common.continue')}
          </button>
        )}
        {step === 'security' && (
          <button type="button" className="btn btn-primary" disabled={draft.pin.length !== 4 || saving} onClick={() => void finish()}>
            {saving ? t('onboarding.saving') : t('onboarding.finish')}
          </button>
        )}
      </footer>
    </div>
  );
}
