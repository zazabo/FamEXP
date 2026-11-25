import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LockKeyhole } from 'lucide-react';
import { PinPad } from '../components/PinPad';
import { getLocal } from '../db/init';
import { checkPin, getPinAttempts } from '../services/pin';
import { isPasskeyAvailable, verifyPasskey } from '../services/passkey';
import { useSession } from '../state/session';

/** Shown on launch and on every return from background. PIN keypad + optional Face ID / fingerprint. */
export function Lock() {
  const { t } = useTranslation();
  const { unlock, suppressAutoLock } = useSession();

  const [entry, setEntry] = useState('');
  const [message, setMessage] = useState('');
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [credentialId, setCredentialId] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  // LockGate redirects back to the previous screen as soon as the session is unlocked.
  const done = unlock;

  useEffect(() => {
    void (async () => {
      const attempts = await getPinAttempts();
      if (attempts.lockedUntil && attempts.lockedUntil > Date.now()) setLockedUntil(attempts.lockedUntil);
      const cred = await getLocal<string | null>('biometricCredentialId');
      if (cred && (await isPasskeyAvailable())) setCredentialId(cred);
    })();
  }, []);

  // Countdown while the keypad is locked out.
  useEffect(() => {
    if (!lockedUntil) return;
    const id = window.setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= lockedUntil) {
        setLockedUntil(null);
        setMessage('');
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [lockedUntil]);

  const onComplete = async (pin: string) => {
    setChecking(true);
    const result = await checkPin(pin);
    setChecking(false);
    setEntry('');
    if (result.ok) return done();
    if (result.lockedUntil) {
      setNow(Date.now());
      setLockedUntil(result.lockedUntil);
      setMessage('');
    } else {
      setMessage(t('lock.attemptsLeft', { count: result.remaining }));
    }
  };

  const onBiometric = async () => {
    if (!credentialId) return;
    const release = suppressAutoLock();
    const ok = await verifyPasskey(credentialId);
    release();
    if (ok) done();
    else setMessage(t('lock.biometricFailed'));
  };

  const secondsLeft = lockedUntil ? Math.max(1, Math.ceil((lockedUntil - now) / 1000)) : 0;

  return (
    <div className="shell">
      <main className="lock-screen">
        <LockKeyhole size={36} strokeWidth={1.6} aria-hidden="true" />
        <div>
          <h1 className="screen-title" style={{ margin: 0 }}>{t('app.shortName')}</h1>
          <p className="muted" style={{ margin: 'var(--sp-xs) 0 0' }}>{t('lock.enterPin')}</p>
        </div>
        <p className="error" role="alert">
          {lockedUntil ? t('lock.lockedOut', { s: secondsLeft }) : message}
        </p>
        <PinPad value={entry} onChange={setEntry} onComplete={(p) => void onComplete(p)}
          disabled={checking || lockedUntil !== null}
          onBiometric={credentialId ? () => void onBiometric() : undefined} />
        <button type="button" className="link-btn" onClick={() => setShowForgot((s) => !s)}>{t('lock.forgot')}</button>
        {showForgot && <p className="muted" style={{ fontSize: 'var(--fs-sm)', margin: 0 }}>{t('lock.forgotHelp')}</p>}
      </main>
    </div>
  );
}
