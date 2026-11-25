export interface DonutSegment {
  id: string;
  label: string;
  value: number;
  color: string;
}

interface Props {
  segments: DonutSegment[];
  centerTop: string;
  centerBottom: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  ariaLabel: string;
}

const C = 60;
const R_OUT = 56;
const R_IN = 38;
const GAP = 0.025; // radians of surface between segments

function arc(a0: number, a1: number): string {
  const p = (r: number, a: number) => `${C + r * Math.sin(a)},${C - r * Math.cos(a)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${p(R_OUT, a0)} A${R_OUT},${R_OUT} 0 ${large} 1 ${p(R_OUT, a1)} L${p(R_IN, a1)} A${R_IN},${R_IN} 0 ${large} 0 ${p(R_IN, a0)} Z`;
}

/** Part-to-whole at a glance (the ranked list next to it carries exact values and comparison). */
export function DonutChart({ segments, centerTop, centerBottom, selectedId, onSelect, ariaLabel }: Props) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  let angle = 0;
  return (
    <svg viewBox="0 0 120 120" className="donut" role="img" aria-label={ariaLabel}>
      {total > 0 && segments.length === 1 ? (
        <circle cx={C} cy={C} r={(R_OUT + R_IN) / 2} fill="none" stroke={segments[0]!.color} strokeWidth={R_OUT - R_IN}
          onClick={() => onSelect(selectedId ? null : segments[0]!.id)}>
          <title>{segments[0]!.label}</title>
        </circle>
      ) : (
        segments.map((s) => {
          const span = (s.value / total) * Math.PI * 2;
          const a0 = angle + (span > GAP * 2 ? GAP / 2 : 0);
          const a1 = angle + span - (span > GAP * 2 ? GAP / 2 : 0);
          angle += span;
          if (span <= 0) return null;
          return (
            <path key={s.id} d={arc(a0, a1)} fill={s.color} opacity={selectedId && selectedId !== s.id ? 0.35 : 1}
              onClick={() => onSelect(selectedId === s.id ? null : s.id)} style={{ cursor: 'pointer' }}>
              <title>{s.label}</title>
            </path>
          );
        })
      )}
      <text x={C} y={C - 2} textAnchor="middle" className="donut-top">{centerTop}</text>
      <text x={C} y={C + 13} textAnchor="middle" className="donut-bottom">{centerBottom}</text>
    </svg>
  );
}
