import type { Bucket } from '../../db/analytics';
import { axisMoney, niceMax } from './scale';

interface Props {
  buckets: Bucket[];
  selected: number | null;
  onSelect: (index: number | null) => void;
  ariaLabel: string;
  /** Year view: show each month's budget as a dashed tick. */
  showBudget: boolean;
}

const W = 340;
const H = 190;
const PAD = { top: 12, right: 6, bottom: 24, left: 46 };

/**
 * Single-series trend bars (theme primary), 4px rounded data-ends on a shared baseline,
 * recessive gridlines, hover/tap target = the whole column. Values live in the tooltip row
 * above the chart and in the tables below — no number on every bar.
 */
export function BarChart({ buckets, selected, onSelect, ariaLabel, showBudget }: Props) {
  const maxVal = Math.max(1, ...buckets.map((b) => Math.max(b.cents, showBudget ? (b.budgetCents ?? 0) : 0)));
  const top = niceMax(maxVal);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / buckets.length;
  const barW = Math.max(4, Math.min(28, slot * 0.62));
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const ticks = [0, top / 2, top];
  const thin = buckets.length > 8; // year view: every other month label if narrow

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={ariaLabel}
      onPointerLeave={(e) => e.pointerType === 'mouse' && onSelect(null)}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className={v === 0 ? 'chart-axis' : 'chart-grid'} />
          <text x={PAD.left - 6} y={y(v) + 3.5} textAnchor="end" className="chart-tick">{axisMoney(v)}</text>
        </g>
      ))}
      {buckets.map((b, i) => {
        const cx = PAD.left + slot * i + slot / 2;
        const h = b.cents > 0 ? Math.max(2, (b.cents / top) * plotH) : 0;
        const x = cx - barW / 2;
        const yTop = PAD.top + plotH - h;
        const r = Math.min(4, barW / 2, h);
        const dim = selected !== null && selected !== i;
        return (
          <g key={b.key}>
            {h > 0 && (
              <path className="chart-bar" opacity={dim ? 0.4 : 1}
                d={`M${x},${PAD.top + plotH} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + barW - r} Q${x + barW},${yTop} ${x + barW},${yTop + r} V${PAD.top + plotH} Z`} />
            )}
            {showBudget && b.budgetCents ? (
              <line className="chart-budget" x1={cx - slot * 0.42} x2={cx + slot * 0.42} y1={y(b.budgetCents)} y2={y(b.budgetCents)} />
            ) : null}
            {(!thin || i % 2 === 0 || selected === i) && (
              <text x={cx} y={H - 8} textAnchor="middle" className={`chart-tick${selected === i ? ' chart-tick-on' : ''}`}>{b.label}</text>
            )}
            <rect x={PAD.left + slot * i} y={PAD.top} width={slot} height={plotH + PAD.bottom} fill="transparent"
              onPointerEnter={(e) => e.pointerType === 'mouse' && onSelect(i)}
              onClick={() => onSelect(selected === i ? null : i)}>
              <title>{b.fullLabel}</title>
            </rect>
          </g>
        );
      })}
    </svg>
  );
}
