import { lazy, Suspense, useEffect, useState } from 'react';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getLocal, initDb } from './db/init';
import { SessionProvider } from './state/session';
import { ToastProvider } from './state/toast';
import { SyncProvider } from './state/sync';
import { LockGate, OnboardingGate, RequireUnlocked } from './routes/guards';
import { TabsLayout } from './routes/TabsLayout';
import { Dashboard } from './routes/Dashboard';
import { ChangePin } from './routes/ChangePin';
import { Lock } from './routes/Lock';
import { AddExpense } from './routes/AddExpense';

/**
 * Hash routing (`#/settings`) so deep links work on GitHub Pages, which has no SPA fallback.
 * Every screen with family data is behind RequireUnlocked: onboarding on first run,
 * then the lock screen on launch and on every return from background.
 */
// Screens that are rarely opened load on demand, so the app itself starts faster:
// Analytics (charts + PDF), Settings (sync, family, export) and the one-time setup.
const Analytics = lazy(() => import('./routes/Analytics').then((m) => ({ default: m.Analytics })));
const Settings = lazy(() => import('./routes/Settings').then((m) => ({ default: m.Settings })));
const Onboarding = lazy(() => import('./routes/Onboarding').then((m) => ({ default: m.Onboarding })));

function Loading() {
  const { t } = useTranslation();
  return <p className="muted">{t('app.loading')}</p>;
}

const router = createHashRouter([
  {
    element: <RequireUnlocked />,
    children: [
      {
        path: '/',
        element: <TabsLayout />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: 'analytics', element: <Suspense fallback={<Loading />}><Analytics /></Suspense> },
          { path: 'settings', element: <Suspense fallback={<Loading />}><Settings /></Suspense> },
        ],
      },
      { path: '/settings/pin', element: <ChangePin /> },
      { path: '/add-expense', element: <AddExpense /> },
      { path: '/expense/:id', element: <AddExpense /> },
    ],
  },
  { path: '/lock', element: <LockGate><Lock /></LockGate> },
  { path: '/onboarding', element: <OnboardingGate><Suspense fallback={<Loading />}><Onboarding /></Suspense></OnboardingGate> },
]);

type BootState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; onboarded: boolean };

export function App() {
  const { t } = useTranslation();
  const [boot, setBoot] = useState<BootState>({ status: 'loading' });

  useEffect(() => {
    initDb()
      .then(async () => setBoot({ status: 'ready', onboarded: (await getLocal<boolean>('onboardingComplete')) === true }))
      .catch((err: unknown) => {
        console.error(err);
        setBoot({ status: 'error' });
      });
  }, []);

  if (boot.status !== 'ready') {
    return (
      <div className="shell">
        <main className="screen center">
          <p className="muted">{boot.status === 'loading' ? t('app.loading') : t('app.loadError')}</p>
        </main>
      </div>
    );
  }
  return (
    <SessionProvider initialOnboarded={boot.onboarded}>
      <ToastProvider>
        <SyncProvider>
          <RouterProvider router={router} />
        </SyncProvider>
      </ToastProvider>
    </SessionProvider>
  );
}
