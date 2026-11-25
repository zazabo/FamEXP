import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChartPie, House, Settings } from 'lucide-react';

const TABS = [
  { to: '/', key: 'tabs.dashboard', Icon: House, end: true },
  { to: '/analytics', key: 'tabs.analytics', Icon: ChartPie, end: false },
  { to: '/settings', key: 'tabs.settings', Icon: Settings, end: false },
] as const;

export function TabBar() {
  const { t } = useTranslation();
  return (
    <nav className="tabbar" aria-label={t('app.name')}>
      {TABS.map(({ to, key, Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
          <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
          <span>{t(key)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
