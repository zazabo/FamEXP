import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ChevronRight, FileDown, Share2 } from 'lucide-react';
import { BarChart } from '../components/charts/BarChart';
import { DonutChart } from '../components/charts/DonutChart';
import { RankedList, type RankedRow } from '../components/charts/RankedList';
import { isCurrentRange, loadSummary, periodRange, rangeTitle, shiftRange, type Period, type PeriodRange } from '../db/analytics';
import { budgetLevel } from '../db/budget';
import { currentLocale } from '../i18n';
import { formatMoney, toISODate } from '../i18n/format';
import { chartColor } from '../theme/tokens';
import { shareOrDownload } from '../services/share';
import { useSession } from '../state/session';
import { useToast } from '../state/toast';

const PERIODS: Period[] = ['week', 'month', 'year'];
const OTHERS_COLOR = 'var(--c-text-muted)';

/** Tab 2 — week / month / year analytics with trend, category and member breakdowns, PDF export. */
export function Analytics() {
  const { t } = useTranslation();
  const locale = currentLocale();
  const { suppressAutoLock } = useSession();
  const toast = useToast();
  const [params, setParams] = useSearchParams();

  const period: Period = PERIODS.includes(params.get('p') as Period) ? (params.get('p') as Period) : 'month';
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(params.get('d') ?? '') ? params.get('d')! : toISODate();
  const range = useMemo(() => periodRange(period, anchor), [period, anchor]);
  const go = (r: PeriodRange) => setParams({ p: r.period, d: r.start }, { replace: true });

  const summary = useLiveQuery(
    () => loadSummary(range, { household: t('members.household'), others: t('analytics.others') }, locale),
    [range.start, range.period, locale, t],
  );

  const [bar, setBar] = useState<number | null>(null);
  const [cat, setCat] = useState<string | null>(null);
  const [member, setMember] = useState<string | null>(null);
  const [pdf, setPdf] = useState<{ state: 'idle' | 'busy' | 'ready'; file?: File }>({ state: 'idle' });

  const title = rangeTitle(range, locale);
  const shareLabel = (pct: number) => t('analytics.shareOf', { pct: pct.toLocaleString('el-GR') });

  const exportPdf = async () => {
    if (!summary) return;
    setPdf({ state: 'busy' });
    const release = suppressAutoLock();
    try {
      const { buildReportPdf } = await import('../services/pdf');
      const blob = await buildReportPdf(summary, { t, locale, title });
      const file = new File([blob], `${t('pdf.fileName')}-${range.period === 'year' ? range.start.slice(0, 4) : range.period === 'month' ? range.start.slice(0, 7) : range.start}.pdf`, { type: 'application/pdf' });
      const outcome = await shareOrDownload(file, title);
      setPdf(outcome === 'needs-tap' ? { state: 'ready', file } : { state: 'idle' });
      if (outcome === 'downloaded') toast.show(t('analytics.pdfReady'), { durationMs: 2500 });
    } catch (err) {
      console.error(err);
      toast.show(t('analytics.pdfFailed'), { tone: 'danger' });
      setPdf({ state: 'idle' });
    } finally {
      window.setTimeout(release, 3000);
    }
  };

  const shareReady = async () => {
    if (!pdf.file) return;
    const release = suppressAutoLock();
    try {
      await shareOrDownload(pdf.file, title);
    } finally {
      window.setTimeout(release, 3000);
      setPdf({ state: 'idle' });
    }
  };

  const catRows: RankedRow[] = (summary?.byCategory ?? []).map((c) => ({
    id: c.id, name: c.name, cents: c.cents, share: c.share, color: chartColor(c.colorIndex), subs: c.subs,
  }));
  const memberRows: RankedRow[] = (summary?.byMember ?? []).map((m) => ({
    id: m.id, name: m.name, cents: m.cents, share: m.share,
    color: m.id === '__others__' ? OTHERS_COLOR : chartColor(m.colorIndex),
  }));
  const selectedBucket = bar !== null ? summary?.buckets[bar] : undefined;
  const level = summary ? budgetLevel(summary.totalCents, summary.budgetCents) : 'ok';
  const trendUnit = period === 'week' ? t('analytics.trendDay') : period === 'month' ? t('analytics.trendWeek') : t('analytics.trendMonth');

  return (
    <>
      <div className="segmented segmented-block" role="group" aria-label={t('analytics.period')} title={t('analytics.periodHint')}
        style={{ marginBottom: 'var(--sp-md)' }}>
        {PERIODS.map((p) => (
          <button key={p} type="button" aria-pressed={period === p} onClick={() => { setBar(null); go(periodRange(p, isCurrentRange(range) ? toISODate() : range.start)); }}>
            {t(`analytics.${p}`)}
          </button>
        ))}
      </div>

      <div className="row" style={{ marginBottom: 'var(--sp-md)' }}>
        <button className="icon-btn" onClick={() => { setBar(null); go(shiftRange(range, -1)); }}
          aria-label={t('analytics.previousHint')} title={t('analytics.previousHint')}><ChevronLeft /></button>
        <div style={{ textAlign: 'center' }}>
          <strong className="month-title">{title}</strong>
          {!isCurrentRange(range) && (
            <div><button type="button" className="link-btn" style={{ minHeight: 28 }} title={t('analytics.currentHint')}
              onClick={() => { setBar(null); go(periodRange(period, toISODate())); }}>{t('analytics.current')}</button></div>
          )}
        </div>
        <button className="icon-btn" onClick={() => { setBar(null); go(shiftRange(range, 1)); }}
          aria-label={t('analytics.nextHint')} title={t('analytics.nextHint')}><ChevronRight /></button>
      </div>

      {!summary ? (
        <p className="muted">{t('app.loading')}</p>
      ) : (
        <>
          <section className="card stat-grid">
            <div title={t('analytics.totalHint')}>
              <span className="muted stat-label">{t('analytics.total')}</span>
              <span className="stat-big">{formatMoney(summary.totalCents)}</span>
              <span className="muted stat-sub">{t('analytics.count', { count: summary.count })}</span>
            </div>
            <div title={t('analytics.dailyAvgHint')}>
              <span className="muted stat-label">{t('analytics.dailyAvg')}</span>
              <span className="stat-mid">{formatMoney(summary.dailyAvgCents)}</span>
            </div>
            <div className="stat-wide" title={t('analytics.budgetHint')}>
              <span className="muted stat-label">{t('analytics.budget')}</span>
              {period === 'week' ? (
                <span className="muted stat-sub">{t('analytics.noBudgetWeek')}</span>
              ) : summary.budgetCents ? (
                <div className={`level-${level}`}>
                  <span className="stat-mid">{formatMoney(summary.budgetCents)}</span>
                  <div className="progress" style={{ margin: 'var(--sp-xs) 0' }}>
                    <span style={{ width: `${Math.min(100, (summary.totalCents / summary.budgetCents) * 100)}%` }} />
                  </div>
                  <span className={`level-text level-${level} stat-sub`}>
                    {summary.totalCents > summary.budgetCents
                      ? t('dashboard.overBy', { amount: formatMoney(summary.totalCents - summary.budgetCents) })
                      : t('dashboard.remaining', { amount: formatMoney(summary.budgetCents - summary.totalCents) })}
                    {' · '}{t('pdf.used', { pct: Math.round((summary.totalCents / summary.budgetCents) * 100) })}
                  </span>
                </div>
              ) : (
                <span className="muted stat-sub">{t('analytics.noBudget')}</span>
              )}
            </div>
          </section>

          {summary.count === 0 ? (
            <p className="muted">{t('analytics.noData')}</p>
          ) : (
            <>
              <h2 className="section-title">{t('analytics.trend')} · {trendUnit}</h2>
              <section className="card">
                <p className="chart-tooltip" aria-live="polite">
                  {selectedBucket
                    ? <><strong>{selectedBucket.fullLabel}</strong> · {formatMoney(selectedBucket.cents)}{selectedBucket.budgetCents ? ` / ${formatMoney(selectedBucket.budgetCents)}` : ''}</>
                    : <span className="muted">{t('analytics.trendHint')}</span>}
                </p>
                <BarChart buckets={summary.buckets} selected={bar} onSelect={setBar} showBudget={period === 'year'}
                  ariaLabel={`${t('analytics.trend')} ${title}`} />
                {period === 'year' && summary.buckets.some((b) => b.budgetCents) && (
                  <small className="muted chart-legend"><span className="legend-dash" aria-hidden="true" /> {t('analytics.budgetLine')}</small>
                )}
              </section>

              <h2 className="section-title">{t('analytics.byCategory')}</h2>
              <section className="card" title={t('analytics.byCategoryHint')}>
                <DonutChart segments={catRows.map((r) => ({ id: r.id, label: `${r.name} · ${formatMoney(r.cents)}`, value: r.cents, color: r.color }))}
                  centerTop={formatMoney(summary.totalCents)} centerBottom={t('analytics.count', { count: summary.count })}
                  selectedId={cat} onSelect={setCat} ariaLabel={t('analytics.byCategory')} />
                <RankedList rows={catRows} selectedId={cat} onSelect={setCat} shareLabel={shareLabel} />
              </section>

              <h2 className="section-title">{t('analytics.byMember')}</h2>
              <section className="card" title={t('analytics.byMemberHint')}>
                <DonutChart segments={memberRows.map((r) => ({ id: r.id, label: `${r.name} · ${formatMoney(r.cents)}`, value: r.cents, color: r.color }))}
                  centerTop={formatMoney(summary.totalCents)} centerBottom={t('analytics.count', { count: summary.count })}
                  selectedId={member} onSelect={setMember} ariaLabel={t('analytics.byMember')} />
                <RankedList rows={memberRows} selectedId={member} onSelect={setMember} shareLabel={shareLabel} />
              </section>
            </>
          )}

          {pdf.state === 'ready' ? (
            <button type="button" className="btn btn-primary btn-block" onClick={() => void shareReady()}>
              <Share2 size={18} /> {t('analytics.sharePdf')}
            </button>
          ) : (
            <button type="button" className="btn btn-primary btn-block" disabled={pdf.state === 'busy' || summary.count === 0}
              onClick={() => void exportPdf()} title={t('analytics.exportHint')}>
              <FileDown size={18} /> {pdf.state === 'busy' ? t('analytics.generating') : t('analytics.exportPdf')}
            </button>
          )}
        </>
      )}
    </>
  );
}
