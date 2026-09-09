// ============================================================
// Sistema de permissões do CimentoPro — fonte única de verdade.
//
// Modelo granular por módulo (PRODUCTION_VIEW, MACHINES_EDIT, ...):
// - Usuário logado: permissões derivadas do papel na empresa ativa
//   (owner/admin → administrador; supervisor → supervisor).
// - Operador PIN: permissões do perfil vinculado (UserRoleProfile),
//   com fallback pelo papel quando não há perfil vinculado.
// - SUPER_ADMIN (is_platform_admin): todas as permissões + plataforma.
//
// Menu, guarda de rotas e ações de criar/editar/excluir consultam
// este catálogo via PermissionsContext. Esconder o menu é apenas
// experiência — a decisão real está nas permissões e nas RLS.
// ============================================================

// Rotas da aplicação (chave, rota, rótulo) — navegação e perfis.
export const MODULES = [
  { key: 'dashboard', path: '/', label: 'Indicadores' },
  { key: 'orders', path: '/orders', label: 'Ordens de Produção' },
  { key: 'operator_panel', path: '/operator-panel', label: 'Painel do Operador' },
  { key: 'history', path: '/history', label: 'Histórico' },
  { key: 'analysis', path: '/analysis', label: 'Análise' },
  { key: 'stats', path: '/stats', label: 'Controle Estatístico' },
  { key: 'costs', path: '/costs', label: 'Análise de Custos' },
  { key: 'pricing', path: '/pricing', label: 'Simulador de Preços' },
  { key: 'executive_summary', path: '/executive-summary', label: 'Resumo Executivo' },
  { key: 'virtual_engineer', path: '/virtual-engineer', label: 'Engenheiro Virtual' },
  { key: 'machines', path: '/machines', label: 'Máquinas' },
  { key: 'lines', path: '/lines', label: 'Linhas de Produção' },
  { key: 'molds', path: '/molds', label: 'Moldes' },
  { key: 'maintenance', path: '/maintenance', label: 'Manutenção' },
  { key: 'quality', path: '/quality', label: 'Qualidade' },
  { key: 'cadastro', path: '/cadastro', label: 'Cadastro de Produção' },
  { key: 'configuracoes', path: '/configuracoes', label: 'Configurações' },
  { key: 'backup', path: '/backup', label: 'Backup' },
];

// Catálogo granular de permissões por módulo.
export const PERMISSION_CATALOG = [
  { module: 'production', label: 'Produção', actions: {
      view: 'PRODUCTION_VIEW', create: 'PRODUCTION_CREATE', edit: 'PRODUCTION_EDIT', delete: 'PRODUCTION_DELETE' } },
  { module: 'machines', label: 'Máquinas, Linhas e Moldes', actions: {
      view: 'MACHINES_VIEW', create: 'MACHINES_CREATE', edit: 'MACHINES_EDIT', delete: 'MACHINES_DELETE' } },
  { module: 'maintenance', label: 'Manutenção', actions: {
      view: 'MAINTENANCE_VIEW', edit: 'MAINTENANCE_EDIT' } },
  { module: 'quality', label: 'Qualidade', actions: {
      view: 'QUALITY_VIEW', edit: 'QUALITY_EDIT' } },
  { module: 'costs', label: 'Custos e Preços', actions: {
      view: 'COSTS_VIEW', edit: 'COSTS_EDIT' } },
  { module: 'indicators', label: 'Indicadores', actions: {
      view: 'INDICATORS_VIEW' } },
  { module: 'settings', label: 'Configurações', actions: {
      view: 'SETTINGS_VIEW', manage: 'SETTINGS_MANAGE' } },
  { module: 'platform', label: 'Plataforma', actions: {
      view: 'PLATFORM_ADMIN', usersView: 'USERS_VIEW', usersManage: 'USERS_MANAGE',
      companyView: 'COMPANY_VIEW', companyEdit: 'COMPANY_EDIT' } },
];

// Permissão exigida para acessar cada rota (o menu é só experiência;
// esta tabela alimenta o guarda de rotas e as abas permitidas).
export const ROUTE_PERMISSIONS = {
  '/': 'INDICATORS_VIEW',
  '/executive-summary': 'INDICATORS_VIEW',
  '/orders': 'PRODUCTION_VIEW',
  '/operator-panel': 'PRODUCTION_VIEW',
  '/history': 'PRODUCTION_VIEW',
  '/analysis': 'PRODUCTION_VIEW',
  '/stats': 'PRODUCTION_VIEW',
  '/virtual-engineer': 'PRODUCTION_VIEW',
  '/cadastro': 'PRODUCTION_VIEW',
  '/machines': 'MACHINES_VIEW',
  '/lines': 'MACHINES_VIEW',
  '/molds': 'MACHINES_VIEW',
  '/maintenance': 'MAINTENANCE_VIEW',
  '/quality': 'QUALITY_VIEW',
  '/costs': 'COSTS_VIEW',
  '/pricing': 'COSTS_VIEW',
  '/configuracoes': 'SETTINGS_VIEW',
  '/backup': 'SETTINGS_VIEW',
};

// Conjuntos fixos de permissões por papel.
// supervisor: vê tudo, edita produção/máquinas/manutenção/qualidade — sem excluir.
// administrador/owner/admin: todos os módulos operacionais + configurações.
export const ROLE_GRANTS = {
  operador: ['PRODUCTION_VIEW', 'PRODUCTION_CREATE'],
  user: ['PRODUCTION_VIEW', 'PRODUCTION_CREATE'],
  supervisor: [
    'INDICATORS_VIEW',
    'PRODUCTION_VIEW', 'PRODUCTION_CREATE', 'PRODUCTION_EDIT',
    'MACHINES_VIEW', 'MACHINES_CREATE', 'MACHINES_EDIT',
    'MAINTENANCE_VIEW', 'MAINTENANCE_EDIT',
    'QUALITY_VIEW', 'QUALITY_EDIT',
    'COSTS_VIEW',
  ],
};
const FULL_OPERATIONAL = [
  'INDICATORS_VIEW',
  'PRODUCTION_VIEW', 'PRODUCTION_CREATE', 'PRODUCTION_EDIT', 'PRODUCTION_DELETE',
  'MACHINES_VIEW', 'MACHINES_CREATE', 'MACHINES_EDIT', 'MACHINES_DELETE',
  'MAINTENANCE_VIEW', 'MAINTENANCE_EDIT',
  'QUALITY_VIEW', 'QUALITY_EDIT',
  'COSTS_VIEW', 'COSTS_EDIT',
  'SETTINGS_VIEW', 'SETTINGS_MANAGE',
];
ROLE_GRANTS.administrador = FULL_OPERATIONAL;
ROLE_GRANTS.owner = FULL_OPERATIONAL;
ROLE_GRANTS.admin = FULL_OPERATIONAL;

// Permissões exclusivas do SUPER_ADMIN (painel /admin da plataforma).
export const PLATFORM_GRANTS = [
  'PLATFORM_ADMIN', 'USERS_VIEW', 'USERS_MANAGE', 'COMPANY_VIEW', 'COMPANY_EDIT',
];

// Migração automática: perfis no formato antigo (boolean por módulo)
// são convertidos para o formato granular, com acesso de edição mantido.
const LEGACY_MODULE_PERMS = {
  dashboard: ['INDICATORS_VIEW'],
  executive_summary: ['INDICATORS_VIEW'],
  orders: ['PRODUCTION_VIEW', 'PRODUCTION_CREATE', 'PRODUCTION_EDIT'],
  operator_panel: ['PRODUCTION_VIEW', 'PRODUCTION_CREATE', 'PRODUCTION_EDIT'],
  history: ['PRODUCTION_VIEW'],
  analysis: ['PRODUCTION_VIEW'],
  stats: ['PRODUCTION_VIEW'],
  virtual_engineer: ['PRODUCTION_VIEW'],
  cadastro: ['PRODUCTION_VIEW', 'PRODUCTION_EDIT'],
  machines: ['MACHINES_VIEW', 'MACHINES_CREATE', 'MACHINES_EDIT', 'MACHINES_DELETE'],
  lines: ['MACHINES_VIEW', 'MACHINES_CREATE', 'MACHINES_EDIT', 'MACHINES_DELETE'],
  molds: ['MACHINES_VIEW', 'MACHINES_CREATE', 'MACHINES_EDIT', 'MACHINES_DELETE'],
  maintenance: ['MAINTENANCE_VIEW', 'MAINTENANCE_EDIT'],
  quality: ['QUALITY_VIEW', 'QUALITY_EDIT'],
  costs: ['COSTS_VIEW', 'COSTS_EDIT'],
  pricing: ['COSTS_VIEW', 'COSTS_EDIT'],
  configuracoes: ['SETTINGS_VIEW', 'SETTINGS_MANAGE'],
  backup: ['SETTINGS_VIEW', 'SETTINGS_MANAGE'],
};

const ALL_GRANULAR = new Set(PERMISSION_CATALOG.flatMap((m) => Object.values(m.actions)));

// Resolve o objeto de permissões de um perfil (novo ou legado) em um Set granular.
// Retorna null quando não há nenhuma permissão válida (para aplicar o fallback por papel).
export function resolvePermissions(permissions) {
  if (!permissions || typeof permissions !== 'object') return null;
  const set = new Set();
  Object.entries(permissions).forEach(([key, value]) => {
    if (value !== true) return;
    if (ALL_GRANULAR.has(key)) {
      set.add(key);
    } else if (LEGACY_MODULE_PERMS[key]) {
      LEGACY_MODULE_PERMS[key].forEach((p) => set.add(p));
    }
  });
  return set.size ? set : null;
}

// Converte um conjunto de permissões nas rotas permitidas (ordem do menu).
export function permissionsToPaths(perms) {
  if (!perms || !perms.size) return [];
  return MODULES.map((m) => m.path).filter((path) => perms.has(ROUTE_PERMISSIONS[path]));
}

// Rotas permitidas para um papel (usuário logado sem perfil).
export function getAllowedPaths(role) {
  return permissionsToPaths(new Set(ROLE_GRANTS[role] || ROLE_GRANTS.operador));
}

// Converte o objeto de permissões do perfil em lista de rotas.
// Retorna null se não houver permissões válidas (fallback por função).
export function getPathsFromPermissions(permissions) {
  const set = resolvePermissions(permissions);
  return set ? permissionsToPaths(set) : null;
}

// Resolve as rotas permitidas para um operador logado por PIN.
// Prioriza o perfil vinculado; sem perfil, cai no fallback por função.
export function getAllowedPathsForOperator(operator) {
  if (!operator) return [];
  const fromProfile = getPathsFromPermissions(operator.permissions);
  if (fromProfile) return fromProfile;
  return getAllowedPaths(operator.role);
}

export function canAccess(role, path) {
  return getAllowedPaths(role).includes(path);
}

export const ROLE_LABELS = {
  operador: 'Operador',
  supervisor: 'Supervisor',
  administrador: 'Administrador',
  admin: 'Administrador',
  user: 'Operador',
};