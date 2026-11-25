import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

export type ToastTone = 'info' | 'warning' | 'danger';

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  actionLabel?: string | undefined;
  onAction?: (() => void) | undefined;
}

interface ToastOptions {
  tone?: ToastTone;
  durationMs?: number;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastValue {
  show: (message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastValue | null>(null);

/** One non-intrusive message at a time, above the tab bar (undo, budget alerts). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const seq = useRef(0);

  const dismiss = useCallback(() => {
    window.clearTimeout(timer.current);
    setToast(null);
  }, []);

  const show = useCallback((message: string, o: ToastOptions = {}) => {
    window.clearTimeout(timer.current);
    seq.current += 1;
    setToast({ id: seq.current, message, tone: o.tone ?? 'info', actionLabel: o.actionLabel, onAction: o.onAction });
    timer.current = window.setTimeout(() => setToast(null), o.durationMs ?? 5000);
  }, []);

  const value = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <div key={toast.id} className={`toast toast-${toast.tone}`} role="status" aria-live="polite">
          <span>{toast.message}</span>
          {toast.actionLabel && (
            <button type="button" className="toast-action" onClick={() => { toast.onAction?.(); dismiss(); }}>
              {toast.actionLabel}
            </button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
