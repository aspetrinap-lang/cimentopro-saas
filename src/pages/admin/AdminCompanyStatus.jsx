import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Activity, Users, AlertCircle } from 'lucide-react';
import { differenceInDays, format, parseISO } from 'date-fns';

const COMPANY_STATUS_STYLES = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  trial: 'bg-sky-50 text-sky-700 border-sky-200',
  suspended: 'bg-red-50 text-red-700 border-red-200',
  inactive: 'bg-slate-100 text-slate-500 border-slate-200',
};

const COMPANY_LABELS = { active: 'Ativa', trial: 'Trial', suspended: 'Suspensa', inactive: 'Inativa' };

const SUB_STATUS_STYLES = {
  trial: 'bg-sky-50 text-sky-700 border-sky-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  past_due: 'bg-amber-50 text-amber-700 border-amber-200',
  suspended: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
  none: 'bg-slate-100 text-slate-500 border-slate-200',
};

const SUB_LABELS = { trial: 'Trial', active: 'Ativa', past_due: 'Vencida', suspended: 'Suspensa', cancelled: 'Cancelada', none: 'Sem assinatura' };

const FILTERS = [
  { key: '', label: 'Todas' },
  { key: 'active', label: 'Ativas' },
  { key: 'trial', label: 'Trial' },
  { key: 'suspended', label: 'Suspensas' },
  { key: 'inactive', label: 'Inativas' },
  { key: 'no_sub', label: 'Sem assinatura' },
];

// Status das empresas da plataforma: situação da empresa, plano vigente,
// situação da assinatura e vencimento — lista compacta com badges.
export default function AdminCompanyStatus() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    Promise.all([
      base44.functions.invoke('adminCompanies', { action: 'list' }),
      base44.functions.invoke('subscriptionManagement', { action: 'listSubscriptions' }),
    ])
      .then(([c, s]) => setData({
        companies: c.data.companies || [],
        subs: s.data.companies || [],
      }))
      .catch(() => setError(true));
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    const usersById = Object.fromEntries(data.companies.map((c) => [c.id, c.user_count || 0]));
    const list = data.subs.map((c) => ({
      id: c.company_id,
      name: c.company_name,
      company_status: c.company_status,
      subscription: c.subscription,
      plan_name: c.subscription?.plan_name || null,
      user_count: usersById[c.company_id] ?? 0,
    }));
    if (!filter) return list;
    if (filter === 'no_sub') return list.filter((r) => !r.subscription);
    return list.filter((r) => r.company_status === filter);
  }, [data, filter]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Activity className="w-6 h-6 text-indigo-600" /> Status das Empresas
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Situação de cada empresa, plano vigente, assinatura e vencimento
        </p>
      </div>

      {error ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
          Não foi possível carregar os dados. Tente novamente.
        </div>
      ) : !data ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                  filter === key
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {rows.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 text-sm">
              Nenhuma empresa neste filtro.
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
              {rows.map((r) => {
                const subStatus = r.subscription?.status || 'none';
                const end = r.subscription?.end_date;
                let daysLeft = null;
                let endDateLabel = '—';
                if (end) {
                  try {
                    const d = parseISO(end);
                    endDateLabel = format(d, 'dd/MM/yyyy');
                    daysLeft = differenceInDays(d, new Date());
                  } catch { /* data inválida — exibe — */ }
                }
                const expiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7 && subStatus === 'active';
                return (
                  <div key={r.id} className="flex items-center gap-3 px-5 py-3.5 flex-wrap">
                    <div className="flex-1 min-w-[180px]">
                      <p className="text-sm font-semibold text-slate-900">{r.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-flex px-2 py-0.5 rounded-full border text-[11px] font-medium ${COMPANY_STATUS_STYLES[r.company_status] || COMPANY_STATUS_STYLES.inactive}`}>
                          {COMPANY_LABELS[r.company_status] || r.company_status}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                          <Users className="w-3 h-3" /> {r.user_count} usuário(s)
                        </span>
                      </div>
                    </div>
                    <div className="min-w-[140px]">
                      <p className="text-xs text-slate-500">Plano</p>
                      <p className="text-sm font-medium text-slate-800">{r.plan_name || '—'}</p>
                    </div>
                    <div className="min-w-[110px]">
                      <p className="text-xs text-slate-500 mb-1">Assinatura</p>
                      <span className={`inline-flex px-2 py-0.5 rounded-full border text-[11px] font-medium ${SUB_STATUS_STYLES[subStatus]}`}>
                        {SUB_LABELS[subStatus]}
                      </span>
                    </div>
                    <div className="min-w-[150px]">
                      <p className="text-xs text-slate-500">Vencimento</p>
                      <p className="text-sm text-slate-800 flex items-center gap-1.5">
                        {endDateLabel}
                        {expiringSoon && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                            <AlertCircle className="w-3 h-3" /> expira em {daysLeft}d
                          </span>
                        )}
                      </p>
                    </div>
                    <Link
                      to="/admin/subscriptions"
                      className="text-xs text-indigo-600 hover:underline ml-auto shrink-0"
                    >
                      Gerenciar
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}