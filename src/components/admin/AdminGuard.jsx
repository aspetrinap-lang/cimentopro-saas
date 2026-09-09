import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { isPlatformAdmin } from '@/lib/platformAdmin';
import AdminLayout from '@/components/admin/AdminLayout';

// Guarda de rota dedicada às rotas /admin/* — o único ponto de decisão do frontend.
// ADMIN de empresa (role=admin, is_platform_admin=false) e usuários comuns
// são redirecionados para a área normal sem renderizar nada administrativo.
export default function AdminGuard() {
  const { user, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isPlatformAdmin(user)) {
    return <Navigate to="/" replace />;
  }

  return <AdminLayout />;
}