import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, Gauge, Wrench, Settings, Timer } from 'lucide-react';

const TABS = [
  { to: '/', label: 'Indicadores', icon: LayoutDashboard, end: true },
  { to: '/orders', label: 'Ordens', icon: ClipboardList },
  { to: '/operator-panel', label: 'Painel', icon: Timer },
  { to: '/machines', label: 'Máquinas', icon: Gauge },
  { to: '/maintenance', label: 'Manutenção', icon: Wrench },
  { to: '/configuracoes', label: 'Ajustes', icon: Settings },
];

export default function BottomTabs({ allowed }) {
  const tabs = TABS.filter(t => allowed.includes(t.to));
  if (tabs.length === 0) return null;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border flex pb-[env(safe-area-inset-bottom)]">
      {tabs.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[44px] text-[10px] font-medium transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground'}`
          }
        >
          <Icon className="w-5 h-5" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}