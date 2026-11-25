import { useTranslation } from 'react-i18next';

/** Placeholder for screens that are built in a later phase. */
export function ComingSoon({ phase }: { phase: number }) {
  const { t } = useTranslation();
  return <p className="muted">{t('app.comingSoon', { phase })}</p>;
}
