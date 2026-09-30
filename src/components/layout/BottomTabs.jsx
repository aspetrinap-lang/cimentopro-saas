import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, Timer, Gauge, Wrench, Settings,
  BarChart2, Activity, Calculator, Tags, FileText, Bot, Layers,
  ShieldCheck, Package, SquareStack, History, Database, LifeBuoy,
} from 'lucide-react';

// Mesmos itens do menu lateral — a barra filtra pelas abas permitidas
// (permissões + plano), recebidas via prop `allowed`.
const TABS = [
  { to: '/', label: 'Controle de Fábrica', icon: LayoutDashboard, end: true },
  { to: '/executive-summary', label: 'Resumo Executivo', icon: FileText },
  { to: '/virtual-engineer', label: 'Eng. Virtual', icon: Bot },
  { to: '/analysis', label: 'Análise', icon: BarChart2 },
  { to: '/stats', label: 'Estatística', icon: Activity },
  { to: '/costs', label: 'Custos', icon: Calculator },
  { to: '/pricing', label: 'Preços', icon: Tags },
  { to: '/orders', label: 'Ordens', icon: ClipboardList },
  { to: '/operator-panel', label: 'Painel', icon: Timer },
  { to: '/machines', label: 'Máquinas', icon: Gauge },
  { to: '/lines', label: 'Linhas', icon: Layers },
  { to: '/maintenance', label: 'Manutenção', icon: Wrench },
  { to: '/quality', label: 'Qualidade', icon: ShieldCheck },
  { to: '/cadastro', label: 'Cadastro', icon: Package },
  { to: '/molds', label: 'Moldes', icon: SquareStack },
  { to: '/history', label: 'Histórico', icon: History },
  { to: '/configuracoes', label: 'Ajustes', icon: Settings },
  { to: '/backup', label: 'Backup', icon: Database },
  { to: '/suporte', label: 'Suporte', icon: LifeBuoy },
];

export default function BottomTabs({ allowed }) {
  const location = useLocation();
  const scrollerRef = useRef(null);
  const [selected, setSelected] = useState(location.pathname);
  const tabs = TABS.filter((t) => allowed.includes(t.to));

  useEffect(() => {
    setSelected(location.pathname);
  }, [location.pathname]);

  // Auto-centraliza a aba selecionada na pílula (carregamento e troca de rota)
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const el = scroller.querySelector(`[data-path="${CSS.escape(selected)}"]`);
    if (el) {
      scroller.scrollTo({
        left: el.offsetLeft - (scroller.clientWidth - el.clientWidth) / 2,
        behavior: 'smooth',
      });
    }
  }, [selected, tabs.length]);

  // Dois toques: o primeiro seleciona/centraliza a aba; o segundo (aba já
  // destacada) navega. Tocar a aba da rota atual navega direto.
  function handleClick(e, to) {
    if (selected === to) return;
    e.preventDefault();
    setSelected(to);
  }

  if (tabs.length === 0) return null;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border pb-[env(safe-area-inset-bottom)]">
      <div className="relative">
        <div
          ref={scrollerRef}
          className="flex gap-1 overflow-x-auto scrollbar-hide snap-x px-2 py-2"
        >
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              data-path={to}
              onClick={(e) => handleClick(e, to)}
              className={({ isActive }) => {
                const highlighted = isActive || selected === to;
                return `flex shrink-0 snap-center flex-col items-center justify-center gap-0.5 rounded-full px-3.5 py-2 text-[10px] font-medium transition-all ${
                  highlighted
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground'
                }`;
              }}
            >
              <Icon className="w-5 h-5" />
              {label}
            </NavLink>
          ))}
        </div>
        {/* Degradê nas bordas indicando continuação da fileira */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-card to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card to-transparent" />
      </div>
    </nav>
  );
}