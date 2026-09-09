import { useEffect, useState } from 'react';
import { scopedFilter } from '@/lib/companyScope';
import { base44 } from '@/api/base44Client';
import { History } from 'lucide-react';
import ReportSheet from './ReportSheet';
import Section from './Section';
import InsumoDeviationTable from './InsumoDeviationTable';
import { inRange, avgDeviationByInsumo } from '@/lib/reportUtils';
import { useInsumoNames } from '@/hooks/useInsumoNames';

const fmtInt = (n) => (Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });

// Ficha técnica do Histórico: ordens concluídas do período com desvio de
// consumo por insumo (critério consumptionDeviation — teórico × real).
export default function HistoryReport({ initialStart, initialEnd, initialProduct, onClose }) {
  const [data, setData] = useState(null);
  const { names } = useInsumoNames();

  useEffect(() => {
    Promise.all([
      base44.entities.ProductionOrder.filter(scopedFilter({ status: 'Concluída' }), '-production_date', 2000),
      base44.entities.ProductType.filter(scopedFilter({}), 'name', 500),
    ]).then(([orders, productTypes]) => setData({ orders, productTypes }));
  }, []);

  return (
    <ReportSheet
      title="Ficha Técnica — Histórico de Produção"
      subtitle="Ordens concluídas com análise de desvio de consumo por insumo"
      icon={History}
      initialStart={initialStart}
      initialEnd={initialEnd}
      onClose={onClose}
    >
      {({ start, end }) =>
        !data ? (
          <p className="text-sm text-slate-500 text-center py-10">Carregando dados do período...</p>
        ) : (
          <Content data={data} start={start} end={end} initialProduct={initialProduct} names={names} />
        )
      }
    </ReportSheet>
  );
}

function Content({ data, start, end, initialProduct, names }) {
  const { orders, productTypes } = data;
  const ptMap = {};
  productTypes.forEach((p) => { ptMap[p.id] = p; });

  const inOrders = orders.filter((o) => {
    if (!inRange(o.production_date, start, end)) return false;
    if (initialProduct && o.product_type_id !== initialProduct) return false;
    return true;
  });

  const produced = inOrders.reduce((s, o) => s + (Number(o.actual_quantity) || 0), 0);
  const losses = inOrders.reduce((s, o) => s + (Number(o.loss_second_line) || 0) + (Number(o.loss_discarded) || 0), 0);
  const artifact = initialProduct ? (ptMap[initialProduct]?.name || '—') : 'Todos os artefatos';

  const devs = avgDeviationByInsumo(inOrders, ptMap).filter((d) => d.count > 0);

  return (
    <>
      <Section title="Resumo do período">
        <p className="text-xs text-slate-600 leading-relaxed">
          <strong>{inOrders.length}</strong> ordem(ns) concluída(s) — artefato: <strong>{artifact}</strong>.
          Produção total: <strong>{fmtInt(produced)}</strong> unidades · Perdas (2ª linha + descarte):{' '}
          <strong>{fmtInt(losses)}</strong> unidades.
        </p>
      </Section>

      <Section title="Desvio médio de consumo por insumo">
        {devs.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhum lançamento de consumo real no período.</p>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-300">
                <th className="py-1.5 font-semibold">Insumo</th>
                <th className="py-1.5 font-semibold text-right">Ordens</th>
                <th className="py-1.5 font-semibold text-right">Teórico</th>
                <th className="py-1.5 font-semibold text-right">Real</th>
                <th className="py-1.5 font-semibold text-right">Desvio</th>
                <th className="py-1.5 font-semibold text-right">Desvio %</th>
              </tr>
            </thead>
            <tbody>
              {devs.map((d) => (
                <tr key={d.key} className="border-b border-slate-200">
                  <td className="py-1.5 font-medium text-slate-900">{names[d.key]}</td>
                  <td className="py-1.5 text-right">{d.count}</td>
                  <td className="py-1.5 text-right">{fmtInt(d.theoretical)}</td>
                  <td className="py-1.5 text-right">{fmtInt(d.actual)}</td>
                  <td className={`py-1.5 text-right font-medium ${d.lossPct > 0 ? 'text-red-600' : 'text-green-700'}`}>
                    {d.deviation > 0 ? '+' : ''}{fmtInt(d.deviation)}
                  </td>
                  <td className={`py-1.5 text-right font-semibold ${d.lossPct > 0 ? 'text-red-600' : 'text-green-700'}`}>
                    {d.lossPct > 0 ? '+' : ''}{d.lossPct.toFixed(1).replace('.', ',')}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Ordens concluídas — desvio por insumo">
        <InsumoDeviationTable orders={inOrders} ptMap={ptMap} />
      </Section>

      <Section title="Como ler esta ficha">
        <p className="text-xs text-slate-600 leading-relaxed">
          O desvio de cada insumo usa o consumo teórico (quantidade produzida × consumo por unidade do artefato)
          contra o consumo real lançado na ordem — o mesmo critério da ficha técnica da ordem.
          Desvio positivo (vermelho) indica consumo acima do teórico; negativo (verde), consumo mais eficiente.
        </p>
      </Section>
    </>
  );
}