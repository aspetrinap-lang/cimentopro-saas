import { useMemo } from 'react';

const fmtInt = (n) => (Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });

// Produtividade por hora: tabela máquina × artefato com un/h, ciclos/h e
// unidades/molde. Derivado das ordens concluídas — sem novas consultas.
export default function ProductivityTable({ orders }) {
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
        perHour: r.minutes > 0 ? (r.qty / r.minutes) * 60 : 0,
        cyclesPerHour: r.minutes > 0 ? (r.cycles / r.minutes) * 60 : 0,
        perMold: r.cycles > 0 ? r.qty / r.cycles : 0,
      }))
      .sort((a, b) => b.perHour - a.perHour)
      .slice(0, 12);
  }, [orders]);

  if (rows.length === 0) {
    return <div className="text-sm text-slate-400 text-center py-6">Sem dados</div>;
  }

  return (
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
}