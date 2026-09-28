import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const COLORS = ['#2563eb', '#0ea5e9', '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#f97316'];
const fmtInt = (n) => (Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs space-y-1 min-w-[160px]">
      <p className="font-semibold text-slate-800">{d.label}</p>
      <div className="flex justify-between gap-4"><span className="text-slate-500">un/h:</span><span className="font-semibold">{fmtInt(d.perHour)}</span></div>
      <div className="flex justify-between gap-4"><span className="text-slate-500">Ciclos/h:</span><span className="font-semibold">{fmtInt(d.cyclesPerHour)}</span></div>
      <div className="flex justify-between gap-4"><span className="text-slate-500">Un/molde:</span><span className="font-semibold">{d.perMold.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</span></div>
      <div className="flex justify-between gap-4"><span className="text-slate-500">Ordens:</span><span className="font-semibold">{d.orders}</span></div>
    </div>
  );
}

export default function ProductivityTable({ orders, limit, view }) {
  const rows = useMemo(() => {
    const byKey = {};
    orders.filter((o) => o.status === 'Concluída' && o.actual_quantity > 0).forEach((o) => {
      const machine = o.machine_name || 'Sem máquina';
      const product = o.product_type_name || '—';
      const key = `${machine}||${product}`;
      if (!byKey[key]) byKey[key] = { machine, product, qty: 0, minutes: 0, cycles: 0, orders: 0 };
      byKey[key].qty += Number(o.actual_quantity) || 0;
      byKey[key].minutes += Number(o.production_minutes) || 0;
      byKey[key].cycles += Number(o.machine_cycles_actual) || 0;
      byKey[key].orders += 1;
    });
    return Object.values(byKey)
      .map((r) => ({
        ...r,
        label: `${r.machine} / ${r.product}`,
        perHour: r.minutes > 0 ? (r.qty / r.minutes) * 60 : 0,
        cyclesPerHour: r.minutes > 0 ? (r.cycles / r.minutes) * 60 : 0,
        perMold: r.cycles > 0 ? r.qty / r.cycles : 0,
      }))
      .sort((a, b) => b.perHour - a.perHour);
  }, [orders]);

  if (rows.length === 0) {
    return <div className="h-full min-h-[280px] flex items-center justify-center text-sm text-slate-400">Sem dados</div>;
  }

  const data = limit ? rows.slice(0, limit) : rows;

  const table = (
    <div className="overflow-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-slate-400 border-b border-slate-200">
            <th className="py-2 pr-2 font-semibold">Máquina</th>
            <th className="py-2 px-2 font-semibold">Artefato</th>
            <th className="py-2 px-2 font-semibold text-right">un/h</th>
            <th className="py-2 px-2 font-semibold text-right">Ciclos/h</th>
            <th className="py-2 pl-2 font-semibold text-right">Un/molde</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-100">
              <td className="py-2 pr-2 font-medium text-slate-700">{r.machine}</td>
              <td className="py-2 px-2 text-slate-700">{r.product}</td>
              <td className="py-2 px-2 text-right text-slate-700">{fmtInt(r.perHour)}</td>
              <td className="py-2 px-2 text-right text-slate-700">{fmtInt(r.cyclesPerHour)}</td>
              <td className="py-2 pl-2 text-right text-slate-700">{r.perMold.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (view === 'table') {
    return table;
  }

  return (
    <div className="h-full min-h-[280px] flex flex-col">
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => fmtInt(v)} />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} width={130} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
            <Bar dataKey="perHour" name="un/h" radius={[0, 4, 4, 0]}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}