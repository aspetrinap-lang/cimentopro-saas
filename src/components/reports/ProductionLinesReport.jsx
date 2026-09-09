import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Layers } from 'lucide-react';
import ReportSheet from './ReportSheet';
import Section from './Section';
import { inRange, pctBR } from '@/lib/reportUtils';
import { fmtNum } from '@/lib/statsUtils';

// Ficha técnica das Linhas de Produção: composição de máquinas, potências,
// metas e desempenho real consolidado de cada linha no período.
export default function ProductionLinesReport({ onClose }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.entities.ProductionLine.list('name', 200),
      base44.entities.ProductionOrder.filter({ status: 'Concluída' }, '-production_date', 2000),
    ]).then(([lines, orders]) => setData({ lines, orders }));
  }, []);

  return (
    <ReportSheet
      title="Ficha Técnica — Linhas de Produção"
      subtitle="Composição, potência, metas e desempenho consolidado por linha"
      icon={Layers}
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
  const { lines, orders } = data;
  const rangeOrders = orders.filter((o) => inRange(o.production_date, start, end));

  const machineToLine = {};
  lines.forEach((l) => (l.machines || []).forEach((m) => { if (m.machine_id) machineToLine[m.machine_id] = l.id; }));

  const rows = lines.map((line) => {
    const lo = rangeOrders.filter((o) =>
      o.production_line_id ? o.production_line_id === line.id : o.machine_id && machineToLine[o.machine_id] === line.id
    );
    const pieces = lo.reduce((s, o) => s + (Number(o.actual_quantity) || 0), 0);
    const cycles = lo.reduce((s, o) => s + (Number(o.machine_cycles_actual) || 0), 0);
    const minutes = lo.reduce((s, o) => s + (Number(o.production_minutes) || 0), 0);
    const cph = minutes > 0 ? cycles / (minutes / 60) : 0;
    const target = Number(line.target_cycles_per_hour) || 0;
    return {
      line,
      machineNames: (line.machines || [])
        .slice()
        .sort((a, b) => (a.sequence_order || 0) - (b.sequence_order || 0))
        .map((m, i) => `${m.sequence_order || i + 1}. ${m.machine_name || '—'}`),
      ordersCount: lo.length,
      pieces,
      cycles,
      hours: minutes / 60,
      cph,
      target,
      perf: target > 0 && cph > 0 ? (cph / target) * 100 : null,
    };
  });

  const active = rows.filter((r) => r.line.active !== false);
  const totalsPieces = rows.reduce((s, r) => s + r.pieces, 0);
  const totalsHours = rows.reduce((s, r) => s + r.hours, 0);

  return (
    <>
      <Section title="Resumo">
        <p className="text-xs text-slate-600 leading-relaxed">
          A fábrica opera com <strong>{lines.length} linha(s)</strong> cadastrada(s) ({active.length} ativa(s)).
          No período elas produziram <strong>{fmtNum(totalsPieces, 0)} peças</strong> em{' '}
          <strong>{fmtNum(totalsHours, 1)} horas</strong> de produção efetiva.
        </p>
      </Section>

      {rows.map((r) => (
        <div key={r.line.id} className="border border-slate-200 rounded-lg p-3 mb-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold text-slate-900">{r.line.name}</p>
            {r.line.active === false && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">Inativa</span>}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-700">
            <p><span className="text-slate-500">Equipamentos:</span> {r.machineNames.length ? r.machineNames.join(' · ') : '—'}</p>
            <p><span className="text-slate-500">Pot. instalada:</span> {fmtNum(r.line.installed_power_kw, 4)} kW</p>
            <p><span className="text-slate-500">Pot. utilizada:</span> {fmtNum(r.line.used_power_kw, 4)} kW</p>
            <p><span className="text-slate-500">Capacidade:</span> {fmtNum(r.line.production_capacity_per_hour, 0)} cic/h</p>
            <p><span className="text-slate-500">Meta:</span> {fmtNum(r.line.target_cycles_per_hour, 0)} cic/h</p>
            <p><span className="text-slate-500">Custo energia:</span> {fmtNum(r.line.energy_cost_per_kwh, 2)}/kWh</p>
          </div>
          <p className="text-xs text-slate-800 border-t border-slate-200 mt-2 pt-2">
            <strong>Período:</strong> {r.ordersCount} ordem(ns) · {fmtNum(r.pieces, 0)} peças · {fmtNum(r.cycles, 0)} ciclos ·{' '}
            {fmtNum(r.hours, 1)} h · {fmtNum(r.cph, 1)} ciclos/h{' '}
            ({r.perf != null ? <strong>{r.perf >= 95 ? '✅' : r.perf >= 80 ? '⚠' : '🔴'} {pctBR(r.perf, 0)} da meta</strong> : 'sem meta definida'})
          </p>
        </div>
      ))}

      <Section title="Como ler esta ficha">
        <p className="text-xs text-slate-600 leading-relaxed">
          Cada bloco mostra o cadastro da linha (equipamentos na sequência operacional, potências e metas) e o resultado
          real do período. O ícone ao lado da <strong>% da meta</strong> resume o ritmo: ✅ acima de 95%, ⚠ entre 80% e
          95%, 🔴 abaixo de 80% da meta de ciclos/hora.
        </p>
      </Section>
    </>
  );
}