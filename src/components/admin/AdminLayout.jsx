import { useState } from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import {
  Building2, Users, Home, LayoutDashboard, CreditCard, ReceiptText, Activity,
  Settings2, ScrollText, LifeBuoy, BarChart3, ArrowLeft, Menu, X, ShieldCheck
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

const mainNav = [
  { to: '/admin', label: 'Início', icon: Home, end: true },
  { to: '/admin/companies', label: 'Empresas', icon: Building2 },
  { to: '/admin/users', label: 'Usuários', icon: Users },
];

const soonNav = [
  { label: 'Dashboard da Plataforma', icon: LayoutDashboard },
  { label: 'Planos', icon: CreditCard },
  { label: 'Assinaturas', icon: ReceiptText },
  { label: 'Status das Empresas', icon: Activity },
  { label: 'Configurações Globais', icon: Settings2 },
  { label: 'Logs / Auditoria', icon: ScrollText },
  { label: 'Suporte', icon: LifeBuoy },
  { label: 'Métricas da Plataforma', icon: BarChart3 },
];

export default function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();

  const navClass = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
      isActive
        ? 'bg-indigo-600 text-white font-medium shadow-sm shadow-indigo-600/20'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
    }`;

  const renderNav = (onNavigate) => (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-hide">
      {mainNav.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} onClick={onNavigate} className={navClass}>
          <Icon className="w-4 h-4 shrink-0" />
          {label}
        </NavLink>
      ))}
      <div className="pt-4 mt-2 border-t border-slate-100">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Plataforma</p>
        <div className="space-y-1">
          {soonNav.map(({ label, icon: Icon }) => (
            <div key={label} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 cursor-not-allowed">
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{label}</span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">Em breve</span>
            </div>
          ))}
        </div>
      </div>
    </nav>
  );

  const renderFooter = () => (
    <div className="px-4 py-3 border-t border-slate-100 space-y-2">
      <div className="flex items-center gap-2.5 px-2">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{user?.full_name || user?.email || 'Usuário'}</p>
          <p className="text-[11px] font-bold tracking-wide text-amber-600">SUPER_ADMIN</p>
        </div>
      </div>
      <Link to="/" className="w-full flex items-center justify-center gap-2 text-xs text-slate-500 hover:text-slate-900 py-2 rounded-lg hover:bg-slate-100 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Voltar à Operação
      </Link>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 font-inter overflow-hidden">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 bg-white border-r border-slate-200">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <p className="font-semibold text-sm text-slate-900 leading-none">Admin CimentoPro</p>
            <p className="text-xs text-slate-400 mt-0.5">Administração da Plataforma</p>
          </div>
        </div>
        {renderNav()}
        {renderFooter()}
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-14 bg-slate-900 text-white shadow">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-amber-400" />
          <span className="font-semibold text-sm">Admin CimentoPro</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="w-64 bg-white border-r border-slate-200 flex flex-col pt-14">
            {renderNav(() => setMobileOpen(false))}
            {renderFooter()}
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      <main className="flex-1 overflow-y-auto md:pt-0 pt-14">
        <Outlet />
      </main>
    </div>
  );
}