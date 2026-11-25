import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, CloudOff, RefreshCw } from 'lucide-react';
import { DropboxConnect } from './DropboxConnect';
import { PassphraseForm } from './PassphraseForm';
import { Switch } from './Switch';
import { disconnect } from '../services/dropbox';
import { resetSyncState } from '../services/sync';
import { currentLocale } from '../i18n';
import { formatDateTime } from '../i18n/format';
import { useSync } from '../state/sync';

/** Settings → Sync (Dropbox): connect, family passphrase, status, Sync now, auto-sync, disconnect. */
export function SyncSettings() {
  const { t } = useTranslation();
  const sync = useSync();
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  if (!sync.ready) return <p className="muted">{t('app.loading')}</p>;

  if (!sync.connected) {
    return <DropboxConnect onConnected={() => void sync.refresh()} />;
  }

  if (!sync.hasKey) {
    return (
      <div className="stack" style={{ gap: 'var(--sp-md)' }}>
        <span className="success"><CheckCircle2 size={16} /> {t('sync.connected')}</span>
        <PassphraseForm mode="auto" onDone={() => void sync.refresh().then(() => sync.syncNow({ quiet: false }))} />
      </div>
    );
  }

  const errorText = sync.error === 'offline' ? t('sync.errOffline')
    : sync.error === 'auth' ? t('sync.errAuth')
      : sync.error === 'badkey' || sync.error === 'nokey' ? t('sync.errKey')
        : sync.error ? t('sync.errOther') : '';

  const onDisconnect = async () => {
    if (!confirmDisconnect) return setConfirmDisconnect(true);
    await disconnect();
    await resetSyncState();
    setConfirmDisconnect(false);
    await sync.refresh();
  };

  const reconnect = async () => {
    await disconnect();
    await sync.refresh();
  };

  return (
    <>
      <div className="sync-status" title={t('sync.statusHint')}>
        <span className={sync.error ? 'level-text level-warning' : 'success'}>
          {sync.error ? <CloudOff size={16} /> : <CheckCircle2 size={16} />} {t('sync.connected')}
        </span>
        <small className="muted">
          {t('sync.lastSynced', { when: sync.lastSyncedAt ? formatDateTime(sync.lastSyncedAt, currentLocale()) : t('sync.never') })}
        </small>
      </div>
      {errorText && <p className="error" role="status" style={{ minHeight: 0 }}>{errorText}</p>}
      {sync.error === 'auth' && (
        <button type="button" className="btn btn-block" onClick={() => void reconnect()}>{t('sync.reconnect')}</button>
      )}
      <div className="row">
        <button type="button" className="btn btn-primary" style={{ flex: 1 }} disabled={sync.syncing}
          onClick={() => void sync.syncNow({ quiet: false })}>
          <RefreshCw size={18} className={sync.syncing ? 'spin' : ''} /> {sync.syncing ? t('sync.syncing') : t('sync.syncNow')}
        </button>
      </div>
      <div className="row" title={t('sync.autoSyncHint')}>
        <span>{t('sync.autoSync')}</span>
        <Switch checked={sync.autoSync} label={t('sync.autoSync')} hint={t('sync.autoSyncHint')}
          onChange={(on) => void sync.setAutoSync(on)} />
      </div>
      <button type="button" className="link-btn" style={{ color: 'var(--c-danger)', paddingLeft: 0 }}
        title={t('sync.disconnectHint')} onClick={() => void onDisconnect()}>
        {confirmDisconnect ? t('sync.disconnectConfirm') : t('sync.disconnect')}
      </button>
    </>
  );
}
