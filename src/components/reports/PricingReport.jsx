import { useMemo } from 'react';
import { Calculator } from 'lucide-react';
import ReportSheet from './ReportSheet';
import Section from './Section';
import { inRange } from '@/lib/reportUtils';
import { fmtBRL, fmtNum } from '@/lib/statsUtils';
import {
  weightPerSaleUnit, unitLabel, totalProductionCostPerUnit, calculateSuggestedPrice,
  orderRealWeightKg, orderHasRealWeight,
} from '@/lib/costUtils';

// Ficha técnica do Simulador de Preços: custo de produção, impostos, margem
// e preço sugerido de cada produto, recalculados para o período selecionado.
export default function PricingReport({ orders, lines, dres, productTypes, insumoCosts, defaults, rows, onClose }) {
  return (
    <ReportSheet
      title="Ficha Técnica — Precificação"
      subtitle="Custo, impostos, margem e preço sugerido por produto no período analisado"
      icon={Calculator}
      onClose={onClose}
    >
      {({ start, end }) => (
        <Content
          orders={orders} lines={lines} dres={dres} productTypes={productTypes}
          insumoCosts={insumoCosts} defaults={defaults} rows={rows} start={start} end={end}
        />
      )}
    </ReportSheet>
  );
}

function Content({ orders, lines, dres, productTypes, insumoCosts, defaults, rows, start, end }) {
  const data = useMemo(() => {
    const ptMap = Object.fromEntries(productTypes.map((p) => [p.id, p]));
    const rangeOrders = orders.filter((o) => inRange(o.production_date, start, end));
    const months = new Set(rangeOrders.map((o) => (o.production_date || '').slice(0, 7)));
    const dresUsed = dres.filter((d) => months.has(d.reference_month));
    const apportionable = dresUsed.flatMap((d) => (d.items || []).filter((i) => i.apportionment_method !== 'none'));
    const volTotal = apportionable.filter((i) => i.apportionment_method === 'volume').reduce((s, i) => s + (Number(i.actual_value) || 0), 0);
    const hoursTotal = apportionable.filter((i) => i.apportionment_method === 'machine_hours').reduce((s, i) => s + (Number(i.actual_value) || 0), 0);

    const weightKg = rangeOrders.reduce(
      (s, o) => (orderHasRealWeight(o) ? s + orderRealWeightKg(o) : s + (Number(o.actual_quantity) || 0) * weightPerSaleUnit(ptMap[o.product_type_id])),
      0
    );
    const prodHours = rangeOrders.reduce((s, o) => s + (Number(o.production_minutes) || 0), 0) / 60;

    const machineToLine = {};
    lines.forEach((l) => (l.machines || []).forEach((m) => { if (m.machine_id) machineToLine[m.machine_id] = l.id; }));
    let totalEnergy = 0;
    lines.forEach((line) => {
      const lo = rangeOrders.filter((o) =>
        o.production_line_id ? o.production_line_id === line.id : o.machine_id && machineToLine[o.machine_id] === line.id
      );
      const h = lo.reduce((s, o) => s + (Number(o.production_minutes) || 0), 0) / 60;
      totalEnergy += h * (Number(line.used_power_kw) || 0) * (Number(line.energy_cost_per_kwh) || 0);
    });

    const phuMap = {};
    rangeOrders.forEach((o) => {
      const pid = o.product_type_id;
      if (!pid) return;
      (phuMap[pid] ||= { h: 0, q: 0 });
      phuMap[pid].h += (Number(o.production_minutes) || 0) / 60;
      phuMap[pid].q += Number(o.actual_quantity) || 0;
    });

    return {
      rangeOrders,
      dresUsed,
      weightKg,
      pieces: rangeOrders.reduce((s, o) => s + (Number(o.actual_quantity) || 0), 0),
      costPerKg: weightKg > 0 ? volTotal / weightKg : 0,
      costPerMachineHour: prodHours > 0 ? hoursTotal / prodHours : 0,
      avgEnergyPerKg: weightKg > 0 ? totalEnergy / weightKg : 0,
      hoursPerUnit: Object.fromEntries(Object.entries(phuMap).map(([pid, v]) => [pid, v.q > 0 ? v.h / v.q : 0])),
    };
  }, [orders, lines, dres, productTypes, start, end]);

  const rowFor = (ptId) =>
    rows[ptId] || {
      commission: defaults.commission, freight: defaults.freight, other: defaults.other,
      margin: defaults.margin, taxRate: defaults.taxRate,
    };

  const regime = defaults.regime === 'real' ? 'Lucro Real/Presumido' : 'Simples Nacional';
  const dreLabels = data.dresUsed.map((d) => d.month_label || d.reference_month);
  const active = productTypes.filter((p) => p.active !== false);

  const products = active.map((pt) => {
    const baseCost = totalProductionCostPerUnit(pt, {
      insumoCosts,
      avgEnergyPerKg: data.avgEnergyPerKg,
      costPerKg: data.costPerKg,
      costPerMachineHour: data.costPerMachineHour,
      hoursPerUnit: data.hoursPerUnit[pt.id] || 0,
    });
    const row = rowFor(pt.id);
    const suggested = calculateSuggestedPrice(baseCost, row);
    const current = Number(pt.selling_price) || 0;
    return { pt, baseCost, suggested, current, diff: current > 0 ? suggested - current : null };
  });

  return (
    <>
      <Section title="Base de cálculo do período">
        <p className="text-xs text-slate-600 leading-relaxed">
          Foram produzidas <strong>{fmtNum(data.pieces, 0)} peças</strong> ({fmtNum(data.weightKg, 0)} kg) no período.
          Regime tributário: <strong>{regime}</strong>. DRE(s) usada(s) no rateio de custos indiretos:{' '}
          <strong>{dreLabels.length ? dreLabels.join(', ') : 'nenhuma — apenas custo direto'}</strong>.
          Custos indiretos rateados: <strong>{fmtBRL(data.costPerKg)}/kg</strong> e{' '}
          <strong>{fmtBRL(data.costPerMachineHour)}/hora de máquina</strong>; energia:{' '}
          <strong>{fmtBRL(data.avgEnergyPerKg)}/kg</strong>.
        </p>
      </Section>

      <Section title="Custo e preço sugerido por produto">
        {products.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhum produto ativo cadastrado.</p>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-300">
                <th className="py-1.5 font-semibold">Artefato</th>
                <th className="py-1.5 font-semibold text-center">Un.</th>
                <th className="py-1.5 font-semibold text-right">Custo prod.</th>
                <th className="py-1.5 font-semibold text-right">Imposto</th>
                <th className="py-1.5 font-semibold text-right">Margem</th>
                <th className="py-1.5 font-semibold text-right">Preço sugerido</th>
                <th className="py-1.5 font-semibold text-right">Preço atual</th>
                <th className="py-1.5 font-semibold">Situação</th>
              </tr>
            </thead>
            <tbody>
              {products.map(({ pt, baseCost, suggested, current, diff }) => (
                <tr key={pt.id} className="border-b border-slate-200">
                  <td className="py-1.5 font-medium text-slate-900">{pt.name}</td>
                  <td className="py-1.5 text-center text-slate-600">{unitLabel(pt)}</td>
                  <td className="py-1.5 text-right">{fmtBRL(baseCost)}</td>
                  <td className="py-1.5 text-right">{fmtNum(Number(rowFor(pt.id).taxRate) || 0, 1)}%</td>
                  <td className="py-1.5 text-right">{fmtNum(Number(rowFor(pt.id).margin) || 0, 1)}%</td>
                  <td className="py-1.5 text-right font-bold">{suggested > 0 ? fmtBRL(suggested) : '—'}</td>
                  <td className="py-1.5 text-right text-slate-600">{current > 0 ? fmtBRL(current) : '—'}</td>
                  <td className="py-1.5">
                    {diff == null ? (
                      <span className="text-slate-500">sem preço</span>
                    ) : diff > 0.005 ? (
                      <span className="text-red-600 font-semibold">defasado ({fmtBRL(diff)})</span>
                    ) : diff < -0.005 ? (
                      <span className="text-green-700">acima do sugerido</span>
                    ) : (
                      <span className="text-green-700">alinhado</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Como ler esta ficha">
        <p className="text-xs text-slate-600 leading-relaxed">
          O <strong>custo de produção</strong> soma matéria-prima, molde, energia e a parcela dos custos indiretos da DRE
          rateada pelo peso e pelas horas de máquina do período. <strong>Preço sugerido</strong> = (custo + frete +
          outros) ÷ (1 − margem − comissão − imposto), com o imposto incidindo sobre o preço final. Em{' '}
          <span className="text-red-600 font-semibold">vermelho</span>, o preço atual está abaixo do sugerido (defasado).
        </p>
      </Section>
    </>
  );
}