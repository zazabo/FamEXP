import { useEffect, useState } from 'react';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getLocal, initDb } from './db/init';
import { SessionProvider } from './state/session';
import { ToastProvider } from './state/toast';
import { SyncProvider } from './state/sync';
import { LockGate, OnboardingGate, RequireUnlocked } from './routes/guards';
import { TabsLayout } from './routes/TabsLayout';
import { Dashboard } from './routes/Dashboard';
import { Analytics } from './routes/Analytics';
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
const router = createHashRouter([
  {
    element: <RequireUnlocked />,
    children: [
      {
        path: '/',
        element: <TabsLayout />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: 'analytics', element: <Analytics /> },
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
