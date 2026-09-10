import { useEffect, useState } from 'react';
import { scopedFilter } from '@/lib/companyScope';
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { Calculator } from 'lucide-react';
import ReportSheet from './ReportSheet';
import Section from './Section';
import { inRange } from '@/lib/reportUtils';
import { useInsumoCosts } from '@/hooks/useInsumoCosts';
import {
  weightPerSaleUnit, unitLabel, orderRealWeightKg, orderHasRealWeight, totalProductionCostPerUnit,
} from '@/lib/costUtils';
import { fmtBRL, fmtNum } from '@/lib/statsUtils';

function fmtBRL4(v) {
  if (v == null || !isFinite(v)) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

// Ficha técnica da Análise de Custos: rateio da DRE, energia e custo de
// produção por artefato no período selecionado (mesma fórmula da página).
export default function CostsReport({ initialMonth, onClose }) {
  const [data, setData] = useState(null);
  const { costs: insumoCosts } = useInsumoCosts();

  // Período inicial = mês de referência selecionado na página
  let initialStart, initialEnd;
  if (initialMonth) {
    const [y, m] = initialMonth.split('-').map(Number);
    initialStart = `${initialMonth}-01`;
    initialEnd = format(new Date(y, m, 0), 'yyyy-MM-dd');
  }

  useEffect(() => {
    Promise.all([
      base44.entities.ProductionOrder.filter(scopedFilter({ status: 'Concluída' }), '-production_date', 2000),
      base44.entities.ProductionLine.filter(scopedFilter({}), 'name', 200),
      base44.entities.MonthlyDre.filter(scopedFilter(), '-reference_month', 100),
      base44.entities.ProductType.filter(scopedFilter({}), 'name', 500),
    ]).then(([orders, lines, dres, productTypes]) => setData({ orders, lines, dres, productTypes }));
  }, []);

  return (
    <ReportSheet
      title="Ficha Técnica — Análise de Custos"
      subtitle="Rateio da DRE, energia e composição do custo de produção por artefato"
      icon={Calculator}
      initialStart={initialStart}
      initialEnd={initialEnd}
      onClose={onClose}
    >
      {({ start, end }) =>
        !data ? (
          <p className="text-sm text-slate-500 text-center py-10">Carregando dados do período...</p>
        ) : (
          <Content data={data} start={start} end={end} insumoCosts={insumoCosts} />
        )
      }
    </ReportSheet>
  );
}

function Content({ data, start, end, insumoCosts }) {
  const { orders, lines, dres, productTypes } = data;
  const ptMap = {};
  productTypes.forEach((p) => { ptMap[p.id] = p; });

  const inOrders = orders.filter((o) => inRange(o.production_date, start, end));

  // DREs dos meses que intersectam o período selecionado
  const months = dres.filter((d) => {
    const m = String(d.reference_month || '');
    return m >= start.slice(0, 7) && m <= end.slice(0, 7);
  });

  const monthRows = months.map((d) => {
    const vol = (d.items || []).filter((i) => i.apportionment_method === 'volume').reduce((s, i) => s + (Number(i.actual_value) || 0), 0);
    const hrs = (d.items || []).filter((i) => i.apportionment_method === 'machine_hours').reduce((s, i) => s + (Number(i.actual_value) || 0), 0);
    return { label: d.month_label || d.reference_month, vol, hrs };
  });
  const volTotal = monthRows.reduce((s, r) => s + r.vol, 0);
  const hoursTotal = monthRows.reduce((s, r) => s + r.hrs, 0);

  // Peso produzido (kg) — peso real quando lançado, senão estimativa do cadastro
  const weightKg = inOrders.reduce((s, o) => {
    if (orderHasRealWeight(o)) return s + orderRealWeightKg(o);
    return s + (Number(o.actual_quantity) || 0) * weightPerSaleUnit(ptMap[o.product_type_id]);
  }, 0);
  const prodHours = inOrders.reduce((s, o) => s + (Number(o.production_minutes) || 0), 0) / 60;

  const costPerKg = weightKg > 0 ? volTotal / weightKg : 0;
  const costPerHour = prodHours > 0 ? hoursTotal / prodHours : 0;

  // Energia por linha (horas da linha × potência × custo do kWh)
  const machineToLine = {};
  lines.forEach((line) => (line.machines || []).forEach((m) => { if (m.machine_id) machineToLine[m.machine_id] = line.id; }));
  const lineHours = {};
  lines.forEach((l) => { lineHours[l.id] = 0; });
  inOrders.forEach((o) => {
    const lid = o.production_line_id || machineToLine[o.machine_id];
    if (lid && lineHours[lid] != null) lineHours[lid] += (Number(o.production_minutes) || 0) / 60;
  });
  const totalEnergy = lines.reduce(
    (s, l) => s + (lineHours[l.id] || 0) * (Number(l.used_power_kw) || 0) * (Number(l.energy_cost_per_kwh) || 0), 0
  );
  const energyPerKg = weightKg > 0 ? totalEnergy / weightKg : 0;

  // Produção e horas por produto → custo unitário (direto + indireto)
  const prodBy = {};
  inOrders.forEach((o) => {
    const pid = o.product_type_id;
    if (!pid) return;
    if (!prodBy[pid]) prodBy[pid] = { produced: 0, hours: 0 };
    prodBy[pid].produced += Number(o.actual_quantity) || 0;
    prodBy[pid].hours += (Number(o.production_minutes) || 0) / 60;
  });

  const rows = Object.entries(prodBy).filter(([pid]) => ptMap[pid]).map(([pid, r]) => {
    const pt = ptMap[pid];
    const hoursPerUnit = r.produced > 0 ? r.hours / r.produced : 0;
    const costPerUnit = totalProductionCostPerUnit(pt, {
      insumoCosts, avgEnergyPerKg: energyPerKg, costPerKg, costPerMachineHour: costPerHour, hoursPerUnit,
    });
    return { pt, produced: r.produced, hoursPerUnit, costPerUnit, total: costPerUnit * r.produced };
  }).sort((a, b) => b.total - a.total);

  const grandTotal = rows.reduce((s, r) => s + r.total, 0);

  return (
    <>
      <Section title="Resumo do período">
        <p className="text-xs text-slate-600 leading-relaxed">
          {inOrders.length} ordem(ns) concluída(s) · <strong>{fmtNum(weightKg, 0)} kg</strong> produzidos ·{' '}
          {fmtNum(prodHours, 1)} h de máquina. Energia: <strong>{fmtBRL(totalEnergy)}</strong> ({fmtBRL4(energyPerKg)}/kg).
          Rateio DRE: <strong>{fmtBRL4(costPerKg)}/kg</strong> (por peso) e <strong>{fmtBRL4(costPerHour)}/h</strong> (por horas de máquina)
          {' '}— meses considerados: {monthRows.length > 0 ? monthRows.map((r) => r.label).join(', ') : 'nenhum'}.
        </p>
      </Section>

      <Section title="Rateio da DRE no período">
        {monthRows.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhuma DRE importada para os meses do período.</p>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-300">
                <th className="py-1.5 font-semibold">Mês</th>
                <th className="py-1.5 font-semibold text-right">Rateio por volume (R$)</th>
                <th className="py-1.5 font-semibold text-right">Rateio por horas (R$)</th>
                <th className="py-1.5 font-semibold text-right">Total rateável (R$)</th>
              </tr>
            </thead>
            <tbody>
              {monthRows.map((r) => (
                <tr key={r.label} className="border-b border-slate-200">
                  <td className="py-1.5 font-medium text-slate-900">{r.label}</td>
                  <td className="py-1.5 text-right">{fmtBRL(r.vol)}</td>
                  <td className="py-1.5 text-right">{fmtBRL(r.hrs)}</td>
                  <td className="py-1.5 text-right font-semibold">{fmtBRL(r.vol + r.hrs)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 font-semibold">
                <td className="py-1.5 text-slate-900">Total</td>
                <td className="py-1.5 text-right">{fmtBRL(volTotal)}</td>
                <td className="py-1.5 text-right">{fmtBRL(hoursTotal)}</td>
                <td className="py-1.5 text-right">{fmtBRL(volTotal + hoursTotal)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Custo de produção por artefato">
        {rows.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhuma produção no período.</p>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-300">
                <th className="py-1.5 font-semibold">Artefato</th>
                <th className="py-1.5 font-semibold text-center">Un. venda</th>
                <th className="py-1.5 font-semibold text-right">Produzido</th>
                <th className="py-1.5 font-semibold text-right">Peso/un (kg)</th>
                <th className="py-1.5 font-semibold text-right">Horas/un</th>
                <th className="py-1.5 font-semibold text-right">Custo/un</th>
                <th className="py-1.5 font-semibold text-right">Custo total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.pt.id} className="border-b border-slate-200">
                  <td className="py-1.5 font-medium text-slate-900">{r.pt.name}</td>
                  <td className="py-1.5 text-center text-slate-600">{unitLabel(r.pt)}</td>
                  <td className="py-1.5 text-right">{fmtNum(r.produced, 0)}</td>
                  <td className="py-1.5 text-right">{fmtNum(weightPerSaleUnit(r.pt), 2)}</td>
                  <td className="py-1.5 text-right">{fmtNum(r.hoursPerUnit, 4)}</td>
                  <td className="py-1.5 text-right font-semibold">{fmtBRL(r.costPerUnit)}</td>
                  <td className="py-1.5 text-right">{fmtBRL(r.total)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 font-semibold">
                <td className="py-1.5 text-slate-900" colSpan={6}>Custo total de produção do período</td>
                <td className="py-1.5 text-right">{fmtBRL(grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Como ler esta ficha">
        <p className="text-xs text-slate-600 leading-relaxed">
          <strong>Custo/un</strong> = matérias-primas (consumo do cadastro × custo do insumo) + molde + energia
          (R$/kg × peso/un) + rateio por peso (R$/kg × peso/un) + rateio por horas (R$/h × horas/un).
          O rateio usa as contas da DRE marcadas como rateáveis nos meses do período; sem DRE importada,
          apenas os custos diretos (matéria-prima, molde e energia) são calculados.
        </p>
      </Section>
    </>
  );
}