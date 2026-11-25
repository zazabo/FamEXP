import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';
import { PinPad } from '../components/PinPad';
import { checkPin, savePin } from '../services/pin';

type Phase = 'current' | 'new' | 'confirm' | 'done';

/** Settings → Security → Change PIN (this phone only). */
export function ChangePin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('current');
  const [entry, setEntry] = useState('');
  const [first, setFirst] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const prompt = phase === 'current' ? t('settings.currentPin')
    : phase === 'new' ? t('settings.newPin') : t('settings.confirmNewPin');

  const onComplete = async (pin: string) => {
    setEntry('');
    setError('');
    if (phase === 'current') {
      setBusy(true);
      const res = await checkPin(pin);
      setBusy(false);
      if (res.ok) setPhase('new');
      else if (res.lockedUntil) setError(t('lock.lockedOut', { s: Math.ceil((res.lockedUntil - Date.now()) / 1000) }));
      else setError(t('lock.attemptsLeft', { count: res.remaining }));
    } else if (phase === 'new') {
      setFirst(pin);
      setPhase('confirm');
    } else if (pin === first) {
      setBusy(true);
      await savePin(pin);
      setBusy(false);
      setPhase('done');
    } else {
      setFirst('');
      setPhase('new');
      setError(t('onboarding.pinMismatch'));
    }
  };

  return (
    <div className="shell">
      <header className="modal-header">
        <button className="icon-btn" onClick={() => navigate('/settings')} aria-label={t('common.back')} title={t('common.back')}>
          <ChevronLeft />
        </button>
        <strong>{t('settings.changePinTitle')}</strong>
        <span style={{ width: 'var(--touch)' }} />
      </header>
      <main className="lock-screen" style={{ justifyContent: 'center' }}>
        {phase === 'done' ? (
          <>
            <p className="success">✓ {t('settings.pinChanged')}</p>
            <button className="btn btn-primary" onClick={() => navigate('/settings')}>{t('common.done')}</button>
          </>
        ) : (
          <>
            <p title={t('settings.changePinHint')}><strong>{prompt}</strong></p>
            <p className="error" role="alert">{error}</p>
            <PinPad value={entry} onChange={setEntry} onComplete={(p) => void onComplete(p)} disabled={busy} />
          </>
        )}
      </main>
    </div>
  );
}
