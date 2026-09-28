import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from 'recharts';
import { useInsumoNames } from '@/hooks/useInsumoNames';
import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';
import { theoreticalForOrder } from '@/lib/statsUtils';

const GREEN = '#22c55e';
const RED = '#ef4444';

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs space-y-1 min-w-[160px]">
      <p className="font-semibold text-slate-800">{d.name}</p>
      <div className="flex justify-between gap-4"><span className="text-slate-500">Teórico:</span><span className="font-semibold">{(d.theoretical || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg</span></div>
      <div className="flex justify-between gap-4"><span className="text-slate-500">Realizado:</span><span className="font-semibold">{(d.actual || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg</span></div>
      <div className="flex justify-between gap-4"><span className="text-slate-500">Desvio:</span><span className="font-semibold" style={{ color: d.devPct > 0 ? RED : GREEN }}>{d.devPct > 0 ? '+' : ''}{(d.devPct || 0).toFixed(1)}%</span></div>
    </div>
  );
}

export default function ConsumptionDeviationChart({ orders, ptMap, traceMap, limit }) {
  const { names } = useInsumoNames();
  const data = useMemo(() => {
    const concluded = orders.filter((o) => o.status === 'Concluída');
    const rows = INSUMO_KEYS.map((key) => {
      let theoretical = 0, actual = 0;
      concluded.forEach((o) => {
        theoretical += theoreticalForOrder(o, key, ptMap, traceMap);
        actual += Number(o[INSUMO_FIELDS[key].actual]) || 0;
      });
      const devPct = theoretical > 0 ? ((actual - theoretical) / theoretical) * 100 : 0;
      return { name: names[key], theoretical, actual, devPct };
    }).filter((d) => d.theoretical > 0 || d.actual > 0);

    const sorted = [...rows].sort((a, b) => Math.abs(b.devPct) - Math.abs(a.devPct));
    return limit ? sorted.slice(0, limit) : sorted;
  }, [orders, ptMap, traceMap, names, limit]);

  if (data.length === 0) {
    return <div className="h-full min-h-[280px] flex items-center justify-center text-sm text-slate-400">Sem dados</div>;
  }

  return (
    <div className="h-full min-h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `${v}%`} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} width={100} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
          <ReferenceLine x={0} stroke="#cbd5e1" />
          <Bar dataKey="devPct" name="Desvio" radius={[0, 4, 4, 0]}>
            {data.map((d, i) => <Cell key={i} fill={d.devPct > 0 ? RED : GREEN} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}