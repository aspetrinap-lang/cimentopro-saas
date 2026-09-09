import { useEffect, useState } from 'react';
import { scopedFilter } from '@/lib/companyScope';
import { base44 } from '@/api/base44Client';
import { ClipboardList } from 'lucide-react';
import ReportSheet from './ReportSheet';
import Section from './Section';
import InsumoDeviationTable from './InsumoDeviationTable';
import { inRange, pctBR } from '@/lib/reportUtils';

const fmtInt = (n) => (Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });

// Ficha técnica das Ordens de Produção: listagem do período com desvio de
// consumo por insumo (mesmo critério da ficha técnica da ordem).
export default function OrdersReport({ onClose }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.entities.ProductionOrder.filter(scopedFilter({}), '-production_date', 2000),
      base44.entities.ProductType.filter(scopedFilter({}), 'name', 500),
    ]).then(([orders, productTypes]) => setData({ orders, productTypes }));
  }, []);

  return (
    <ReportSheet
      title="Ficha Técnica — Ordens de Produção"
      subtitle="Listagem de ordens do período com desempenho e desvio de consumo por insumo"
      icon={ClipboardList}
      onClose={onClose}
    >
      {({ start, end }) =>
        !data ? (
          <p className="text-sm text-slate-500 text-center py-10">Carregando dados do período...</p>
        ) : (
          <Content data={data} start={start} end={end} />
        )
      }
    </ReportSheet>
  );
}

function Content({ data, start, end }) {
  const { orders, productTypes } = data;
  const ptMap = {};
  productTypes.forEach((p) => { ptMap[p.id] = p; });

  const inOrders = orders.filter((o) => inRange(o.production_date, start, end));
  const concluded = inOrders.filter((o) => o.status === 'Concluída');

  const planned = inOrders.reduce((s, o) => s + (Number(o.planned_quantity) || 0), 0);
  const produced = inOrders.reduce((s, o) => s + (Number(o.actual_quantity) || 0), 0);
  const achievement = planned > 0 ? (produced / planned) * 100 : null;

  const statusCounts = {};
  inOrders.forEach((o) => { statusCounts[o.status || '—'] = (statusCounts[o.status || '—'] || 0) + 1; });

  return (
    <>
      <Section title="Resumo do período">
        <p className="text-xs text-slate-600 leading-relaxed">
          <strong>{inOrders.length}</strong> ordem(ns) no período —{' '}
          {Object.entries(statusCounts).map(([s, n]) => `${n} ${s.toLowerCase()}(s)`).join(', ')}.
          Planejado: <strong>{fmtInt(planned)}</strong> un · Produzido: <strong>{fmtInt(produced)}</strong> un ·
          Atingimento: <strong>{pctBR(achievement, 1)}</strong>.
        </p>
      </Section>

      <Section title="Ordens do período">
        {inOrders.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhuma ordem registrada no período.</p>
        ) : (
          <>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-300">
                  <th className="py-1.5 font-semibold">Ordem</th>
                  <th className="py-1.5 font-semibold">Data</th>
                  <th className="py-1.5 font-semibold">Artefato</th>
                  <th className="py-1.5 font-semibold">Máquina</th>
                  <th className="py-1.5 font-semibold text-right">Plan.</th>
                  <th className="py-1.5 font-semibold text-right">Prod.</th>
                  <th className="py-1.5 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {inOrders.slice(0, 60).map((o) => (
                  <tr key={o.id} className="border-b border-slate-200">
                    <td className="py-1 font-medium text-slate-900 whitespace-nowrap">{o.order_number}</td>
                    <td className="py-1 text-slate-600 whitespace-nowrap">{o.production_date}</td>
                    <td className="py-1 text-slate-600">{o.product_type_name || '—'}</td>
                    <td className="py-1 text-slate-600">{o.machine_name || '—'}</td>
                    <td className="py-1 text-right">{fmtInt(o.planned_quantity)}</td>
                    <td className="py-1 text-right">{o.actual_quantity != null ? fmtInt(o.actual_quantity) : '—'}</td>
                    <td className="py-1 text-center text-slate-600 whitespace-nowrap">{o.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {inOrders.length > 60 && (
              <p className="text-[10px] text-slate-500 mt-1.5">
                Exibindo as 60 primeiras de {inOrders.length} ordens do período.
              </p>
            )}
          </>
        )}
      </Section>

      <Section title="Desvio de consumo por insumo (ordens concluídas)">
        <InsumoDeviationTable orders={concluded} ptMap={ptMap} />
      </Section>

      <Section title="Como ler esta ficha">
        <p className="text-xs text-slate-600 leading-relaxed">
          <strong>Plan./Prod.</strong> são as quantidades planejada e produzida da ordem.
          <strong> Desvio de consumo</strong> compara o teórico (produzido × consumo por unidade do artefato) com o real
          lançado por insumo — positivo (vermelho) indica consumo acima do esperado.
        </p>
      </Section>
    </>
  );
}