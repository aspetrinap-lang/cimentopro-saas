import { useMemo } from 'react';
import { fmtBRL, orderLostCost, orderExcessCost } from '@/lib/statsUtils';
import { formatDateBR } from '@/lib/dateFormat';

// Top 5 lotes (ordens) com maior desperdício: peças perdidas (2ª linha + descarte)
// valorizadas ao custo unitário de produção da ordem — mesma fórmula do KPI e do
// card de Perdas. O excesso de consumo de insumos aparece em coluna separada para
// não ser confundido com o custo das peças perdidas.
export default function TopWasteLotsTable({ orders, ptMap, traceMap, costs, limit }) {
  const rows = useMemo(() => {
    const concluded = orders.filter((o) => o.status === 'Concluída' && o.actual_quantity > 0);
    const lots = concluded.map((o) => {
      const lost = (Number(o.loss_second_line) || 0) + (Number(o.loss_discarded) || 0);
      const lostCost = orderLostCost(o, costs);
      const excessCost = orderExcessCost(o, costs, ptMap, traceMap);
      return {
        id: o.id,
        date: o.production_date,
        order: o.order_number || '—',
        product: o.product_type_name || '—',
        lost,
        lostCost,
        excessCost,
      };
    });
    const filtered = lots
      .filter((l) => l.lostCost > 0 || l.excessCost > 0)
      .sort((a, b) => b.lostCost - a.lostCost);
    return limit ? filtered.slice(0, limit) : filtered;
  }, [orders, ptMap, traceMap, costs, limit]);

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
            <th className="py-2 px-2 font-semibold text-right">Perdas (pçs)</th>
            <th className="py-2 px-2 font-semibold text-right">Custo das perdas (R$)</th>
            <th className="py-2 pl-2 font-semibold text-right">Excesso de consumo (R$)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className="border-b border-slate-100">
              <td className="py-2 pr-2 text-slate-400">{i + 1}</td>
              <td className="py-2 px-2 text-slate-700">{formatDateBR(r.date)}</td>
              <td className="py-2 px-2 font-medium text-slate-700">{r.order}</td>
              <td className="py-2 px-2 text-slate-700">{r.product}</td>
              <td className="py-2 px-2 text-right text-slate-700">{r.lost.toLocaleString('pt-BR')}</td>
              <td className="py-2 px-2 text-right font-semibold text-red-600">{fmtBRL(r.lostCost)}</td>
              <td className="py-2 pl-2 text-right text-slate-500">{fmtBRL(r.excessCost)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}