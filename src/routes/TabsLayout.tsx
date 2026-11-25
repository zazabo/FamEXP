import { Outlet } from 'react-router-dom';
import { TabBar } from '../components/TabBar';

export function TabsLayout() {
  return (
    <div className="shell">
      <main className="screen">
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}
