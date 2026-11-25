import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { getDeviceId } from '../db/init';
import { LOCALES, currentLocale, setLocale } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';
import { SecuritySettings } from '../components/SecuritySettings';
import { FamilySettings } from '../components/FamilySettings';
import { SyncSettings } from '../components/SyncSettings';
import { ExportSettings } from '../components/ExportSettings';
import type { ThemeMode } from '../types';

const THEME_MODES: { mode: ThemeMode; key: string }[] = [
  { mode: 'system', key: 'settings.themeSystem' },
  { mode: 'light', key: 'settings.themeLight' },
  { mode: 'dark', key: 'settings.themeDark' },
];

/** Tab 3 — appearance, family & budget, security, Dropbox sync, Excel export, about. */
export function Settings() {
  const { t } = useTranslation();
  const { mode, setMode } = useTheme();
  const locale = currentLocale();
  const categoryCount = useLiveQuery(() => db.categories.count(), []);

  return (
    <>
      <h1 className="screen-title">{t('tabs.settings')}</h1>

      <h2 className="section-title">{t('settings.appearance')}</h2>
      <section className="card">
        <div className="row" title={t('settings.languageHint')}>
          <span>{t('settings.language')}</span>
          <div className="segmented" role="group" aria-label={t('settings.language')}>
            {LOCALES.map((l) => (
              <button key={l} aria-pressed={locale === l} onClick={() => setLocale(l)}>
                {t(`languages.${l}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="row" title={t('settings.themeHint')}>
          <span>{t('settings.theme')}</span>
          <div className="segmented" role="group" aria-label={t('settings.theme')}>
            {THEME_MODES.map(({ mode: m, key }) => (
              <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)}>
                {t(key)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <h2 className="section-title">{t('settings.family')}</h2>
      <section className="card"><FamilySettings /></section>

      <h2 className="section-title">{t('settings.security')}</h2>
      <section className="card"><SecuritySettings /></section>

      <h2 className="section-title">{t('settings.sync')}</h2>
      <section className="card"><SyncSettings /></section>

      <h2 className="section-title">{t('settings.export')}</h2>
      <section className="card"><ExportSettings /></section>

      <h2 className="section-title">{t('settings.about')}</h2>
      <section className="card">
        <div className="row" title={t('settings.versionHint')}>
          <span>{t('settings.version')}</span>
          <span className="mono">v{__APP_VERSION__}</span>
        </div>
        <div className="row" title={t('settings.categoriesCountHint')}>
          <span>{t('settings.categoriesCount')}</span>
          <span className="mono">{categoryCount ?? '…'}</span>
        </div>
        <div className="row" title={t('settings.deviceIdHint')}>
          <span>{t('settings.deviceId')}</span>
          <span className="mono muted">{getDeviceId().slice(0, 8)}</span>
        </div>
      </section>
    </>
  );
}
