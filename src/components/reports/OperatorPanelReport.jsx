import { useEffect, useState } from 'react';
import { scopedFilter } from '@/lib/companyScope';
import { base44 } from '@/api/base44Client';
import { Timer } from 'lucide-react';
import ReportSheet from './ReportSheet';
import Section from './Section';
import { buildOperatorPanelData } from '@/lib/operatorMetrics';
import { computeStats, fmtNum } from '@/lib/statsUtils';
import { fmtDur } from '@/lib/reportUtils';

// Ficha técnica do Painel do Operador: produção, ciclos, taxas horárias,
// performance vs. meta e quebras por linha de produção / máquina no período.
export default function OperatorPanelReport({ initialStart, initialEnd, onClose }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.entities.Machine.filter(scopedFilter({ active: true }), 'name'),
      base44.entities.ProductionOrder.filter(scopedFilter({}), '-production_date', 2000),
      base44.entities.MachineDowntime.filter(scopedFilter({}), '-date', 2000),
      base44.entities.ProductionLine.filter(scopedFilter({}), 'name'),
    ]).then(([machines, orders, downtimes, lines]) => setData({ machines, orders, downtimes, lines }));
  }, []);

  return (
    <ReportSheet
      title="Ficha Técnica — Painel do Operador"
      subtitle="Produção, ciclos, performance vs. meta e quebras por linha / máquina"
      icon={Timer}
      initialStart={initialStart}
      initialEnd={initialEnd}
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
  const { cards } = buildOperatorPanelData(data, computeStats, { startDate: start, endDate: end });
  const rows = cards.filter((c) => c.hasProduction || c.downtimeCount > 0);
  const totals = rows.reduce(
    (t, c) => ({
      pieces: t.pieces + c.period.pieces,
      cycles: t.cycles + c.period.cycles,
      hours: t.hours + c.period.hours,
      dt: t.dt + c.downtimeMinutes,
    }),
    { pieces: 0, cycles: 0, hours: 0, dt: 0 }
  );

  return (
    <>
      <Section title="Resumo do período">
        <p className="text-xs text-slate-600 leading-relaxed">
          No período foram produzidas <strong>{fmtNum(totals.pieces, 0)} peças</strong> em{' '}
          <strong>{fmtNum(totals.cycles, 0)} ciclos</strong>, com <strong>{fmtNum(totals.hours, 1)} horas</strong> de
          produção efetiva e <strong>{fmtDur(totals.dt)}</strong> de paradas registradas.
        </p>
      </Section>

      <Section title="Indicadores por linha de produção / máquina">
        {rows.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhuma produção ou parada registrada no período.</p>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-300">
                <th className="py-1.5 font-semibold">Linha / Máquina</th>
                <th className="py-1.5 font-semibold text-right">Peças</th>
                <th className="py-1.5 font-semibold text-right">Ciclos</th>
                <th className="py-1.5 font-semibold text-right">Horas prod.</th>
                <th className="py-1.5 font-semibold text-right">Peças/h</th>
                <th className="py-1.5 font-semibold text-right">Ciclos/h</th>
                <th className="py-1.5 font-semibold text-right">Perf. meta</th>
                <th className="py-1.5 font-semibold text-right">Quebras</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b border-slate-200">
                  <td className="py-1.5 font-medium text-slate-900">{c.isLine ? `Linha ${c.name}` : c.name}</td>
                  <td className="py-1.5 text-right">{fmtNum(c.period.pieces, 0)}</td>
                  <td className="py-1.5 text-right">{fmtNum(c.period.cycles, 0)}</td>
                  <td className="py-1.5 text-right">{fmtNum(c.period.hours, 1)}</td>
                  <td className="py-1.5 text-right font-semibold">{c.hasProduction ? fmtNum(c.period.piecesPerHour, 0) : '—'}</td>
                  <td className="py-1.5 text-right">{c.hasProduction ? fmtNum(c.period.cyclesPerHour, 1) : '—'}</td>
                  <td className="py-1.5 text-right">{c.performance != null ? `${fmtNum(c.performance, 0)}%` : '—'}</td>
                  <td className="py-1.5 text-right">{c.downtimeCount > 0 ? `${c.downtimeCount} (${fmtDur(c.downtimeMinutes)})` : '0'}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-400 font-semibold">
                <td className="py-1.5">Total</td>
                <td className="py-1.5 text-right">{fmtNum(totals.pieces, 0)}</td>
                <td className="py-1.5 text-right">{fmtNum(totals.cycles, 0)}</td>
                <td className="py-1.5 text-right">{fmtNum(totals.hours, 1)}</td>
                <td colSpan={3} />
                <td className="py-1.5 text-right">{fmtDur(totals.dt)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Como ler esta ficha">
        <p className="text-xs text-slate-600 leading-relaxed">
          <strong>Peças/h</strong> é a velocidade média de produção. <strong>Perf. meta</strong> compara os ciclos/hora
          com a meta da linha — acima de 95% é bom, entre 80% e 95% merece atenção. <strong>Quebras</strong> mostra a
          quantidade de paradas registradas e o tempo total parado.
        </p>
      </Section>
    </>
  );
}