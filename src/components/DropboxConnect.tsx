import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import { authFailureOf, cleanAuthCode, finishAuth, hasPendingAuth, startAuth, type AuthFailure } from '../services/dropbox';
import { useSession } from '../state/session';

const ERROR_KEYS: Record<AuthFailure, string> = {
  expired: 'sync.codeExpired',
  otherDevice: 'sync.codeOtherDevice',
  appNotAllowed: 'sync.appNotAllowed',
  offline: 'sync.errOffline',
  other: 'sync.codeRejected',
};

/**
 * Connect Dropbox without redirects: open the authorization page, the parent taps Allow,
 * copies the code Dropbox shows, and pastes it here. Survives the app being closed in between.
 */
export function DropboxConnect({ onConnected }: { onConnected: () => void }) {
  const { t } = useTranslation();
  const { suppressAutoLock } = useSession();
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ kind: AuthFailure; detail: string } | null>(null);

  useEffect(() => {
    void (async () => {
      if (await hasPendingAuth()) setOpened(true);
      setAuthUrl(await startAuth()); // a plain link is the most reliable way to leave an iOS home-screen app
    })();
  }, []);

  const onOpen = () => {
    // Switching to Safari/Chrome to copy the code should not lock the app.
    const release = suppressAutoLock();
    window.setTimeout(release, 5 * 60_000);
    setOpened(true);
    setError(null);
  };

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      await finishAuth(code);
      onConnected();
    } catch (err) {
      setError({ kind: authFailureOf(err), detail: err instanceof Error ? err.message : '' });
      setCode('');
      setAuthUrl(await startAuth()); // fresh link + verifier for the next attempt
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: 'var(--sp-md)' }}>
      <p className="muted" style={{ margin: 0 }}>{t('sync.intro')}</p>
      <ol className="steps">
        <li>{t('sync.step1')}</li>
        <li>{t('sync.step2')}</li>
        <li>{t('sync.step3')}</li>
      </ol>
      <a className="btn btn-block" href={authUrl ?? undefined} target="_blank" rel="noopener noreferrer"
        aria-disabled={!authUrl} onClick={onOpen} title={t('sync.openDropboxHint')}
        style={{ color: 'inherit', textDecoration: 'none' }}>
        <ExternalLink size={18} /> {t('sync.openDropbox')}
      </a>
      {opened && (
        <>
          <label className="field" title={t('sync.codeHint')}>
            <span className="field-label">{t('sync.codeLabel')}</span>
            <input className="input mono" autoComplete="off" autoCapitalize="off" spellCheck={false} value={code}
              placeholder={t('sync.codePlaceholder')} onChange={(e) => setCode(e.target.value)} />
          </label>
          <div role="alert">
            <p className="error" style={{ minHeight: 0 }}>{error ? t(ERROR_KEYS[error.kind]) : ''}</p>
            {error?.detail && error.kind !== 'offline' && (
              <small className="muted mono" style={{ wordBreak: 'break-word' }}>{t('sync.dropboxSaid', { detail: error.detail })}</small>
            )}
          </div>
          <button type="button" className="btn btn-primary btn-block" disabled={busy || cleanAuthCode(code).length < 10}
            onClick={() => void connect()}>
            {busy ? t('sync.connecting') : t('sync.connect')}
          </button>
        </>
      )}
    </div>
  );
}
