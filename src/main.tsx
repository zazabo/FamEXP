import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './i18n';
import './theme/global.css';
import { ThemeProvider, applyInitialTheme } from './theme/ThemeProvider';
import { App } from './App';

applyInitialTheme();

// Service worker: offline support + silent auto-update when a new version is deployed.
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
