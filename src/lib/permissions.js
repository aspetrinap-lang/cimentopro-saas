// Lista centralizada de módulos da aplicação (chave, rota, rótulo).
// Usada para montar a navegação, validar permissões e configurar perfis de acesso.
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

// Permissões padrão por função (fallback quando o operador não tem perfil vinculado).
const ROLE_PERMISSIONS = {
  operador: ['/operator-panel', '/orders'],
  supervisor: [
    '/', '/orders', '/operator-panel', '/machines',
    '/analysis', '/stats', '/costs', '/pricing', '/executive-summary', '/virtual-engineer',
    '/maintenance', '/molds', '/history', '/quality',
    '/cadastro', '/lines',
  ],
  administrador: [
    '/', '/orders', '/operator-panel', '/machines',
    '/analysis', '/stats', '/costs', '/pricing', '/executive-summary', '/virtual-engineer',
    '/maintenance', '/molds', '/history', '/quality',
    '/cadastro', '/configuracoes', '/backup', '/lines',
  ],
  // Compatibilidade com os papéis padrão do Base44
  admin: [
    '/', '/orders', '/operator-panel', '/machines',
    '/analysis', '/stats', '/costs', '/pricing', '/executive-summary', '/virtual-engineer',
    '/maintenance', '/molds', '/history', '/quality',
    '/cadastro', '/configuracoes', '/backup', '/lines',
  ],
  user: ['/operator-panel', '/orders'],
};

export function getAllowedPaths(role) {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.operador;
}

// Converte o objeto de permissões do perfil em lista de rotas.
// Retorna null se não houver permissões válidas (para aplicar o fallback por função).
export function getPathsFromPermissions(permissions) {
  if (!permissions || typeof permissions !== 'object') return null;
  const paths = MODULES.filter((m) => permissions[m.key] === true).map((m) => m.path);
  return paths.length ? paths : null;
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