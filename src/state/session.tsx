import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

interface SessionValue {
  /** First-run setup finished on this phone. */
  onboarded: boolean;
  /** The lock screen must be passed before any data is shown. */
  locked: boolean;
  unlock: () => void;
  lock: () => void;
  completeOnboarding: () => void;
  /**
   * Keep the app unlocked while it hands off to the system on purpose (share sheet,
   * Face ID prompt, file picker). Call the returned function when done.
   */
  suppressAutoLock: () => () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ initialOnboarded, children }: { initialOnboarded: boolean; children: ReactNode }) {
  const [onboarded, setOnboarded] = useState(initialOnboarded);
  // Cold start: always locked once set up.
  const [locked, setLocked] = useState(initialOnboarded);
  const suppressors = useRef(0);

  const lock = useCallback(() => setLocked(true), []);
  const unlock = useCallback(() => setLocked(false), []);
  const completeOnboarding = useCallback(() => {
    setOnboarded(true);
    setLocked(false);
  }, []);
  const suppressAutoLock = useCallback(() => {
    suppressors.current += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      suppressors.current = Math.max(0, suppressors.current - 1);
    };
  }, []);

  // Lock as soon as the app goes to the background, so the app switcher preview and the
  // return both show the lock screen — unless we deliberately handed off to the system.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && onboarded && suppressors.current === 0) setLocked(true);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [onboarded]);

  const value = useMemo(
    () => ({ onboarded, locked, unlock, lock, completeOnboarding, suppressAutoLock }),
    [onboarded, locked, unlock, lock, completeOnboarding, suppressAutoLock],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
