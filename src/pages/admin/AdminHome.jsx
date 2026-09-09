import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Building2, Users, ShieldCheck, ArrowRight } from 'lucide-react';

export default function AdminHome() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.functions.invoke('adminCompanies', { action: 'list' }),
      base44.functions.invoke('adminUsers', { action: 'list' }),
    ])
      .then(([c, u]) => setData({
        companies: c.data.companies || [],
        users: u.data.users || [],
      }))
      .catch(() => setError(true));
  }, []);

  const activeCount = data ? data.companies.filter((c) => c.status === 'active').length : 0;
  const suspendedCount = data ? data.companies.filter((c) => c.status === 'suspended').length : 0;
  const superAdminCount = data ? data.users.filter((u) => u.is_platform_admin).length : 0;

  const stats = [
    { label: 'Empresas ativas', value: activeCount, icon: Building2, tone: 'text-emerald-600 bg-emerald-50' },
    { label: 'Empresas suspensas', value: suspendedCount, icon: Building2, tone: 'text-red-600 bg-red-50' },
    { label: 'Usuários da plataforma', value: data?.users.length ?? '—', icon: Users, tone: 'text-indigo-600 bg-indigo-50' },
    { label: 'SUPER_ADMINs', value: superAdminCount, icon: ShieldCheck, tone: 'text-amber-600 bg-amber-50' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Administração da Plataforma</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Painel exclusivo do SUPER_ADMIN — gestão das empresas e usuários do CimentoPro
        </p>
      </div>

      {error ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
          Não foi possível carregar os dados da plataforma. Tente novamente.
        </div>
      ) : !data ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map(({ label, value, icon: Icon, tone }) => (
              <div key={label} className="bg-white border border-slate-200 rounded-xl p-5">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${tone}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <p className="text-2xl font-bold text-slate-900 mt-3">{value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link to="/admin/companies"
              className="group bg-white border border-slate-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-sm transition-all">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Building2 className="w-5 h-5" />
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="font-semibold text-slate-900 mt-3">Gerenciar Empresas</p>
              <p className="text-xs text-slate-500 mt-1">Criar, editar, suspender e reativar empresas</p>
            </Link>
            <Link to="/admin/users"
              className="group bg-white border border-slate-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-sm transition-all">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Users className="w-5 h-5" />
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="font-semibold text-slate-900 mt-3">Ver Usuários</p>
              <p className="text-xs text-slate-500 mt-1">Usuários da plataforma e vínculos por empresa</p>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}