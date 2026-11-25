import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import { finishAuth, hasPendingAuth, startAuth } from '../services/dropbox';
import { useSession } from '../state/session';

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
  const [error, setError] = useState(false);

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
    setError(false);
  };

  const connect = async () => {
    setBusy(true);
    setError(false);
    try {
      await finishAuth(code);
      onConnected();
    } catch {
      setError(true);
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
          <p className="error">{error ? t('sync.codeRejected') : ''}</p>
          <button type="button" className="btn btn-primary btn-block" disabled={busy || code.trim().length < 10}
            onClick={() => void connect()}>
            {busy ? t('sync.connecting') : t('sync.connect')}
          </button>
        </>
      )}
    </div>
  );
}
