// Módulos da plataforma controlados pelo plano de assinatura.
// As chaves são gravadas em SubscriptionPlan.features e validadas no backend
// (subscriptionManagement → allowed_modules). O mapeamento rota → módulo é
// usado pelo menu e pela guarda de rotas no Layout.

export const PLAN_MODULES = [
  { key: 'DASHBOARD', label: 'Indicadores & Relatórios', description: 'Painel, resumo executivo e engenheiro virtual' },
  { key: 'PRODUCTION', label: 'Produção', description: 'Ordens, painel do operador, cadastros, moldes e histórico' },
  { key: 'MAINTENANCE', label: 'Máquinas & Manutenção', description: 'Máquinas, linhas de produção e manutenção' },
  { key: 'QUALITY', label: 'Qualidade', description: 'Ensaios, laudos e calibrações' },
  { key: 'ANALYSIS', label: 'Análises', description: 'Análise de produção e controle estatístico' },
  { key: 'COSTS', label: 'Custos & Preços', description: 'Análise de custos e simulador de preços' },
  { key: 'SETTINGS', label: 'Configurações', description: 'Configurações da empresa e backup' },
];

const ROUTE_MODULES = {
  '/': 'DASHBOARD',
  '/executive-summary': 'DASHBOARD',
  '/virtual-engineer': 'DASHBOARD',
  '/orders': 'PRODUCTION',
  '/operator-panel': 'PRODUCTION',
  '/history': 'PRODUCTION',
  '/cadastro': 'PRODUCTION',
  '/molds': 'PRODUCTION',
  '/machines': 'MAINTENANCE',
  '/lines': 'MAINTENANCE',
  '/maintenance': 'MAINTENANCE',
  '/quality': 'QUALITY',
  '/analysis': 'ANALYSIS',
  '/stats': 'ANALYSIS',
  '/costs': 'COSTS',
  '/pricing': 'COSTS',
  '/configuracoes': 'SETTINGS',
  '/backup': 'SETTINGS',
};

export function moduleForPath(path) {
  return ROUTE_MODULES[path] || null;
}