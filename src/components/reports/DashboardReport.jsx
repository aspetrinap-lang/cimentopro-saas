import { useEffect, useState } from 'react';
import { scopedFilter } from '@/lib/companyScope';
import { base44 } from '@/api/base44Client';
import { BarChart3 } from 'lucide-react';
import ReportSheet from './ReportSheet';
import Section from './Section';
import { inRange, pctBR, avgDeviationByInsumo } from '@/lib/reportUtils';
import { useInsumoNames } from '@/hooks/useInsumoNames';
import { useInsumoCosts } from '@/hooks/useInsumoCosts';
import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';
import { fmtBRL } from '@/lib/statsUtils';

const fmtInt = (n) => (Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });

// Ficha técnica dos Indicadores (Dashboard): produção, perdas, consumo e
// custo de insumos por artefato no período selecionado.
export default function DashboardReport({ initialStart, onClose }) {
  const [data, setData] = useState(null);
  const { names } = useInsumoNames();
  const { costs } = useInsumoCosts();

  useEffect(() => {
    Promise.all([
      base44.entities.ProductionOrder.filter(scopedFilter({}), '-production_date', 2000),
      base44.entities.ProductType.filter(scopedFilter({}), 'name', 500),
    ]).then(([orders, productTypes]) => setData({ orders, productTypes }));
  }, []);

  return (
    <ReportSheet
      title="Ficha Técnica — Indicadores"
      subtitle="Produção, perdas, consumo e custo de insumos por artefato no período"
      icon={BarChart3}
      initialStart={initialStart}
      onClose={onClose}
    >
      {({ start, end }) =>
        !data ? (
          <p className="text-sm text-slate-500 text-center py-10">Carregando dados do período...</p>
        ) : (
          <Content data={data} start={start} end={end} names={names} costs={costs} />
        )
      }
    </ReportSheet>
  );
}

function Content({ data, start, end, names, costs }) {
  const { orders, productTypes } = data;
  const ptMap = {};
  productTypes.forEach((p) => { ptMap[p.id] = p; });

  const inOrders = orders.filter((o) => inRange(o.production_date, start, end));
  const withActual = inOrders.filter((o) => Number(o.actual_quantity) > 0);

  const planned = inOrders.reduce((s, o) => s + (Number(o.planned_quantity) || 0), 0);
  const produced = withActual.reduce((s, o) => s + Number(o.actual_quantity), 0);
  const losses = withActual.reduce((s, o) => s + (Number(o.loss_second_line) || 0) + (Number(o.loss_discarded) || 0), 0);
  const achievement = planned > 0 ? (produced / planned) * 100 : null;
  const lossPct = produced > 0 ? (losses / produced) * 100 : null;

  const byProduct = {};
  withActual.forEach((o) => {
    const name = o.product_type_name || 'Outros';
    if (!byProduct[name]) byProduct[name] = { name, orders: 0, produced: 0, second: 0, discarded: 0, cement: 0, insumoCost: 0 };
    const r = byProduct[name];
    r.orders += 1;
    r.produced += Number(o.actual_quantity);
    r.second += Number(o.loss_second_line) || 0;
    r.discarded += Number(o.loss_discarded) || 0;
    INSUMO_KEYS.forEach((key) => {
      const qty = Number(o[INSUMO_FIELDS[key].actual]) || 0;
      if (key === 'cement') r.cement += qty;
      r.insumoCost += qty * (Number(costs?.[key]) || 0);
    });
  });
  const rows = Object.values(byProduct).sort((a, b) => b.produced - a.produced);

  const devs = avgDeviationByInsumo(withActual, ptMap).filter((d) => d.count > 0);

  return (
    <>
      <Section title="Resumo do período">
        <p className="text-xs text-slate-600 leading-relaxed">
          <strong>{inOrders.length}</strong> ordem(ns) no período, das quais <strong>{withActual.length}</strong> com produção lançada.
          Produção total: <strong>{fmtInt(produced)}</strong> unidades (planejado: {fmtInt(planned)}).
          Atingimento do planejado: <strong>{pctBR(achievement, 1)}</strong>.
          Perdas (2ª linha + descarte): <strong>{fmtInt(losses)}</strong> unidades ({pctBR(lossPct, 2)} do produzido).
        </p>
      </Section>

      <Section title="Indicadores por artefato">
        {rows.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhuma produção lançada no período.</p>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-300">
                <th className="py-1.5 font-semibold">Artefato</th>
                <th className="py-1.5 font-semibold text-right">Ordens</th>
                <th className="py-1.5 font-semibold text-right">Produzido</th>
                <th className="py-1.5 font-semibold text-right">2ª linha</th>
                <th className="py-1.5 font-semibold text-right">Descarte</th>
                <th className="py-1.5 font-semibold text-right">Cimento real (kg)</th>
                <th className="py-1.5 font-semibold text-right">Custo insumos/un</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-b border-slate-200">
                  <td className="py-1.5 font-medium text-slate-900">{r.name}</td>
                  <td className="py-1.5 text-right">{r.orders}</td>
                  <td className="py-1.5 text-right">{fmtInt(r.produced)}</td>
                  <td className="py-1.5 text-right">{r.second > 0 ? fmtInt(r.second) : '—'}</td>
                  <td className="py-1.5 text-right">{r.discarded > 0 ? fmtInt(r.discarded) : '—'}</td>
                  <td className="py-1.5 text-right">{r.cement > 0 ? fmtInt(r.cement) : '—'}</td>
                  <td className="py-1.5 text-right">{r.produced > 0 && r.insumoCost > 0 ? fmtBRL(r.insumoCost / r.produced) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Desvio médio de consumo por insumo">
        {devs.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhum lançamento de consumo real no período.</p>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-300">
                <th className="py-1.5 font-semibold">Insumo</th>
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

      <Section title="Como ler esta ficha">
        <p className="text-xs text-slate-600 leading-relaxed">
          <strong>Atingimento</strong> = produzido ÷ planejado. <strong>Perdas</strong> somam peças de 2ª linha e descartadas.
          <strong> Desvio de consumo</strong> compara o teórico (produzido × consumo por unidade do artefato) com o real
          lançado — acima do teórico indica perda de material; abaixo, consumo mais eficiente.
        </p>
      </Section>
    </>
  );
}