import React from 'react';
import Dashboard from '@/pages/Dashboard';
import Orders from '@/pages/Orders';
import OperatorPanel from '@/pages/OperatorPanel';
import History from '@/pages/History';
import Analysis from '@/pages/Analysis';
import StatisticalAnalysis from '@/pages/StatisticalAnalysis';
import VirtualEngineerPage from '@/pages/VirtualEngineerPage';
import ExecutiveSummaryPage from '@/pages/ExecutiveSummaryPage';
import CostAnalysis from '@/pages/CostAnalysis';
import PricingSimulator from '@/pages/PricingSimulator';
import Quality from '@/pages/Quality';
import BreakEvenSection from '@/components/breakEven/BreakEvenSection';

// Mapa aba da campanha → componente real da aplicação. O print é capturado
// da tela de verdade (dados da empresa ativa); break-even é uma seção da
// Análise de Custos, renderizada isolada com estado vazio real.
export const TAB_COMPONENTS = {
  'dashboard': { path: '/', title: 'Controle de Fábrica', Component: Dashboard },
  'orders': { path: '/orders', title: 'Ordens de Produção', Component: Orders },
  'operator-panel': { path: '/operator-panel', title: 'Painel do Operador', Component: OperatorPanel },
  'history': { path: '/history', title: 'Histórico', Component: History },
  'analysis': { path: '/analysis', title: 'Análise', Component: Analysis },
  'quality': { path: '/quality', title: 'Qualidade e Laudos', Component: Quality },
  'stats': { path: '/stats', title: 'Controle Estatístico', Component: StatisticalAnalysis },
  'virtual-engineer': { path: '/virtual-engineer', title: 'Engenheiro Virtual (IA)', Component: VirtualEngineerPage },
  'executive-summary': { path: '/executive-summary', title: 'Resumo Executivo', Component: ExecutiveSummaryPage },
  'costs': { path: '/costs', title: 'Análise de Custos', Component: CostAnalysis },
  'pricing': { path: '/pricing', title: 'Simulador de Preços', Component: PricingSimulator },
  'break-even': {
    path: '/costs',
    title: 'Ponto de Equilíbrio',
    Component: () => (
      <BreakEvenSection
        dres={[]}
        orders={[]}
        productTypes={[]}
        lines={[]}
        accounts={[]}
        insumoCosts={[]}
        selectedMonth={null}
      />
    ),
  },
};