import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const COLORS = ['#2563eb', '#0ea5e9', '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#f97316'];

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs space-y-1 min-w-[140px]">
      <p className="font-semibold text-slate-800">{d.name}</p>
      <div className="flex justify-between gap-4"><span className="text-slate-500">Quantidade:</span><span className="font-semibold">{(d.qty || 0).toLocaleString('pt-BR')} un</span></div>
      <div className="flex justify-between gap-4"><span className="text-slate-500">Participação:</span><span className="font-semibold">{(d.pct || 0).toFixed(1)}%</span></div>
    </div>
  );
}

export default function ProductionMixChart({ orders, limit }) {
  const data = useMemo(() => {
    const byProduct = {};
    orders.filter((o) => o.status === 'Concluída').forEach((o) => {
      const name = o.product_type_name || 'Desconhecido';
      byProduct[name] = (byProduct[name] || 0) + (Number(o.actual_quantity) || 0);
    });
    const total = Object.values(byProduct).reduce((s, v) => s + v, 0);
    const rows = Object.entries(byProduct)
      .map(([name, qty]) => ({ name, qty, pct: total > 0 ? (qty / total) * 100 : 0 }))
      .sort((a, b) => b.qty - a.qty);
    return limit ? rows.slice(0, limit) : rows;
  }, [orders, limit]);

  if (data.length === 0) {
    return <div className="h-full min-h-[280px] flex items-center justify-center text-sm text-slate-400">Sem dados</div>;
  }

  return (
    <div className="h-full min-h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `${v}%`} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} width={110} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
          <Bar dataKey="pct" name="Participação" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}