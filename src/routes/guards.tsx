import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '../state/session';

/** Everything with family data sits behind this: first-run setup, then the lock screen. */
export function RequireUnlocked() {
  const { onboarded, locked } = useSession();
  const location = useLocation();
  if (!onboarded) return <Navigate to="/onboarding" replace />;
  if (locked) return <Navigate to="/lock" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/**
 * The lock screen only makes sense when set up and locked. Once unlocked, return to the
 * screen that was open when the app locked (passed in location state by RequireUnlocked).
 */
export function LockGate({ children }: { children: ReactNode }) {
  const { onboarded, locked } = useSession();
  const location = useLocation();
  if (!onboarded) return <Navigate to="/onboarding" replace />;
  if (!locked) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== '/lock' ? from : '/'} replace />;
  }
  return <>{children}</>;
}

/** Onboarding runs once per phone. */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const { onboarded } = useSession();
  if (onboarded) return <Navigate to="/" replace />;
  return <>{children}</>;
}
