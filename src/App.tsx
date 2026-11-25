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
import { Settings } from './routes/Settings';
import { ChangePin } from './routes/ChangePin';
import { Lock } from './routes/Lock';
import { Onboarding } from './routes/Onboarding';
import { AddExpense } from './routes/AddExpense';

/**
 * Hash routing (`#/settings`) so deep links work on GitHub Pages, which has no SPA fallback.
 * Every screen with family data is behind RequireUnlocked: onboarding on first run,
 * then the lock screen on launch and on every return from background.
 */
// Analytics (charts + PDF) loads only when opened, so the app itself starts faster.
const Analytics = lazy(() => import('./routes/Analytics').then((m) => ({ default: m.Analytics })));

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
          { path: 'settings', element: <Settings /> },
        ],
      },
      { path: '/settings/pin', element: <ChangePin /> },
      { path: '/add-expense', element: <AddExpense /> },
      { path: '/expense/:id', element: <AddExpense /> },
    ],
  },
  { path: '/lock', element: <LockGate><Lock /></LockGate> },
  { path: '/onboarding', element: <OnboardingGate><Onboarding /></OnboardingGate> },
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
