import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useCompany } from '@/lib/CompanyContext';
import { usePermissions } from '@/lib/PermissionsContext';
import AdminLayout from '@/components/admin/AdminLayout';

// Guarda de rota dedicada às rotas /admin/* — o único ponto de decisão do frontend.
// A permissão PLATFORM_ADMIN vem da verificação do backend (fonte protegida
// PlatformAdmin), carregada junto com as empresas do usuário — nunca da flag
// bruta da sessão. ADMIN de empresa e operadores PIN são redirecionados sem
// renderizar nada administrativo.
export default function AdminGuard() {
  const { isLoadingAuth } = useAuth();
  const { loading: loadingCompany } = useCompany();
  const { can, allowedPaths } = usePermissions();

  if (isLoadingAuth || loadingCompany) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!can('PLATFORM_ADMIN')) {
    return <Navigate to={allowedPaths[0] || '/'} replace />;
  }

  return <AdminLayout />;
}