import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { LayoutDashboard, Building2, ReceiptText, TrendingUp, AlertCircle, ArrowRight } from 'lucide-react';
import { fmtBRL } from '@/lib/statsUtils';

const COMPANY_STATUS_STYLES = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  trial: 'bg-sky-50 text-sky-700 border-sky-200',
  suspended: 'bg-red-50 text-red-700 border-red-200',
  inactive: 'bg-slate-100 text-slate-500 border-slate-200',
};

const SUB_STATUS_STYLES = {
  trial: 'bg-sky-50 text-sky-700 border-sky-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  past_due: 'bg-amber-50 text-amber-700 border-amber-200',
  suspended: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
  none: 'bg-slate-100 text-slate-500 border-slate-200',
};

const SUB_LABELS = {
  trial: 'Trial',
  active: 'Ativa',
  past_due: 'Vencida',
  suspended: 'Suspensa',
  cancelled: 'Cancelada',
  none: 'Sem assinatura',
};

const COMPANY_LABELS = {
  active: 'Ativa',
  trial: 'Trial',
  suspended: 'Suspensa',
  inactive: 'Inativa',
};

// Visão agregada da plataforma: empresas, assinaturas e uso por plano — cards
// de resumo e listas compactas com badges, para leitura rápida.
export default function AdminPlatformDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.functions.invoke('adminCompanies', { action: 'list' }),
      base44.functions.invoke('subscriptionManagement', { action: 'listSubscriptions' }),
      base44.functions.invoke('subscriptionManagement', { action: 'listPlans' }),
      base44.functions.invoke('adminUsers', { action: 'list' }),
    ])
      .then(([c, s, p, u]) => setData({
        companies: c.data.companies || [],
        subs: s.data.companies || [],
        plans: p.data.plans || [],
        users: u.data.users || [],
      }))
      .catch(() => setError(true));
  }, []);

  const stats = useMemo(() => {
    if (!data) return [];
    const activeCompanies = data.companies.filter((c) => c.status === 'active').length;
    const activeSubs = data.subs.filter((c) => c.subscription?.status === 'active');
    const mrr = activeSubs.reduce((sum, c) => sum + (c.plan?.price || 0), 0);
    const noSub = data.subs.filter((c) => !c.subscription).length;
    const trialSubs = data.subs.filter((c) => c.subscription?.status === 'trial').length;
    return [
      { label: 'Empresas ativas', value: activeCompanies, icon: Building2, tone: 'text-emerald-600 bg-emerald-50' },
      { label: 'Assinaturas ativas', value: activeSubs.length, icon: ReceiptText, tone: 'text-emerald-600 bg-emerald-50' },
      { label: 'Empresas sem assinatura', value: noSub, icon: AlertCircle, tone: 'text-slate-600 bg-slate-100' },
      { label: 'MRR estimado', value: fmtBRL(mrr), icon: TrendingUp, tone: 'text-indigo-600 bg-indigo-50', small: true },
    ];
  }, [data]);

  const planUsage = useMemo(() => {
    if (!data) return [];
    const byPlan = {};
    for (const c of data.subs) {
      const sub = c.subscription;
      if (!sub?.plan_id) continue;
      if (!byPlan[sub.plan_id]) byPlan[sub.plan_id] = { name: sub.plan_name || 'Plano', price: c.plan?.price || 0, active: 0, total: 0 };
      byPlan[sub.plan_id].total += 1;
      if (sub.status === 'active') byPlan[sub.plan_id].active += 1;
    }
    return Object.values(byPlan).sort((a, b) => b.total - a.total);
  }, [data]);

  const subStatusRows = useMemo(() => {
    if (!data) return [];
    const counts = { trial: 0, active: 0, past_due: 0, suspended: 0, cancelled: 0, none: 0 };
    for (const c of data.subs) {
      const key = c.subscription?.status || 'none';
      counts[key] = (counts[key] || 0) + 1;
    }
    return Object.entries(counts).map(([key, count]) => ({ key, count }));
  }, [data]);

  const companyStatusRows = useMemo(() => {
    if (!data) return [];
    const counts = { active: 0, trial: 0, suspended: 0, inactive: 0 };
    for (const c of data.companies) counts[c.status] = (counts[c.status] || 0) + 1;
    return Object.entries(counts).map(([key, count]) => ({ key, count }));
  }, [data]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <LayoutDashboard className="w-6 h-6 text-indigo-600" /> Dashboard da Plataforma
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Visão agregada de empresas, assinaturas e uso por plano do CimentoPro
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
            {stats.map(({ label, value, icon: Icon, tone, small }) => (
              <div key={label} className="bg-white border border-slate-200 rounded-xl p-5">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${tone}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <p className={`font-bold text-slate-900 mt-3 ${small ? 'text-xl' : 'text-2xl'}`}>{value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-900 text-sm">Uso por plano</h2>
                <Link to="/admin/plans" className="text-xs text-indigo-600 hover:underline inline-flex items-center gap-1">
                  Gerenciar planos <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="mt-3 space-y-2">
                {planUsage.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">Nenhuma assinatura registrada.</p>
                ) : planUsage.map((p) => (
                  <div key={p.name} className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{p.name}</p>
                      <p className="text-[11px] text-slate-500">{fmtBRL(p.price || 0)}/mês · {p.active} ativa(s)</p>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold">
                      {p.total} empresa(s)
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <div className="space-y-4">
              <section className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-slate-900 text-sm">Situação das assinaturas</h2>
                  <Link to="/admin/subscriptions" className="text-xs text-indigo-600 hover:underline inline-flex items-center gap-1">
                    Assinaturas <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {subStatusRows.map(({ key, count }) => (
                    <div key={key} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full border text-[11px] font-medium ${SUB_STATUS_STYLES[key]}`}>
                        {SUB_LABELS[key]}
                      </span>
                      <span className="text-sm font-bold text-slate-900">{count}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-slate-900 text-sm">Empresas por status</h2>
                  <Link to="/admin/status" className="text-xs text-indigo-600 hover:underline inline-flex items-center gap-1">
                    Ver empresas <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {companyStatusRows.map(({ key, count }) => (
                    <div key={key} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full border text-[11px] font-medium ${COMPANY_STATUS_STYLES[key]}`}>
                        {COMPANY_LABELS[key]}
                      </span>
                      <span className="text-sm font-bold text-slate-900">{count}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}