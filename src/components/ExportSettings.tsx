import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileSpreadsheet, Share2 } from 'lucide-react';
import { currentLocale } from '../i18n';
import { shareOrDownload } from '../services/share';
import { useSession } from '../state/session';
import { useToast } from '../state/toast';

type Scope = number | 'all';

/** Settings → Export: one-tap Excel workbook (a year or everything), handed to the share sheet. */
export function ExportSettings() {
  const { t } = useTranslation();
  const { suppressAutoLock } = useSession();
  const toast = useToast();
  const [years, setYears] = useState<number[] | null>(null);
  const [scope, setScope] = useState<Scope>(new Date().getFullYear());
  const [state, setState] = useState<{ busy: boolean; file?: File }>({ busy: false });

  useEffect(() => {
    void import('../services/excel').then(async ({ exportYears }) => {
      const ys = await exportYears();
      setYears(ys);
      if (ys.length && !ys.includes(scope as number)) setScope(ys[0]!);
    });
  }, []);

  const run = async () => {
    setState({ busy: true });
    const release = suppressAutoLock();
    try {
      const { buildWorkbook } = await import('../services/excel');
      const blob = await buildWorkbook(scope, { t, locale: currentLocale() });
      const file = new File([blob], `${t('pdf.fileName')}-${scope === 'all' ? t('excel.fileAll') : scope}.xlsx`, {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const outcome = await shareOrDownload(file, file.name);
      setState(outcome === 'needs-tap' ? { busy: false, file } : { busy: false });
      if (outcome === 'downloaded') toast.show(t('excel.ready'), { durationMs: 2500 });
    } catch (err) {
      console.error(err);
      toast.show(t('excel.failed'), { tone: 'danger' });
      setState({ busy: false });
    } finally {
      window.setTimeout(release, 3000);
    }
  };

  const shareReady = async () => {
    if (!state.file) return;
    const release = suppressAutoLock();
    try {
      await shareOrDownload(state.file, state.file.name);
    } finally {
      window.setTimeout(release, 3000);
      setState({ busy: false });
    }
  };

  if (years && years.length === 0) return <p className="muted" style={{ margin: 0 }}>{t('excel.noData')}</p>;

  return (
    <div className="stack" style={{ gap: 'var(--sp-md)' }}>
      <label className="field" title={t('excel.scopeHint')}>
        <span className="field-label">{t('excel.scope')}</span>
        <select className="select" value={String(scope)} onChange={(e) => setScope(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
          {(years ?? [scope as number]).map((y) => <option key={y} value={y}>{y}</option>)}
          <option value="all">{t('excel.all')}</option>
        </select>
      </label>
      {state.file ? (
        <button type="button" className="btn btn-primary btn-block" onClick={() => void shareReady()}>
          <Share2 size={18} /> {t('excel.share')}
        </button>
      ) : (
        <button type="button" className="btn btn-primary btn-block" disabled={state.busy || !years} onClick={() => void run()} title={t('excel.hint')}>
          <FileSpreadsheet size={18} /> {state.busy ? t('excel.generating') : t('settings.exportXlsx')}
        </button>
      )}
      <small className="muted">{t('excel.hint')}</small>
    </div>
  );
}
