import { Outlet, NavLink, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, History, Settings, Factory, Menu, X, BarChart2, Gauge, SquareStack, Wrench, Database, FileText, Bot, Package, LogOut, UserCircle, KeyRound, ShieldCheck, Activity, Layers, Calculator, Tags, Timer } from 'lucide-react';
import { useState } from 'react';
import BottomTabs from '@/components/layout/BottomTabs';
import { useDailyBackup } from '@/hooks/useDailyBackup';
import { useEnterToTab } from '@/hooks/useEnterToTab';
import { useAuth } from '@/lib/AuthContext';
import { useOperator } from '@/lib/OperatorContext';
import { ROLE_LABELS } from '@/lib/permissions';
import { usePermissions } from '@/lib/PermissionsContext';
import { useToast } from '@/components/ui/use-toast';
import CompanySelector from '@/components/CompanySelector';
import NoCompanyScreen from '@/components/NoCompanyScreen';
import BlockedSubscriptionScreen from '@/components/BlockedSubscriptionScreen';
import ModuleBlockedScreen from '@/components/ModuleBlockedScreen';
import { useSubscription } from '@/lib/SubscriptionContext';
import CompanySelectionScreen from '@/components/CompanySelectionScreen';
import { useCompany } from '@/lib/CompanyContext';
import { logAudit } from '@/lib/audit';

const navItems = [
  { to: '/', label: 'Indicadores', icon: LayoutDashboard },
  { to: '/executive-summary', label: 'Resumo Executivo', icon: FileText },
  { to: '/virtual-engineer', label: 'Engenheiro Virtual', icon: Bot },
  { to: '/analysis', label: 'Análise', icon: BarChart2 },
  { to: '/stats', label: 'Controle Estatístico', icon: Activity },
  { to: '/costs', label: 'Análise de Custos', icon: Calculator },
  { to: '/pricing', label: 'Simulador de Preços', icon: Tags },
  { to: '/orders', label: 'Ordens de Produção', icon: ClipboardList },
  { to: '/operator-panel', label: 'Painel do Operador', icon: Timer },
  { to: '/machines', label: 'Máquinas', icon: Gauge },
  { to: '/lines', label: 'Linhas de Produção', icon: Layers },
  { to: '/maintenance', label: 'Manutenção', icon: Wrench },
  { to: '/quality', label: 'Qualidade', icon: ShieldCheck },
  { to: '/cadastro', label: 'Cadastro', icon: Package },
  { to: '/molds', label: 'Moldes', icon: SquareStack },
  { to: '/history', label: 'Histórico', icon: History },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
  { to: '/backup', label: 'Backup', icon: Database },
];

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();
  const { activeOperator, clearOperator } = useOperator();
  const navigate = useNavigate();
  useDailyBackup();
  useEnterToTab();

  const { allowedPaths, can } = usePermissions();
  const { clearCompany, loading: loadingCompany, hasCompany, needsCompanySelection, currentCompany } = useCompany();
  const { toast } = useToast();
  const allowed = allowedPaths;
  const canManageOperators = can('SETTINGS_VIEW');
  const isPlatform = !activeOperator && can('PLATFORM_ADMIN');
  // Plano e assinatura: a empresa só vê (e acessa) os módulos incluídos no
  // plano vigente. SUPER_ADMIN mantém a visão completa da plataforma.
  const {
    blocked, blockReason, plan: currentPlan, subscription,
    moduleAllowed, loading: loadingSubscription,
  } = useSubscription();
  const visibleNav = navItems.filter((i) => allowed.includes(i.to) && (isPlatform || moduleAllowed(i.to)));
  const fallbackPath = visibleNav[0]?.to || '/';

  // Isolamento multi-tenant: nenhuma página operacional monta (nem consulta
  // dados) antes da empresa ativa existir. Sem vínculo → tela de bloqueio;
  // múltiplas empresas → seleção obrigatória. SUPER_ADMIN mantém visão de
  // plataforma (consultas globais via scopedFilter).
  if (!activeOperator && loadingCompany) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }
  if (!isPlatform && !activeOperator && !hasCompany) {
    return <NoCompanyScreen />;
  }
  if (!isPlatform && !activeOperator && needsCompanySelection) {
    return <CompanySelectionScreen />;
  }

  // Assinatura vigente carregando: evita renderizar páginas que podem ser
  // bloqueadas pelo plano logo em seguida (pisca de tela).
  if (!isPlatform && loadingSubscription) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Assinatura vencida/suspensa/cancelada: a empresa inteira é bloqueada com
  // orientação clara — nenhum dado é apagado, apenas o acesso é interrompido.
  if (!isPlatform && blocked) {
    return <BlockedSubscriptionScreen reason={blockReason} plan={currentPlan} subscription={subscription} />;
  }

  // Guarda de rotas: esconder o menu é apenas experiência — a decisão
  // real de acesso acontece aqui, antes de renderizar qualquer página.
  if (!allowed.includes(location.pathname)) {
    toast({ title: 'Acesso restrito', description: 'Você não tem permissão para acessar este módulo.' });
    return <Navigate to={fallbackPath || '/pin-login'} replace />;
  }

  // Módulo fora do plano vigente: bloqueado com mensagem clara — o menu já o
  // omite; isto cobre o acesso direto pela URL.
  if (!isPlatform && !moduleAllowed(location.pathname)) {
    return <ModuleBlockedScreen plan={currentPlan} fallbackPath={fallbackPath} />;
  }

  async function handleLogoutOperator() {
    await logAudit({ action: 'LOGOUT', entity_name: 'UserPin', entity_id: activeOperator?.id || null });
    clearOperator();
    navigate('/pin-login');
  }
  async function handleLogout() {
    await logAudit({ action: 'LOGOUT', entity_name: 'User' });
    // Limpa a empresa ativa e a chave persistida por usuário no navegador
    clearCompany();
    logout(true);
  }

  const navClass = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
      isActive ? 'bg-primary text-white font-medium' : 'text-white/60 hover:text-white hover:bg-white/8'
    }`;

  const renderFooter = () => (
    <div className="px-4 py-3 border-t border-white/10 space-y-2">
      {activeOperator ? (
        <>
          <div className="flex items-center gap-2 px-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-white font-semibold text-sm">
              {activeOperator.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{activeOperator.name}</p>
              <p className="text-xs text-white/40">{ROLE_LABELS[activeOperator.role] || activeOperator.role}</p>
            </div>
          </div>
          <button onClick={handleLogoutOperator} className="w-full flex items-center justify-center gap-2 text-xs text-white/60 hover:text-white py-2 rounded-lg hover:bg-white/8 transition-colors">
            <LogOut className="w-3.5 h-3.5" /> Trocar Operador
          </button>
        </>
      ) : (
        <>
          {canManageOperators && (
            <Link to="/pin-login" onClick={() => setMobileOpen(false)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-white/70 hover:text-white hover:bg-white/8 transition-colors">
              <KeyRound className="w-3.5 h-3.5" /> Modo Operador (PIN)
            </Link>
          )}
          <div className="flex items-center gap-2 px-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <UserCircle className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{user?.email || 'Usuário'}</p>
              <p className="text-xs text-white/40">{ROLE_LABELS[user?.role] || user?.role || ''}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 text-xs text-white/60 hover:text-white py-2 rounded-lg hover:bg-white/8 transition-colors">
            <LogOut className="w-3.5 h-3.5" /> Sair
          </button>
        </>
      )}
    </div>
  );

  return (
    <div className="flex h-screen bg-background font-inter overflow-hidden">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 bg-[hsl(var(--sidebar-bg))] text-white">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
          {currentCompany?.logo_url ? (
            <img src={currentCompany.logo_url} alt={currentCompany.name} className="w-8 h-8 rounded-lg bg-white/95 object-contain shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <Factory className="w-4 h-4 text-white" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-sm leading-none truncate">{currentCompany?.name || 'CimentoPro'}</p>
            <p className="text-xs text-white/50 mt-0.5">{activeOperator ? 'Operador' : 'CimentoPro — Produção'}</p>
          </div>
        </div>
        <CompanySelector />
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-hide">
          {visibleNav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={navClass}>
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </NavLink>
          ))}
          {isPlatform && (
            <div className="pt-3 mt-3 border-t border-white/10">
              <NavLink to="/admin" className={navClass}>
                <ShieldCheck className="w-4 h-4 shrink-0" />
                Admin CimentoPro
              </NavLink>
            </div>
          )}
        </nav>
        {renderFooter()}
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-[calc(3.5rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] bg-[hsl(var(--sidebar-bg))] text-white shadow">
        <div className="flex items-center gap-2 min-w-0">
          {currentCompany?.logo_url ? (
            <img src={currentCompany.logo_url} alt={currentCompany.name} className="w-5 h-5 object-contain shrink-0" />
          ) : (
            <Factory className="w-5 h-5 text-primary shrink-0" />
          )}
          <span className="font-semibold text-sm shrink-0">CimentoPro</span>
          {currentCompany && (
            <span className="text-xs text-white/50 truncate">· {currentCompany.name}</span>
          )}
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="w-64 bg-[hsl(var(--sidebar-bg))] text-white flex flex-col pt-[calc(3.5rem+env(safe-area-inset-top))]">
            <CompanySelector />
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-hide">
              {visibleNav.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} end={to === '/'} onClick={() => setMobileOpen(false)} className={navClass}>
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </NavLink>
              ))}
              {isPlatform && (
                <div className="pt-3 mt-3 border-t border-white/10">
                  <NavLink to="/admin" onClick={() => setMobileOpen(false)} className={navClass}>
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    Admin CimentoPro
                  </NavLink>
                </div>
              )}
            </nav>
            {renderFooter()}
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto md:pt-0 pt-[calc(3.5rem+env(safe-area-inset-top))] pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        <Outlet />
      </main>

      <BottomTabs allowed={visibleNav.map((i) => i.to)} />
    </div>
  );
}