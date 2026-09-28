import { useMemo } from 'react';
import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';
import { theoreticalForOrder, fmtBRL } from '@/lib/statsUtils';

// Top 5 lotes (ordens) com maior desperdício: peças perdidas e custo do excesso
// de consumo (real acima do teórico). Reutiliza a lógica de traço existente.
export default function TopWasteLotsTable({ orders, ptMap, traceMap, costs }) {
  const rows = useMemo(() => {
    const concluded = orders.filter((o) => o.status === 'Concluída' && o.actual_quantity > 0);
    const lots = concluded.map((o) => {
      const lost = (Number(o.loss_second_line) || 0) + (Number(o.loss_discarded) || 0);
      let excessCost = 0;
      INSUMO_KEYS.forEach((k) => {
        const real = Number(o[INSUMO_FIELDS[k].actual]) || 0;
        const theo = theoreticalForOrder(o, k, ptMap, traceMap);
        if (theo > 0 && real > theo) excessCost += (real - theo) * (costs[k] || 0);
      });
      return {
        id: o.id,
        date: o.production_date,
        order: o.order_number || '—',
        product: o.product_type_name || '—',
        lost,
        excessCost,
      };
    });
    return lots.filter((l) => l.lost > 0 || l.excessCost > 0).sort((a, b) => b.excessCost - a.excessCost).slice(0, 5);
  }, [orders, ptMap, traceMap, costs]);

  if (rows.length === 0) {
    return <div className="text-sm text-slate-400 text-center py-6">Nenhum desperdício registrado no período.</div>;
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-slate-400 border-b border-slate-200">
            <th className="py-2 pr-2 font-semibold w-6">#</th>
            <th className="py-2 px-2 font-semibold">Data</th>
            <th className="py-2 px-2 font-semibold">Ordem</th>
            <th className="py-2 px-2 font-semibold">Produto</th>
            <th className="py-2 px-2 font-semibold text-right">Desperdício (un)</th>
            <th className="py-2 pl-2 font-semibold text-right">Desperdício (R$)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className="border-b border-slate-100">
              <td className="py-2 pr-2 text-slate-400">{i + 1}</td>
              <td className="py-2 px-2 text-slate-700">{r.date ? new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</td>
              <td className="py-2 px-2 font-medium text-slate-700">{r.order}</td>
              <td className="py-2 px-2 text-slate-700">{r.product}</td>
              <td className="py-2 px-2 text-right text-slate-700">{r.lost.toLocaleString('pt-BR')}</td>
              <td className="py-2 pl-2 text-right font-semibold text-red-600">{fmtBRL(r.excessCost)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}