import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { getLocal, setLocal } from '../db/init';
import { isConnected } from '../services/dropbox';
import { hasFamilyKey, SyncError, syncNow as runSync, type SyncErrorKind } from '../services/sync';
import { onLocalChange } from '../services/syncBus';
import { useSession } from './session';
import { useBudgetAlerts } from './useBudgetAlerts';
import { useToast } from './toast';

export interface SyncState {
  /** Dropbox tokens present on this phone. */
  connected: boolean;
  /** Family key present on this phone. */
  hasKey: boolean;
  autoSync: boolean;
  syncing: boolean;
  error: SyncErrorKind | null;
  lastSyncedAt: number | null;
}

interface SyncValue extends SyncState {
  ready: boolean;
  syncNow: (opts?: { quiet?: boolean }) => Promise<void>;
  setAutoSync: (on: boolean) => Promise<void>;
  /** Re-read connection/key state after connecting, setting the passphrase or disconnecting. */
  refresh: () => Promise<void>;
}

const SyncContext = createContext<SyncValue | null>(null);
const DEBOUNCE_MS = 3000;
const POLL_MS = 60_000;

/**
 * Runs sync in the background (offline-first: the UI never waits for it):
 * on unlock, when the app returns to the foreground, when back online, every minute while
 * visible, and a few seconds after each local change. Re-checks budget alerts for months
 * that changed through the merge.
 */
export function SyncProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { onboarded, locked } = useSession();
  const runAlerts = useBudgetAlerts();
  const toast = useToast();
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<SyncState>({
    connected: false, hasKey: false, autoSync: true, syncing: false, error: null, lastSyncedAt: null,
  });
  const stateRef = useRef(state);
  stateRef.current = state;

  const refresh = useCallback(async () => {
    const [connected, hasKey, autoSync, lastSyncedAt] = await Promise.all([
      isConnected(), hasFamilyKey(), getLocal<boolean>('autoSync'), getLocal<number | null>('lastSyncedAt'),
    ]);
    setState((s) => ({ ...s, connected, hasKey, autoSync: autoSync !== false, lastSyncedAt: lastSyncedAt ?? null }));
    setReady(true);
  }, []);

  // Re-read on start, after onboarding (a joining phone connects during setup) and on unlock.
  useEffect(() => {
    void refresh();
  }, [refresh, onboarded, locked]);

  const syncNow = useCallback(async ({ quiet = true }: { quiet?: boolean } = {}) => {
    const s = stateRef.current;
    if (!s.connected || !s.hasKey) return;
    setState((x) => ({ ...x, syncing: true }));
    try {
      const result = await runSync();
      const lastSyncedAt = (await getLocal<number>('lastSyncedAt')) ?? Date.now();
      setState((x) => ({ ...x, syncing: false, error: null, lastSyncedAt }));
      if (!quiet && result.merged > 0) toast.show(t('sync.merged', { count: result.merged }), { durationMs: 3000 });
      for (const month of result.changedMonths) await runAlerts(month);
    } catch (err) {
      const kind = err instanceof SyncError ? err.kind : 'other';
      setState((x) => ({ ...x, syncing: false, error: kind }));
    }
  }, [runAlerts, toast, t]);

  const setAutoSync = useCallback(async (on: boolean) => {
    await setLocal('autoSync', on);
    setState((x) => ({ ...x, autoSync: on }));
  }, []);

  const active = ready && onboarded && !locked && state.connected && state.hasKey && state.autoSync;

  // On unlock / when it becomes possible, and every minute while visible.
  useEffect(() => {
    if (!active) return;
    void syncNow();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void syncNow();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && void syncNow();
    const onOnline = () => void syncNow();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [active, syncNow]);

  // A few seconds after each local change (debounced).
  useEffect(() => {
    if (!active) return;
    let timer: number | undefined;
    const off = onLocalChange(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void syncNow(), DEBOUNCE_MS);
    });
    return () => {
      off();
      window.clearTimeout(timer);
    };
  }, [active, syncNow]);

  const value = useMemo(() => ({ ...state, ready, syncNow, setAutoSync, refresh }), [state, ready, syncNow, setAutoSync, refresh]);
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used inside <SyncProvider>');
  return ctx;
}
