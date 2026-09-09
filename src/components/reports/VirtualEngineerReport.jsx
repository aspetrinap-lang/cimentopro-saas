import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Bot } from 'lucide-react';
import ReportSheet from './ReportSheet';
import Section from './Section';
import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';
import { inRange, fmtDur, signedPct, pctBR } from '@/lib/reportUtils';
import { fmtNum, fmtBRL } from '@/lib/statsUtils';

// Ficha técnica do Engenheiro Virtual: diagnóstico consolidado do período em
// linguagem direta — produção, consumo, máquinas, paradas e custo por produto.
export default function VirtualEngineerReport({ orders, costs, names, onClose }) {
  const [downtimes, setDowntimes] = useState(null);

  useEffect(() => {
    base44.entities.MachineDowntime.list('-date', 1000).then(setDowntimes);
  }, []);

  return (
    <ReportSheet
      title="Ficha Técnica — Engenheiro Virtual"
      subtitle="Diagnóstico do período: produção, consumo, máquinas, paradas e custos"
      icon={Bot}
      onClose={onClose}
    >
      {({ start, end }) =>
        downtimes == null ? (
          <p className="text-sm text-slate-500 text-center py-10">Carregando dados do período...</p>
        ) : (
          <Content orders={orders} downtimes={downtimes} costs={costs} names={names} start={start} end={end} />
        )
      }
    </ReportSheet>
  );
}

function Content({ orders, downtimes, costs, names, start, end }) {
  const rangeOrders = orders.filter((o) => inRange(o.production_date, start, end));
  const dt = downtimes.filter((d) => inRange(d.date, start, end));

  // Panorama da produção
  const pieces = rangeOrders.reduce((s, o) => s + (Number(o.actual_quantity) || 0), 0);
  const planned = rangeOrders.reduce((s, o) => s + (Number(o.planned_quantity) || 0), 0);
  const prodMin = rangeOrders.reduce((s, o) => s + (Number(o.production_minutes) || 0), 0);
  const eff = planned > 0 ? (pieces / planned) * 100 : null;
  const scrap = rangeOrders.reduce((s, o) => s + (Number(o.loss_second_line) || 0) + (Number(o.loss_discarded) || 0), 0);

  // Consumo por insumo (planejado × real)
  const insumos = INSUMO_KEYS.map((k) => {
    const p = rangeOrders.reduce((s, o) => s + (Number(o[INSUMO_FIELDS[k].planned]) || 0), 0);
    const a = rangeOrders.reduce((s, o) => s + (Number(o[INSUMO_FIELDS[k].actual]) || 0), 0);
    return { label: names[k] || k, p, a, dev: p > 0 ? (a / p - 1) * 100 : null };
  }).filter((i) => i.p > 0 || i.a > 0);

  // Situação por máquina
  const byMachine = {};
  rangeOrders.forEach((o) => {
    const n = o.machine_name || '—';
    const m = (byMachine[n] ||= { planned: 0, actual: 0, orders: 0, dt: 0, dtN: 0 });
    m.planned += Number(o.planned_quantity) || 0;
    m.actual += Number(o.actual_quantity) || 0;
    m.orders += 1;
  });
  dt.forEach((d) => {
    const n = d.machine_name || '—';
    const m = (byMachine[n] ||= { planned: 0, actual: 0, orders: 0, dt: 0, dtN: 0 });
    m.dt += Number(d.duration_minutes) || 0;
    m.dtN += 1;
  });
  const machines = Object.entries(byMachine)
    .map(([name, m]) => ({ name, ...m, eff: m.planned > 0 ? (m.actual / m.planned) * 100 : null }))
    .sort((a, b) => (b.eff ?? 999) - (a.eff ?? 999) || b.dt - a.dt);

  // Paradas por categoria
  const catTotals = {};
  let totalDT = 0;
  dt.forEach((d) => {
    const c = d.failure_category || 'Outros';
    catTotals[c] = (catTotals[c] || 0) + (Number(d.duration_minutes) || 0);
    totalDT += Number(d.duration_minutes) || 0;
  });
  const topCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Custo direto por produto
  const byProd = {};
  rangeOrders.forEach((o) => {
    const n = o.product_type_name || '—';
    const m = (byProd[n] ||= { qty: 0, cost: 0 });
    m.qty += Number(o.actual_quantity) || 0;
    INSUMO_KEYS.forEach((k) => { m.cost += (Number(o[INSUMO_FIELDS[k].actual]) || 0) * (Number(costs[k]) || 0); });
  });
  const prods = Object.entries(byProd)
    .map(([n, m]) => ({ n, qty: m.qty, unit: m.qty > 0 ? m.cost / m.qty : 0 }))
    .sort((a, b) => b.qty - a.qty);

  return (
    <>
      <Section title="Panorama da produção">
        <p className="text-xs text-slate-600 leading-relaxed">
          Foram concluídas <strong>{rangeOrders.length} ordem(ns)</strong> no período, produzindo{' '}
          <strong>{fmtNum(pieces, 0)} peças</strong> (planejado: {fmtNum(planned, 0)}). A eficiência média foi de{' '}
          <strong>{pctBR(eff, 1)}</strong> do planejado, com {fmtDur(prodMin)} de produção efetiva e{' '}
          <strong>{fmtNum(scrap, 0)} peça(s)</strong> de refugo/descarte registradas.
        </p>
      </Section>

      <Section title="Consumo de matéria-prima — planejado × real">
        {insumos.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhum consumo registrado no período.</p>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-300">
                <th className="py-1.5 font-semibold">Insumo</th>
                <th className="py-1.5 font-semibold text-right">Planejado (kg)</th>
                <th className="py-1.5 font-semibold text-right">Real (kg)</th>
                <th className="py-1.5 font-semibold text-right">Desvio</th>
              </tr>
            </thead>
            <tbody>
              {insumos.map((i) => (
                <tr key={i.label} className="border-b border-slate-200">
                  <td className="py-1.5 font-medium text-slate-900">{i.label}</td>
                  <td className="py-1.5 text-right">{fmtNum(i.p, 0)}</td>
                  <td className="py-1.5 text-right">{fmtNum(i.a, 0)}</td>
                  <td className={`py-1.5 text-right font-semibold ${i.dev != null && i.dev > 5 ? 'text-red-600' : ''}`}>
                    {i.dev != null ? `${signedPct(i.dev)} ${i.dev > 5 ? '⚠' : ''}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Situação por máquina">
        {machines.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhuma produção registrada no período.</p>
        ) : (
          <ul className="text-xs text-slate-700 space-y-1.5">
            {machines.map((m) => (
              <li key={m.name} className="border-b border-slate-100 pb-1.5">
                <strong className="text-slate-900">{m.name}</strong> — {fmtNum(m.actual, 0)} peças em {m.orders} ordem(ns)
                {m.eff != null && <> (eficiência <span className={m.eff < 90 ? 'text-red-600 font-semibold' : 'font-semibold'}>{pctBR(m.eff, 1)}</span>)</>}
                {m.dtN > 0 && <>; <span className="text-red-600">{m.dtN} parada(s) — {fmtDur(m.dt)}</span></>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Paradas e manutenção">
        <p className="text-xs text-slate-600 leading-relaxed">
          Total de <strong>{fmtDur(totalDT)}</strong> paradas em <strong>{dt.length} ocorrência(s)</strong> no período.
          {topCats.length > 0 && (
            <>
              {' '}Principais causas: {topCats.map(([c, min]) => `${c} (${fmtDur(min)})`).join(', ')}.
            </>
          )}
        </p>
      </Section>

      <Section title="Custo direto de matéria-prima por produto">
        {prods.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhuma produção no período.</p>
        ) : (
          <ul className="text-xs text-slate-700 space-y-1">
            {prods.map((p) => (
              <li key={p.n} className="flex justify-between border-b border-slate-100 py-0.5">
                <span><strong className="text-slate-900">{p.n}</strong> — {fmtNum(p.qty, 0)} peças</span>
                <span className="font-semibold">{fmtBRL(p.unit)}/un</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Leitura executiva">
        <p className="text-xs text-slate-600 leading-relaxed">
          Priorize: (1) insumos com desvio acima de 5% marcados com ⚠ — indicam desperdício ou dosagem descalibrada;
          (2) máquinas com eficiência abaixo de 90% ou paradas recorrentes; (3) produtos com custo/un em alta — revise
          traço ou preço de venda.
        </p>
      </Section>
    </>
  );
}