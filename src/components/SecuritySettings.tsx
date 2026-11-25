import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { Switch } from './Switch';
import { db } from '../db/schema';
import { getLocal, setLocal } from '../db/init';
import { isPasskeyAvailable, registerPasskey } from '../services/passkey';
import { useSession } from '../state/session';

/** Settings → Security: change PIN, turn Face ID / fingerprint on or off (this phone only). */
export function SecuritySettings() {
  const { t } = useTranslation();
  const { suppressAutoLock } = useSession();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void (async () => {
      setAvailable(await isPasskeyAvailable());
      setEnabled(Boolean(await getLocal<string | null>('biometricCredentialId')));
    })();
  }, []);

  const toggle = async (on: boolean) => {
    setFailed(false);
    if (!on) {
      await setLocal('biometricCredentialId', null);
      setEnabled(false);
      return;
    }
    const release = suppressAutoLock();
    try {
      const ownerId = await getLocal<string>('ownerParentId');
      const owner = ownerId ? await db.familyMembers.get(ownerId) : undefined;
      const id = await registerPasskey(t('app.name'), owner?.name ?? t('app.shortName'));
      await setLocal('biometricCredentialId', id);
      setEnabled(true);
    } catch {
      setFailed(true);
    } finally {
      release();
    }
  };

  return (
    <>
      <Link to="/settings/pin" className="row" style={{ color: 'inherit', textDecoration: 'none' }} title={t('settings.changePinHint')}>
        <span>{t('settings.changePin')}</span>
        <ChevronRight size={20} className="muted" />
      </Link>
      <div className="row" title={t('settings.biometricsHint')}>
        <span>{t('settings.biometrics')}</span>
        <Switch checked={enabled} disabled={available !== true} label={t('settings.biometrics')}
          hint={t('settings.biometricsHint')} onChange={(on) => void toggle(on)} />
      </div>
      {available === false && <small className="muted">{t('settings.biometricsUnsupported')}</small>}
      {failed && <p className="error">{t('settings.biometricsFailed')}</p>}
    </>
  );
}
