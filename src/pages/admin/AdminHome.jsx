import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  Building2, Users, ShieldCheck, CreditCard, ReceiptText, ScrollText,
  LayoutDashboard, Activity, FileSpreadsheet, ArrowRight,
} from 'lucide-react';

export default function AdminHome() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.functions.invoke('adminCompanies', { action: 'list' }),
      base44.functions.invoke('adminUsers', { action: 'list' }),
      base44.functions.invoke('subscriptionManagement', { action: 'listPlans' }),
      base44.functions.invoke('subscriptionManagement', { action: 'listSubscriptions' }),
    ])
      .then(([c, u, p, s]) => setData({
        companies: c.data.companies || [],
        users: u.data.users || [],
        plans: p.data.plans || [],
        subs: s.data.companies || [],
      }))
      .catch(() => setError(true));
  }, []);

  const activeCount = data ? data.companies.filter((c) => c.status === 'active').length : 0;
  const suspendedCount = data ? data.companies.filter((c) => c.status === 'suspended').length : 0;
  const superAdminCount = data ? data.users.filter((u) => u.is_platform_admin).length : 0;
  const activeSubs = data ? data.subs.filter((c) => c.subscription?.status === 'active').length : 0;
  const noSub = data ? data.subs.filter((c) => !c.subscription).length : 0;
  const activePlans = data ? data.plans.filter((p) => p.status === 'active').length : 0;

  const stats = [
    { label: 'Empresas ativas', value: activeCount, tone: 'text-emerald-600 bg-emerald-50' },
    { label: 'Empresas suspensas', value: suspendedCount, tone: 'text-red-600 bg-red-50' },
    { label: 'Usuários da plataforma', value: data?.users.length ?? '—', tone: 'text-indigo-600 bg-indigo-50' },
    { label: 'SUPER_ADMINs', value: superAdminCount, tone: 'text-amber-600 bg-amber-50' },
    { label: 'Assinaturas ativas', value: activeSubs, tone: 'text-emerald-600 bg-emerald-50' },
    { label: 'Empresas sem assinatura', value: noSub, tone: 'text-slate-600 bg-slate-100' },
    { label: 'Planos ativos', value: activePlans, tone: 'text-indigo-600 bg-indigo-50' },
  ];

  const shortcuts = [
    { to: '/admin/dashboard', label: 'Dashboard da Plataforma', desc: 'Visão agregada de empresas, assinaturas e uso por plano', icon: LayoutDashboard },
    { to: '/admin/status', label: 'Status das Empresas', desc: 'Situação, plano e vencimento de cada empresa', icon: Activity },
    { to: '/admin/companies', label: 'Empresas', desc: 'Criar, editar, suspender e reativar', icon: Building2 },
    { to: '/admin/users', label: 'Usuários', desc: 'Vínculos e gestão de SUPER_ADMINs', icon: Users },
    { to: '/admin/audit', label: 'Auditoria', desc: 'Trilha de auditoria com filtros de empresa e período', icon: ScrollText },
    { to: '/admin/dre-template', label: 'DRE Padrão', desc: 'Template oficial, migração e cópias por empresa', icon: FileSpreadsheet },
    { to: '/admin/plans', label: 'Planos', desc: 'Planos de assinatura e limites por módulo', icon: CreditCard },
    { to: '/admin/subscriptions', label: 'Assinaturas', desc: 'Atribuir planos e acompanhar vencimentos', icon: ReceiptText },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Administração da Plataforma</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Painel exclusivo do SUPER_ADMIN — gestão das empresas, usuários, planos e assinaturas do CimentoPro
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
            {stats.map(({ label, value, tone }) => (
              <div key={label} className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-2xl font-bold text-slate-900">{value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {shortcuts.map(({ to, label, desc, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="group bg-white border border-slate-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <Icon className="w-5 h-5" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="font-semibold text-slate-900 mt-3">{label}</p>
                <p className="text-xs text-slate-500 mt-1">{desc}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}