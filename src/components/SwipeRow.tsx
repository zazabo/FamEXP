import { useRef, useState, type ReactNode, type PointerEvent, type KeyboardEvent } from 'react';
import { Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
  onTap: () => void;
  onDelete: () => void;
  label: string;
  hint: string;
  deleteLabel: string;
}

const THRESHOLD = 90;

/** List row: swipe left to delete, tap to open. Keyboard: Enter opens, Delete removes. */
export function SwipeRow({ children, onTap, onDelete, label, hint, deleteLabel }: Props) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);

  const down = (e: PointerEvent<HTMLDivElement>) => {
    start.current = { x: e.clientX, y: e.clientY };
    moved.current = false;
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const ddx = e.clientX - start.current.x;
    const ddy = e.clientY - start.current.y;
    if (!dragging) {
      if (Math.abs(ddx) > 10 && Math.abs(ddx) > Math.abs(ddy)) {
        setDragging(true);
        moved.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
      } else if (Math.abs(ddy) > 10) {
        start.current = null; // vertical scroll — let it be
        return;
      }
    }
    if (dragging || moved.current) setDx(Math.min(0, ddx));
  };
  const up = () => {
    if (dragging) {
      if (dx < -THRESHOLD) {
        setDx(-window.innerWidth);
        window.setTimeout(onDelete, 180);
      } else {
        setDx(0);
      }
    }
    setDragging(false);
    start.current = null;
  };
  const click = () => {
    if (moved.current) {
      moved.current = false;
      return;
    }
    onTap();
  };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onTap();
    } else if (e.key === 'Delete') onDelete();
  };

  return (
    <div className="swipe">
      <div className="swipe-bg" aria-hidden="true" style={{ opacity: Math.min(1, -dx / THRESHOLD) }}>
        <Trash2 size={20} /> <span>{deleteLabel}</span>
      </div>
      <div className={`swipe-content${dragging ? ' dragging' : ''}`} style={{ transform: `translateX(${dx}px)` }}
        role="button" tabIndex={0} aria-label={label} title={hint}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClick={click} onKeyDown={key}>
        {children}
      </div>
    </div>
  );
}
