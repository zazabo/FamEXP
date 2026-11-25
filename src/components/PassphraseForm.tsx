import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MIN_PASSPHRASE_LENGTH } from '../services/crypto';
import { fetchFamilyFile, setupFamilyKey, SyncError } from '../services/sync';

type Mode = 'create' | 'join';

interface Props {
  /** `auto`: create if Dropbox has no family yet, otherwise join. */
  mode: Mode | 'auto';
  onDone: () => void;
}

/** Set (first phone) or enter (second phone) the family passphrase that encrypts the Dropbox data. */
export function PassphraseForm({ mode, onDone }: Props) {
  const { t } = useTranslation();
  const [resolved, setResolved] = useState<Mode | null>(mode === 'auto' ? null : mode);
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode !== 'auto') return;
    fetchFamilyFile()
      .then((file) => setResolved(file ? 'join' : 'create'))
      .catch((err: unknown) => {
        setResolved('create');
        setError(err instanceof SyncError && err.kind === 'offline' ? t('sync.errOffline') : t('sync.errOther'));
      });
  }, [mode, t]);

  if (!resolved) return <p className="muted">{t('sync.checking')}</p>;

  const submit = async () => {
    setError('');
    if (pass.trim().length < MIN_PASSPHRASE_LENGTH) return setError(t('sync.passTooShort'));
    if (resolved === 'create' && pass !== confirm) return setError(t('sync.passMismatch'));
    setBusy(true);
    try {
      await setupFamilyKey(pass, resolved);
      onDone();
    } catch (err) {
      const kind = err instanceof SyncError ? err.kind : 'other';
      if (kind === 'badkey') setError(t('sync.passWrong'));
      else if (kind === 'nofamily') setError(t('sync.noFamily'));
      else if (kind === 'offline') setError(t('sync.errOffline'));
      else if (kind === 'auth') setError(t('sync.errAuth'));
      else if (resolved === 'create') {
        setResolved('join'); // someone created the family meanwhile
        setError(t('sync.familyExists'));
      } else setError(t('sync.errOther'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: 'var(--sp-md)' }}>
      <strong>{resolved === 'create' ? t('sync.passTitleCreate') : t('sync.passTitleJoin')}</strong>
      <p className="muted" style={{ margin: 0 }}>{resolved === 'create' ? t('sync.passIntroCreate') : t('sync.passIntroJoin')}</p>
      <label className="field" title={t('sync.passHint')}>
        <span className="field-label">{t('sync.passLabel')}</span>
        <input className="input" type="password" autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} />
      </label>
      {resolved === 'create' && (
        <label className="field" title={t('sync.passHint')}>
          <span className="field-label">{t('sync.passConfirm')}</span>
          <input className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
      )}
      <small className="muted">{t('sync.passHint')}</small>
      <p className="error" role="alert">{error}</p>
      <button type="button" className="btn btn-primary btn-block" disabled={busy || !pass} onClick={() => void submit()}>
        {busy ? t('sync.checking') : t('sync.save')}
      </button>
    </div>
  );
}
