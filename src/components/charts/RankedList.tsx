import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { formatMoney } from '../../i18n/format';

export interface RankedRow {
  id: string;
  name: string;
  cents: number;
  share: number;
  color: string;
  subs?: { id: string; name: string; cents: number; share: number }[];
}

interface Props {
  rows: RankedRow[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  shareLabel: (pct: number) => string;
}

const pct = (share: number): number => Math.round(share * 1000) / 10;

/**
 * Ranked horizontal bars on one baseline (largest first), each with its name, amount and %:
 * the exact, comparable view beside the donut. Rows with subcategories expand on tap.
 */
export function RankedList({ rows, selectedId, onSelect, shareLabel }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const max = Math.max(1, ...rows.map((r) => r.cents));
  return (
    <ul className="ranked">
      {rows.map((r) => {
        const expandable = (r.subs?.length ?? 0) > 0;
        const isOpen = open === r.id;
        return (
          <li key={r.id} className={selectedId && selectedId !== r.id ? 'dim' : ''}>
            <button type="button" className="ranked-row" aria-expanded={expandable ? isOpen : undefined}
              title={shareLabel(pct(r.share))}
              onClick={() => { onSelect(selectedId === r.id ? null : r.id); if (expandable) setOpen(isOpen ? null : r.id); }}>
              <span className="ranked-head">
                <span className="swatch" style={{ background: r.color }} aria-hidden="true" />
                <span className="ranked-name">{r.name}</span>
                <span className="ranked-value">{formatMoney(r.cents)}</span>
                <span className="ranked-pct">{pct(r.share).toLocaleString('el-GR')}%</span>
                {expandable ? (isOpen ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />) : <span style={{ width: 16 }} />}
              </span>
              <span className="ranked-track" aria-hidden="true">
                <span style={{ width: `${(r.cents / max) * 100}%`, background: r.color }} />
              </span>
            </button>
            {isOpen && (
              <ul className="ranked-subs">
                {r.subs!.map((s) => (
                  <li key={s.id} title={shareLabel(pct(s.share))}>
                    <span className="ranked-name">{s.name}</span>
                    <span className="ranked-value">{formatMoney(s.cents)}</span>
                    <span className="ranked-pct">{pct(s.share).toLocaleString('el-GR')}%</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
