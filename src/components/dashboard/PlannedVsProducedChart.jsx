import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const BLUE = '#2563eb';
const AMBER = '#f59e0b';

export default function PlannedVsProducedChart({ orders }) {
  const data = useMemo(() => {
    const byMachine = {};
    orders.filter((o) => o.status === 'Concluída' && o.machine_name).forEach((o) => {
      const name = o.machine_name;
      if (!byMachine[name]) byMachine[name] = { name, planned: 0, actual: 0 };
      byMachine[name].planned += Number(o.planned_quantity) || 0;
      byMachine[name].actual += Number(o.actual_quantity) || 0;
    });
    return Object.values(byMachine).sort((a, b) => b.actual - a.actual).slice(0, 8);
  }, [orders]);

  if (data.length === 0) {
    return <div className="h-64 flex items-center justify-center text-sm text-slate-400">Sem dados</div>;
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} angle={-15} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => v.toLocaleString('pt-BR')} />
          <Tooltip formatter={(v) => v.toLocaleString('pt-BR')} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="planned" name="Planejado" fill={AMBER} radius={[3, 3, 0, 0]} />
          <Bar dataKey="actual" name="Produzido" fill={BLUE} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}