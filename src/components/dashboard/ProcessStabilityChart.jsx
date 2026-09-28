import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useInsumoNames } from '@/hooks/useInsumoNames';
import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';
import { computeStats } from '@/lib/statsUtils';

const GREEN = '#22c55e';
const AMBER = '#f59e0b';
const RED = '#ef4444';

function colorFor(cv) {
  if (cv == null) return '#94a3b8';
  if (cv <= 5) return GREEN;
  if (cv <= 10) return AMBER;
  return RED;
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs space-y-1 min-w-[140px]">
      <p className="font-semibold text-slate-800">{d.name}</p>
      <div className="flex justify-between gap-4"><span className="text-slate-500">CV:</span><span className="font-semibold">{d.cv != null ? `${d.cv.toFixed(2)}%` : '—'}</span></div>
      <div className="flex justify-between gap-4"><span className="text-slate-500">Amostras:</span><span className="font-semibold">{d.count}</span></div>
    </div>
  );
}

export default function ProcessStabilityChart({ orders, limit }) {
  const { names } = useInsumoNames();
  const { data, avgCV } = useMemo(() => {
    const concluded = orders.filter((o) => o.status === 'Concluída' && o.actual_quantity > 0);
    const rows = INSUMO_KEYS.map((key) => {
      const values = concluded
        .map((o) => (Number(o[INSUMO_FIELDS[key].actual]) || 0) / o.actual_quantity)
        .filter((v) => v > 0);
      const s = computeStats(values);
      return { name: names[key], cv: s && s.count >= 2 ? s.cv : null, count: values.length };
    }).filter((d) => d.cv != null);
    const sorted = [...rows].sort((a, b) => (a.cv ?? Infinity) - (b.cv ?? Infinity));
    const limited = limit ? sorted.slice(0, limit) : sorted;
    const cvs = limited.map((r) => r.cv).filter((v) => v != null);
    const avg = cvs.length ? cvs.reduce((a, b) => a + b, 0) / cvs.length : null;
    return { data: limited, avgCV: avg };
  }, [orders, names, limit]);

  if (data.length === 0) {
    return <div className="h-full min-h-[280px] flex items-center justify-center text-sm text-slate-400">Sem dados</div>;
  }

  return (
    <div className="h-full min-h-[280px] flex flex-col">
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `${v}%`} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} width={100} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
            <Bar dataKey="cv" name="CV" radius={[0, 4, 4, 0]}>
              {data.map((d, i) => <Cell key={i} fill={colorFor(d.cv)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}