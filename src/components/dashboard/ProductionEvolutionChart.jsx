import { useMemo } from 'react';
import { LineChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const BLUE = '#2563eb';
const AMBER = '#f59e0b';
const GREEN = '#22c55e';

function movingAverage(arr, key, window = 3) {
  return arr.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = arr.slice(start, i + 1);
    const sum = slice.reduce((s, d) => s + (d[key] || 0), 0);
    return slice.length ? sum / slice.length : 0;
  });
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const eff = d.planned > 0 ? (d.actual / d.planned) * 100 : null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs space-y-1 min-w-[180px]">
      <p className="font-semibold text-slate-800">{label}</p>
      <div className="flex justify-between gap-4"><span className="text-slate-500">Produção:</span><span className="font-semibold text-slate-800">{(d.actual || 0).toLocaleString('pt-BR')} un</span></div>
      <div className="flex justify-between gap-4"><span className="text-slate-500">Meta:</span><span className="font-semibold text-slate-800">{(d.planned || 0).toLocaleString('pt-BR')} un</span></div>
      <div className="flex justify-between gap-4"><span className="text-slate-500">Desvio:</span><span className="font-semibold text-slate-800">{(d.actual - d.planned).toLocaleString('pt-BR')} un</span></div>
      <div className="flex justify-between gap-4"><span className="text-slate-500">Eficiência:</span><span className="font-semibold text-slate-800">{eff != null ? `${eff.toFixed(1)}%` : '—'}</span></div>
    </div>
  );
}

export default function ProductionEvolutionChart({ orders }) {
  const data = useMemo(() => {
    const byDate = {};
    orders.filter((o) => o.status === 'Concluída').forEach((o) => {
      const d = o.production_date;
      if (!byDate[d]) byDate[d] = { date: d, planned: 0, actual: 0 };
      byDate[d].planned += Number(o.planned_quantity) || 0;
      byDate[d].actual += Number(o.actual_quantity) || 0;
    });
    const sorted = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
    const ma = movingAverage(sorted, 'actual', 3);
    return sorted.map((d, i) => ({ ...d, mm: Math.round(ma[i]), label: format(parseISO(d.date), 'dd/MM', { locale: ptBR }) }));
  }, [orders]);

  if (data.length === 0) {
    return <div className="h-64 flex items-center justify-center text-sm text-slate-400">Sem dados</div>;
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BLUE} stopOpacity={0.18} />
              <stop offset="100%" stopColor={BLUE} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => v.toLocaleString('pt-BR')} />
          <Tooltip content={<CustomTooltip />} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          <Area type="monotone" dataKey="actual" stroke="none" fill="url(#gradActual)" />
          <Line type="monotone" dataKey="actual" name="Produção Realizada" stroke={BLUE} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="planned" name="Meta" stroke={AMBER} strokeWidth={2} strokeDasharray="5 4" dot={false} />
          <Line type="monotone" dataKey="mm" name="Média Móvel" stroke={GREEN} strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}