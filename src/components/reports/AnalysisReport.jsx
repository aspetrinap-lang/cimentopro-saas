import { useEffect, useState } from 'react';
import { scopedFilter } from '@/lib/companyScope';
import { base44 } from '@/api/base44Client';
import { LineChart } from 'lucide-react';
import ReportSheet from './ReportSheet';
import Section from './Section';
import { inRange, pctBR } from '@/lib/reportUtils';
import { useInsumoNames } from '@/hooks/useInsumoNames';
import { useInsumoCosts } from '@/hooks/useInsumoCosts';
import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';
import { fmtBRL } from '@/lib/statsUtils';

const fmtInt = (n) => (Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const fmtDec = (n, d = 1) => (Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: d });

// Ficha técnica da Análise: médias de consumo, desvio de traço e estabilidade
// da produção diária por artefato no período selecionado.
export default function AnalysisReport({ initialStart, initialEnd, initialProducts, onClose }) {
  const [data, setData] = useState(null);
  const { names } = useInsumoNames();
  const { costs } = useInsumoCosts();

  useEffect(() => {
    Promise.all([
      base44.entities.ProductionOrder.filter(scopedFilter({ status: 'Concluída' }), '-production_date', 2000),
      base44.entities.ProductType.filter(scopedFilter({}), 'name', 500),
      base44.entities.ConcreteTrace.filter(scopedFilter({}), 'name', 200),
    ]).then(([orders, productTypes, traces]) => setData({ orders, productTypes, traces }));
  }, []);

  return (
    <ReportSheet
      title="Ficha Técnica — Análise & Relatórios"
      subtitle="Médias de consumo, produtividade por máquina, desvio de traço e estabilidade da produção"
      icon={LineChart}
      initialStart={initialStart}
      initialEnd={initialEnd}
      onClose={onClose}
    >
      {({ start, end }) =>
        !data ? (
          <p className="text-sm text-slate-500 text-center py-10">Carregando dados do período...</p>
        ) : (
          <Content data={data} start={start} end={end} initialProducts={initialProducts} names={names} costs={costs} />
        )
      }
    </ReportSheet>
  );
}

function Content({ data, start, end, initialProducts, names, costs }) {
  const { orders, productTypes, traces } = data;
  const ptMap = {};
  productTypes.forEach((p) => { ptMap[p.id] = p; });
  const traceMap = {};
  traces.forEach((t) => { traceMap[t.id] = t; });

  const inOrders = orders.filter((o) => {
    if (!inRange(o.production_date, start, end)) return false;
    if (initialProducts && initialProducts.length > 0 && !initialProducts.includes(o.product_type_id)) return false;
    return true;
  });

  // Médias por artefato
  const byProduct = {};
  inOrders.forEach((o) => {
    const name = o.product_type_name || 'Outros';
    if (!byProduct[name]) byProduct[name] = { name, ordens: 0, qty: 0, minutes: 0, insumo: {}, cement: 0, cost: 0 };
    const r = byProduct[name];
    r.ordens += 1;
    r.qty += Number(o.actual_quantity) || 0;
    r.minutes += Number(o.production_minutes) || 0;
    INSUMO_KEYS.forEach((key) => {
      const qty = Number(o[INSUMO_FIELDS[key].actual]) || 0;
      r.insumo[key] = (r.insumo[key] || 0) + qty;
      r.cost += qty * (Number(costs?.[key]) || 0);
      if (key === 'cement') r.cement += qty;
    });
  });
  const productRows = Object.values(byProduct).map((r) => ({
    ...r,
    perHour: r.minutes > 0 ? r.qty / (r.minutes / 60) : null,
    costPerUnit: r.qty > 0 ? r.cost / r.qty : 0,
  })).sort((a, b) => b.qty - a.qty);

  // Produtividade por máquina
  const byMachine = {};
  inOrders.forEach((o) => {
    if (!o.machine_name) return;
    if (!byMachine[o.machine_name]) byMachine[o.machine_name] = { name: o.machine_name, ordens: 0, planned: 0, actual: 0, eff: [] };
    const m = byMachine[o.machine_name];
    m.ordens += 1;
    m.planned += Number(o.planned_quantity) || 0;
    m.actual += Number(o.actual_quantity) || 0;
    if (Number(o.planned_quantity) > 0) m.eff.push(((Number(o.actual_quantity) || 0) / Number(o.planned_quantity)) * 100);
  });
  const machineRows = Object.values(byMachine).map((m) => ({
    ...m,
    avgEff: m.eff.length ? m.eff.reduce((a, b) => a + b, 0) / m.eff.length : null,
  })).sort((a, b) => b.actual - a.actual);

  // Desvio de traço (cimento): teórico = traços produzidos × cimento por traço
  const traceRows = {};
  inOrders.forEach((o) => {
    const tracesProduced = Number(o.actual_traces_produced) || 0;
    const pt = ptMap[o.product_type_id];
    const trace = pt && traceMap[pt.concrete_trace_id];
    if (!tracesProduced || !trace || !Number(trace.cement_kg_per_m3)) return;
    const theoretical = tracesProduced * Number(trace.cement_kg_per_m3);
    const actual = Number(o.actual_cement) || 0;
    if (!theoretical || !actual) return;
    const name = o.product_type_name || 'Outros';
    if (!traceRows[name]) traceRows[name] = { name, count: 0, theo: 0, actual: 0 };
    traceRows[name].count += 1;
    traceRows[name].theo += theoretical;
    traceRows[name].actual += actual;
  });
  const traceList = Object.values(traceRows).map((r) => ({
    ...r,
    devPct: r.theo > 0 ? ((r.actual - r.theo) / r.theo) * 100 : null,
  }));

  // Estabilidade diária: CV da produtividade diária (un/h) por artefato
  const daily = {};
  inOrders.forEach((o) => {
    const name = o.product_type_name || 'Outros';
    if (!o.production_date) return;
    if (!daily[name]) daily[name] = {};
    if (!daily[name][o.production_date]) daily[name][o.production_date] = { qty: 0, min: 0 };
    daily[name][o.production_date].qty += Number(o.actual_quantity) || 0;
    daily[name][o.production_date].min += Number(o.production_minutes) || 0;
  });
  const stabilityRows = Object.entries(daily).map(([name, days]) => {
    const rates = Object.values(days).filter((d) => d.min > 0 && d.qty > 0).map((d) => d.qty / (d.min / 60));
    if (rates.length === 0) return { name, days: 0, mean: null, cv: null };
    const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
    const sd = Math.sqrt(rates.reduce((s, r) => s + (r - mean) ** 2, 0) / rates.length);
    return { name, days: rates.length, mean, cv: mean > 0 ? (sd / mean) * 100 : null };
  });

  const totalQty = inOrders.reduce((s, o) => s + (Number(o.actual_quantity) || 0), 0);

  return (
    <>
      <Section title="Resumo do período">
        <p className="text-xs text-slate-600 leading-relaxed">
          <strong>{inOrders.length}</strong> ordem(ns) concluída(s) no período, totalizando{' '}
          <strong>{fmtInt(totalQty)}</strong> unidades produzidas em {productRows.length} artefato(s) e {machineRows.length} máquina(s).
        </p>
      </Section>

      <Section title="Médias de consumo por artefato">
        {productRows.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhuma ordem concluída no período.</p>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-300">
                <th className="py-1.5 font-semibold">Artefato</th>
                <th className="py-1.5 font-semibold text-right">Ordens</th>
                <th className="py-1.5 font-semibold text-right">Produzido</th>
                <th className="py-1.5 font-semibold text-right">Média/h (un)</th>
                <th className="py-1.5 font-semibold text-right">Cimento real/un (kg)</th>
                <th className="py-1.5 font-semibold text-right">Custo insumos/un</th>
              </tr>
            </thead>
            <tbody>
              {productRows.map((r) => (
                <tr key={r.name} className="border-b border-slate-200">
                  <td className="py-1.5 font-medium text-slate-900">{r.name}</td>
                  <td className="py-1.5 text-right">{r.ordens}</td>
                  <td className="py-1.5 text-right">{fmtInt(r.qty)}</td>
                  <td className="py-1.5 text-right">{r.perHour != null ? fmtDec(r.perHour, 1) : '—'}</td>
                  <td className="py-1.5 text-right">{r.qty > 0 && r.cement > 0 ? fmtDec(r.cement / r.qty, 4) : '—'}</td>
                  <td className="py-1.5 text-right">{r.costPerUnit > 0 ? fmtBRL(r.costPerUnit) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Produtividade por máquina">
        {machineRows.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhuma ordem concluída com máquina vinculada.</p>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-300">
                <th className="py-1.5 font-semibold">Máquina</th>
                <th className="py-1.5 font-semibold text-right">Ordens</th>
                <th className="py-1.5 font-semibold text-right">Planejado</th>
                <th className="py-1.5 font-semibold text-right">Produzido</th>
                <th className="py-1.5 font-semibold text-right">Eficiência média</th>
              </tr>
            </thead>
            <tbody>
              {machineRows.map((m) => (
                <tr key={m.name} className="border-b border-slate-200">
                  <td className="py-1.5 font-medium text-slate-900">{m.name}</td>
                  <td className="py-1.5 text-right">{m.ordens}</td>
                  <td className="py-1.5 text-right">{fmtInt(m.planned)}</td>
                  <td className="py-1.5 text-right">{fmtInt(m.actual)}</td>
                  <td className="py-1.5 text-right font-semibold">{pctBR(m.avgEff, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Desvio de traço — cimento (teórico × real)">
        {traceList.length === 0 ? (
          <p className="text-xs text-slate-500">
            Nenhuma ordem com traços produzidos e traço de concreto vinculado no período.
          </p>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-300">
                <th className="py-1.5 font-semibold">Artefato</th>
                <th className="py-1.5 font-semibold text-right">Ordens</th>
                <th className="py-1.5 font-semibold text-right">Teórico (kg)</th>
                <th className="py-1.5 font-semibold text-right">Real (kg)</th>
                <th className="py-1.5 font-semibold text-right">Desvio %</th>
              </tr>
            </thead>
            <tbody>
              {traceList.map((r) => (
                <tr key={r.name} className="border-b border-slate-200">
                  <td className="py-1.5 font-medium text-slate-900">{r.name}</td>
                  <td className="py-1.5 text-right">{r.count}</td>
                  <td className="py-1.5 text-right">{fmtInt(r.theo)}</td>
                  <td className="py-1.5 text-right">{fmtInt(r.actual)}</td>
                  <td className={`py-1.5 text-right font-semibold ${r.devPct > 0 ? 'text-red-600' : 'text-green-700'}`}>
                    {r.devPct > 0 ? '+' : ''}{r.devPct.toFixed(1).replace('.', ',')}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Estabilidade da produção diária">
        {stabilityRows.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhuma produção diária registrada no período.</p>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-300">
                <th className="py-1.5 font-semibold">Artefato</th>
                <th className="py-1.5 font-semibold text-right">Dias</th>
                <th className="py-1.5 font-semibold text-right">Média (un/h)</th>
                <th className="py-1.5 font-semibold text-right">CV</th>
                <th className="py-1.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {stabilityRows.map((r) => {
                const status = r.cv == null ? '—' : r.cv <= 10 ? 'Estável' : r.cv <= 20 ? 'Atenção' : 'Instável';
                return (
                  <tr key={r.name} className="border-b border-slate-200">
                    <td className="py-1.5 font-medium text-slate-900">{r.name}</td>
                    <td className="py-1.5 text-right">{r.days}</td>
                    <td className="py-1.5 text-right">{r.mean != null ? fmtDec(r.mean, 1) : '—'}</td>
                    <td className="py-1.5 text-right font-semibold">{pctBR(r.cv, 1)}</td>
                    <td className={`py-1.5 font-medium ${status === 'Estável' ? 'text-green-700' : status === 'Atenção' ? 'text-amber-600' : 'text-red-600'}`}>
                      {status}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Como ler esta ficha">
        <p className="text-xs text-slate-600 leading-relaxed">
          <strong>Custo insumos/un</strong> = consumo real do período × custo cadastrado ÷ unidades produzidas.
          <strong> Desvio de traço</strong> compara o cimento teórico (traços produzidos × cimento por traço do traço
          cadastrado) com o real. <strong>CV</strong> (coeficiente de variação) mede a dispersão da produtividade
          diária — até 10% estável, acima de 20% instável.
        </p>
      </Section>
    </>
  );
}