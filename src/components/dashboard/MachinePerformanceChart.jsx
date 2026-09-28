import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const BLUE = '#2563eb';
const AMBER = '#f59e0b';
const RED = '#ef4444';

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs space-y-1 min-w-[160px]">
      <p className="font-semibold text-slate-800">{d.name}</p>
      <div className="flex justify-between gap-4"><span className="text-slate-500">Produção:</span><span className="font-semibold">{(d.actual || 0).toLocaleString('pt-BR')} un</span></div>
      <div className="flex justify-between gap-4"><span className="text-slate-500">Meta:</span><span className="font-semibold">{(d.planned || 0).toLocaleString('pt-BR')} un</span></div>
      <div className="flex justify-between gap-4"><span className="text-slate-500">Eficiência:</span><span className="font-semibold">{d.efficiency != null ? `${d.efficiency.toFixed(1)}%` : '—'}</span></div>
      <div className="flex justify-between gap-4"><span className="text-slate-500">Un/h:</span><span className="font-semibold">{(d.perHour || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span></div>
      <div className="flex justify-between gap-4"><span className="text-slate-500">Ordens:</span><span className="font-semibold">{d.orders}</span></div>
    </div>
  );
}

export default function MachinePerformanceChart({ orders }) {
  const { data, tableRows } = useMemo(() => {
    const byMachine = {};
    orders.filter((o) => o.status === 'Concluída' && o.machine_name).forEach((o) => {
      const name = o.machine_name;
      if (!byMachine[name]) byMachine[name] = { name, planned: 0, actual: 0, minutes: 0, orders: 0 };
      byMachine[name].planned += Number(o.planned_quantity) || 0;
      byMachine[name].actual += Number(o.actual_quantity) || 0;
      byMachine[name].minutes += Number(o.production_minutes) || 0;
      byMachine[name].orders += 1;
    });
    const rows = Object.values(byMachine).map((m) => ({
      ...m,
      efficiency: m.planned > 0 ? (m.actual / m.planned) * 100 : null,
      perHour: m.minutes > 0 ? (m.actual / m.minutes) * 60 : 0,
    })).sort((a, b) => b.actual - a.actual);
    return { data: rows, tableRows: rows };
  }, [orders]);

  if (data.length === 0) {
    return <div className="h-64 flex items-center justify-center text-sm text-slate-400">Sem dados</div>;
  }

  const table = (
    <div className="overflow-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-slate-400 border-b border-slate-200">
            <th className="py-2 pr-3 font-semibold">Máquina</th>
            <th className="py-2 px-3 font-semibold text-right">Produção</th>
            <th className="py-2 px-3 font-semibold text-right">Meta</th>
            <th className="py-2 px-3 font-semibold text-right">Eficiência</th>
            <th className="py-2 px-3 font-semibold text-right">Un/h</th>
            <th className="py-2 pl-3 font-semibold text-right">Ordens</th>
          </tr>
        </thead>
        <tbody>
          {tableRows.map((r) => (
            <tr key={r.name} className="border-b border-slate-100">
              <td className="py-2 pr-3 font-medium text-slate-700">{r.name}</td>
              <td className="py-2 px-3 text-right text-slate-700">{r.actual.toLocaleString('pt-BR')}</td>
              <td className="py-2 px-3 text-right text-slate-500">{r.planned.toLocaleString('pt-BR')}</td>
              <td className="py-2 px-3 text-right font-semibold" style={{ color: (r.efficiency || 0) >= 95 ? '#16a34a' : (r.efficiency || 0) >= 85 ? '#f59e0b' : '#ef4444' }}>
                {r.efficiency != null ? `${r.efficiency.toFixed(1)}%` : '—'}
              </td>
              <td className="py-2 px-3 text-right text-slate-700">{r.perHour.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</td>
              <td className="py-2 pl-3 text-right text-slate-500">{r.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => v.toLocaleString('pt-BR')} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} width={90} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
            <Bar dataKey="actual" name="Produção" radius={[0, 4, 4, 0]}>
              {data.map((d, i) => <Cell key={i} fill={(d.efficiency || 0) >= 95 ? BLUE : (d.efficiency || 0) >= 85 ? AMBER : RED} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {table}
    </>
  );
}