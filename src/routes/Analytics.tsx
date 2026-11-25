import { useTranslation } from 'react-i18next';
import { ComingSoon } from '../components/ComingSoon';

/** Tab 2 — skeleton (Phase 1). Charts and PDF reports arrive in Phase 5. */
export function Analytics() {
  const { t } = useTranslation();
  return (
    <>
      <h1 className="screen-title">{t('tabs.analytics')}</h1>
      <ComingSoon phase={5} />
    </>
  );
}
