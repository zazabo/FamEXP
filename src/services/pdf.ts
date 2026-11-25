import { jsPDF } from 'jspdf';
import type { TFunction } from 'i18next';
import type { PeriodSummary } from '../db/analytics';
import { OTHERS_ID } from '../db/analytics';
import { budgetLevel } from '../db/budget';
import { formatDateTime, formatMoney } from '../i18n/format';
import { chartPalette, colors } from '../theme/tokens';
import type { Locale } from '../types';

/**
 * Printable A4 PDF report for a week / month / year, generated on the phone (loaded only
 * when the parent taps Export). Always light, print-friendly styling, whatever the app theme.
 * Charts are drawn as vectors (crisp at any zoom); text uses an embedded Greek subset of
 * DejaVu Sans so Greek prints correctly everywhere.
 */

interface Options {
  t: TFunction;
  locale: Locale;
  /** Period title as shown in the app, e.g. "Νοέμβριος 2026". */
  title: string;
}

const C = colors.light;
const PALETTE = chartPalette.light;
const OTHERS = '#8A8984';
const PAGE_W = 210;
const PAGE_H = 297;
const M = 16;
const CW = PAGE_W - 2 * M;
const FOOTER = 12;

let fontCache: { regular: string; bold: string } | null = null;

async function toBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Font ${url}: ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function loadFonts(): Promise<{ regular: string; bold: string }> {
  if (!fontCache) {
    const base = import.meta.env.BASE_URL;
    const [regular, bold] = await Promise.all([
      toBase64(`${base}fonts/DejaVuSans-greek.ttf`),
      toBase64(`${base}fonts/DejaVuSans-Bold-greek.ttf`),
    ]);
    fontCache = { regular, bold };
  }
  return fontCache;
}

const rgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

export async function buildReportPdf(summary: PeriodSummary, { t, locale, title }: Options): Promise<Blob> {
  const fonts = await loadFonts();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.addFileToVFS('DejaVuSans-greek.ttf', fonts.regular);
  doc.addFont('DejaVuSans-greek.ttf', 'DejaVu', 'normal');
  doc.addFileToVFS('DejaVuSans-Bold-greek.ttf', fonts.bold);
  doc.addFont('DejaVuSans-Bold-greek.ttf', 'DejaVu', 'bold');
  doc.setProperties({ title: `${t('app.name')} — ${title}`, creator: t('app.name') });

  const reportType = t(summary.range.period === 'week' ? 'pdf.reportWeek' : summary.range.period === 'month' ? 'pdf.reportMonth' : 'pdf.reportYear');
  let y = M;

  // ---- drawing helpers
  const font = (size: number, weight: 'normal' | 'bold' = 'normal', color: string = C.text) => {
    doc.setFont('DejaVu', weight);
    doc.setFontSize(size);
    doc.setTextColor(...rgb(color));
  };
  const fill = (hex: string) => doc.setFillColor(...rgb(hex));
  const stroke = (hex: string, w = 0.2) => {
    doc.setDrawColor(...rgb(hex));
    doc.setLineWidth(w);
  };
  const fit = (text: string, maxW: number): string => {
    if (doc.getTextWidth(text) <= maxW) return text;
    let s = text;
    while (s.length > 1 && doc.getTextWidth(`${s}…`) > maxW) s = s.slice(0, -1);
    return `${s}…`;
  };
  const ensure = (h: number) => {
    if (y + h > PAGE_H - M - FOOTER) {
      doc.addPage();
      y = M;
    }
  };
  const sectionTitle = (text: string) => {
    ensure(14);
    y += 4;
    font(11, 'bold');
    doc.text(text, M, y);
    y += 2.5;
    stroke(C.border);
    doc.line(M, y, M + CW, y);
    y += 5;
  };
  const pct = (share: number) => `${(Math.round(share * 1000) / 10).toLocaleString('el-GR')}%`;

  // ---- header
  font(16, 'bold');
  doc.text(t('app.name'), M, y + 5);
  font(8, 'normal', C.textMuted);
  doc.text(t('pdf.generated', { when: formatDateTime(Date.now(), locale) }), M + CW, y + 5, { align: 'right' });
  y += 12;
  font(12, 'normal', C.textMuted);
  doc.text(`${reportType} · ${title}`, M, y);
  y += 4;

  // ---- summary boxes
  sectionTitle(t('pdf.summary'));
  const boxes: { label: string; value: string; sub?: string }[] = [
    { label: t('analytics.total'), value: formatMoney(summary.totalCents), sub: t('analytics.count', { count: summary.count }) },
    { label: t('analytics.dailyAvg'), value: formatMoney(summary.dailyAvgCents) },
    {
      label: t('analytics.budget'),
      value: summary.budgetCents ? formatMoney(summary.budgetCents) : '—',
      sub: summary.budgetCents
        ? t('pdf.used', { pct: Math.round((summary.totalCents / summary.budgetCents) * 100) })
        : summary.range.period === 'week' ? t('analytics.noBudgetWeek') : t('analytics.noBudget'),
    },
  ];
  const gap = 4;
  const bw = (CW - gap * (boxes.length - 1)) / boxes.length;
  boxes.forEach((b, i) => {
    const x = M + i * (bw + gap);
    stroke(C.border);
    doc.roundedRect(x, y, bw, 22, 2, 2, 'S');
    font(8, 'normal', C.textMuted);
    doc.text(b.label, x + 3, y + 5);
    font(13, 'bold');
    doc.text(fit(b.value, bw - 6), x + 3, y + 12.5);
    if (b.sub) {
      font(7.5, 'normal', C.textMuted);
      doc.text(fit(b.sub, bw - 6), x + 3, y + 18);
    }
  });
  y += 27;

  // ---- budget vs actual bar
  if (summary.budgetCents) {
    const level = budgetLevel(summary.totalCents, summary.budgetCents);
    const color = level === 'over' ? C.danger : level === 'warning' ? C.warning : C.success;
    font(9, 'bold');
    doc.text(t('pdf.budgetVsActual'), M, y + 3);
    y += 5.5;
    fill(C.surfaceAlt);
    doc.roundedRect(M, y, CW, 3.5, 1.75, 1.75, 'F');
    fill(color);
    const w = Math.max(3.5, Math.min(1, summary.totalCents / summary.budgetCents) * CW);
    doc.roundedRect(M, y, w, 3.5, 1.75, 1.75, 'F');
    y += 8;
    font(8.5, 'normal', color);
    const diff = summary.totalCents - summary.budgetCents;
    doc.text(diff > 0 ? t('dashboard.overBy', { amount: formatMoney(diff) }) : t('dashboard.remaining', { amount: formatMoney(-diff) }), M, y);
    font(8.5, 'normal', C.textMuted);
    doc.text(`${formatMoney(summary.totalCents)} / ${formatMoney(summary.budgetCents)}`, M + CW, y, { align: 'right' });
    y += 4;
  }

  // ---- trend bar chart
  sectionTitle(`${t('pdf.trend')} · ${t(summary.range.period === 'week' ? 'analytics.trendDay' : summary.range.period === 'month' ? 'analytics.trendWeek' : 'analytics.trendMonth')}`);
  ensure(66);
  {
    const axisW = 18;
    const h = 52;
    const x0 = M + axisW;
    const w = CW - axisW;
    const showBudget = summary.range.period === 'year';
    const maxVal = Math.max(1, ...summary.buckets.map((b) => Math.max(b.cents, showBudget ? (b.budgetCents ?? 0) : 0)));
    const exp = Math.pow(10, Math.floor(Math.log10(maxVal)));
    const top = [1, 2, 2.5, 5, 10].map((m) => m * exp).find((v) => v >= maxVal) ?? 10 * exp;
    const yOf = (v: number) => y + h - (v / top) * h;
    font(6.5, 'normal', C.textMuted);
    for (const v of [0, top / 2, top]) {
      stroke(v === 0 ? C.textMuted : C.border, v === 0 ? 0.3 : 0.15);
      doc.line(x0, yOf(v), x0 + w, yOf(v));
      doc.text(`${Math.round(v / 100).toLocaleString('el-GR')} €`, x0 - 2, yOf(v) + 1.2, { align: 'right' });
    }
    const slot = w / summary.buckets.length;
    const barW = Math.min(12, slot * 0.62);
    summary.buckets.forEach((b, i) => {
      const cx = x0 + slot * i + slot / 2;
      if (b.cents > 0) {
        const bh = Math.max(0.6, (b.cents / top) * h);
        fill(C.primary);
        const r = Math.min(1.2, barW / 2, bh);
        doc.roundedRect(cx - barW / 2, y + h - bh, barW, bh, r, r, 'F');
        doc.rect(cx - barW / 2, y + h - Math.min(bh, r), barW, Math.min(bh, r), 'F'); // square base
        font(6, 'normal', C.text);
        doc.text(Math.round(b.cents / 100).toLocaleString('el-GR'), cx, y + h - bh - 1.2, { align: 'center' });
      }
      if (showBudget && b.budgetCents) {
        stroke(C.textMuted, 0.4);
        doc.setLineDashPattern([1.2, 0.8], 0);
        doc.line(cx - slot * 0.42, yOf(b.budgetCents), cx + slot * 0.42, yOf(b.budgetCents));
        doc.setLineDashPattern([], 0);
      }
      font(6.5, 'normal', C.textMuted);
      doc.text(fit(b.label, slot - 0.5), cx, y + h + 4, { align: 'center' });
    });
    y += h + 7;
    if (showBudget && summary.buckets.some((b) => b.budgetCents)) {
      stroke(C.textMuted, 0.4);
      doc.setLineDashPattern([1.2, 0.8], 0);
      doc.line(M, y, M + 6, y);
      doc.setLineDashPattern([], 0);
      font(7, 'normal', C.textMuted);
      doc.text(t('analytics.budgetLine'), M + 8, y + 1);
      y += 4;
    }
  }

  // ---- donut + legend table
  const donutTable = (rows: { name: string; cents: number; share: number; color: string }[], headName: string) => {
    const r = 21;
    const rin = 13;
    const tableX = M + 2 * r + 12;
    const tableW = M + CW - tableX;
    const rowH = 6;
    ensure(Math.max(2 * r + 6, (rows.length + 1) * rowH + 4));
    const cx = M + r + 2;
    const cy = y + r + 1;
    const total = rows.reduce((s, x) => s + x.cents, 0);
    let a = -Math.PI / 2;
    for (const row of rows) {
      const span = total > 0 ? (row.cents / total) * Math.PI * 2 : 0;
      if (span <= 0) continue;
      const g = rows.length > 1 && span > 0.06 ? 0.02 : 0;
      const a0 = a + g / 2;
      const a1 = a + span - g / 2;
      const steps = Math.max(2, Math.ceil((a1 - a0) / 0.05));
      const pts: [number, number][] = [];
      for (let k = 0; k <= steps; k++) {
        const ang = a0 + ((a1 - a0) * k) / steps;
        pts.push([cx + r * Math.cos(ang), cy + r * Math.sin(ang)]);
      }
      for (let k = steps; k >= 0; k--) {
        const ang = a0 + ((a1 - a0) * k) / steps;
        pts.push([cx + rin * Math.cos(ang), cy + rin * Math.sin(ang)]);
      }
      const deltas = pts.slice(1).map((p, k) => [p[0] - pts[k]![0], p[1] - pts[k]![1]]);
      fill(row.color);
      doc.lines(deltas, pts[0]![0], pts[0]![1], [1, 1], 'F', true);
      a += span;
    }
    font(8.5, 'bold');
    doc.text(formatMoney(total), cx, cy + 1, { align: 'center' });

    // legend table
    let ty = y + 3;
    font(7.5, 'bold', C.textMuted);
    doc.text(headName, tableX + 5, ty);
    doc.text(t('pdf.amount'), tableX + tableW - 16, ty, { align: 'right' });
    doc.text(t('pdf.share'), tableX + tableW, ty, { align: 'right' });
    ty += 2;
    stroke(C.border);
    doc.line(tableX, ty, tableX + tableW, ty);
    ty += 4.2;
    for (const row of rows) {
      fill(row.color);
      doc.roundedRect(tableX, ty - 2.6, 3, 3, 0.6, 0.6, 'F');
      font(8.5, 'normal');
      doc.text(fit(row.name, tableW - 44), tableX + 5, ty);
      font(8.5, 'bold');
      doc.text(formatMoney(row.cents), tableX + tableW - 16, ty, { align: 'right' });
      font(8, 'normal', C.textMuted);
      doc.text(pct(row.share), tableX + tableW, ty, { align: 'right' });
      ty += rowH;
    }
    y = Math.max(cy + r + 4, ty);
  };

  // ---- by category
  sectionTitle(t('pdf.byCategory'));
  donutTable(summary.byCategory.map((c) => ({ name: c.name, cents: c.cents, share: c.share, color: PALETTE[c.colorIndex % PALETTE.length]! })), t('pdf.category'));

  // subcategory detail
  ensure(12);
  y += 2;
  font(7.5, 'bold', C.textMuted);
  doc.text(`${t('pdf.category')} / ${t('pdf.subcategory')}`, M, y);
  doc.text(t('pdf.amount'), M + CW - 18, y, { align: 'right' });
  doc.text(t('pdf.share'), M + CW, y, { align: 'right' });
  y += 2;
  stroke(C.border);
  doc.line(M, y, M + CW, y);
  y += 4.5;
  for (const c of summary.byCategory) {
    ensure(6);
    font(8.5, 'bold');
    doc.text(fit(c.name, CW - 50), M, y);
    doc.text(formatMoney(c.cents), M + CW - 18, y, { align: 'right' });
    font(8, 'normal', C.textMuted);
    doc.text(pct(c.share), M + CW, y, { align: 'right' });
    y += 5;
    for (const s of c.subs) {
      ensure(5);
      font(8, 'normal', C.textMuted);
      doc.text(fit(s.name, CW - 56), M + 5, y);
      doc.text(formatMoney(s.cents), M + CW - 18, y, { align: 'right' });
      doc.text(pct(s.share), M + CW, y, { align: 'right' });
      y += 4.6;
    }
    y += 1;
  }

  // ---- by family member (per-child summary)
  sectionTitle(t('pdf.byMember'));
  donutTable(summary.byMember.map((m) => ({
    name: m.name, cents: m.cents, share: m.share, color: m.id === OTHERS_ID ? OTHERS : PALETTE[m.colorIndex % PALETTE.length]!,
  })), t('pdf.member'));

  // ---- footer on every page
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    stroke(C.border);
    doc.line(M, PAGE_H - M - 4, M + CW, PAGE_H - M - 4);
    font(7.5, 'normal', C.textMuted);
    doc.text(`${t('app.name')} · ${title}`, M, PAGE_H - M);
    doc.text(t('pdf.page', { n: p, total: pages }), M + CW, PAGE_H - M, { align: 'right' });
  }

  return doc.output('blob');
}
