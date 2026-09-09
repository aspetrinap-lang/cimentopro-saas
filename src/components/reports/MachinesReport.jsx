import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Wrench } from 'lucide-react';
import ReportSheet from './ReportSheet';
import Section from './Section';
import { inRange, fmtDur, pctBR } from '@/lib/reportUtils';

// Ficha técnica das Máquinas: produção, paradas, disponibilidade e
// principais falhas de cada equipamento no período selecionado.
export default function MachinesReport({ onClose }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.entities.Machine.list('name'),
      base44.entities.MachineDowntime.list('-date', 1000),
      base44.entities.ProductionOrder.list('-production_date', 1000),
    ]).then(([machines, downtimes, orders]) => setData({ machines, downtimes, orders }));
  }, []);

  return (
    <ReportSheet
      title="Ficha Técnica — Máquinas"
      subtitle="Tempo produtivo, paradas, disponibilidade e principais falhas por equipamento"
      icon={Wrench}
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
  const { machines, downtimes, orders } = data;
  const dt = downtimes.filter((d) => inRange(d.date, start, end));
  const ords = orders.filter((o) => inRange(o.production_date, start, end));

  const byMachine = {};
  machines.forEach((m) => {
    byMachine[m.id] = { name: m.name, type: m.machine_type || 'Produção', prodMin: 0, orders: 0, dtMin: 0, dtCount: 0, cats: {} };
  });
  ords.forEach((o) => {
    const m = byMachine[o.machine_id];
    if (!m) return;
    m.prodMin += Number(o.production_minutes) || 0;
    m.orders += 1;
  });
  dt.forEach((d) => {
    const m = (byMachine[d.machine_id] ||= {
      name: d.machine_name || d.machine_id, type: '—', prodMin: 0, orders: 0, dtMin: 0, dtCount: 0, cats: {},
    });
    m.dtMin += Number(d.duration_minutes) || 0;
    m.dtCount += 1;
    const c = d.failure_category || 'Outros';
    m.cats[c] = (m.cats[c] || 0) + (Number(d.duration_minutes) || 0);
  });

  const rows = Object.values(byMachine)
    .filter((m) => m.prodMin > 0 || m.dtMin > 0)
    .map((m) => ({ ...m, avail: m.prodMin + m.dtMin > 0 ? (m.prodMin / (m.prodMin + m.dtMin)) * 100 : null }))
    .sort((a, b) => b.dtMin - a.dtMin || b.prodMin - a.prodMin);

  const totals = rows.reduce((t, m) => ({ prod: t.prod + m.prodMin, dt: t.dt + m.dtMin, n: t.n + m.dtCount }), { prod: 0, dt: 0, n: 0 });
  const avgAvail = rows.length ? rows.reduce((s, m) => s + (m.avail ?? 100), 0) / rows.length : null;

  const catTotals = {};
  dt.forEach((d) => {
    const c = d.failure_category || 'Outros';
    catTotals[c] = (catTotals[c] || 0) + (Number(d.duration_minutes) || 0);
  });
  const topCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <Section title="Resumo do período">
        <p className="text-xs text-slate-600 leading-relaxed">
          Os equipamentos somaram <strong>{fmtDur(totals.prod)}</strong> de produção efetiva e{' '}
          <strong>{fmtDur(totals.dt)}</strong> de paradas em <strong>{totals.n} ocorrência(s)</strong>.
          Disponibilidade média (produção ÷ produção+paradas): <strong>{pctBR(avgAvail, 0)}</strong>.
        </p>
      </Section>

      <Section title="Indicadores por máquina">
        {rows.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhuma produção ou parada registrada no período.</p>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-300">
                <th className="py-1.5 font-semibold">Máquina</th>
                <th className="py-1.5 font-semibold">Tipo</th>
                <th className="py-1.5 font-semibold text-right">Ordens</th>
                <th className="py-1.5 font-semibold text-right">Produção</th>
                <th className="py-1.5 font-semibold text-right">Paradas</th>
                <th className="py-1.5 font-semibold text-right">Disponib.</th>
                <th className="py-1.5 font-semibold">Principal falha</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const topCat = Object.entries(m.cats).sort((a, b) => b[1] - a[1])[0];
                return (
                  <tr key={m.name} className="border-b border-slate-200">
                    <td className="py-1.5 font-medium text-slate-900">{m.name}</td>
                    <td className="py-1.5 text-slate-600">{m.type}</td>
                    <td className="py-1.5 text-right">{m.orders}</td>
                    <td className="py-1.5 text-right">{fmtDur(m.prodMin)}</td>
                    <td className="py-1.5 text-right">{m.dtCount > 0 ? `${m.dtCount}× (${fmtDur(m.dtMin)})` : '—'}</td>
                    <td className="py-1.5 text-right font-semibold">{pctBR(m.avail, 0)}</td>
                    <td className="py-1.5 text-slate-600">{topCat ? `${topCat[0]} (${fmtDur(topCat[1])})` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Paradas por categoria">
        {topCats.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhuma parada registrada no período.</p>
        ) : (
          <ul className="text-xs text-slate-700 space-y-1">
            {topCats.map(([c, min]) => (
              <li key={c} className="flex justify-between border-b border-slate-100 py-0.5">
                <span>{c}</span>
                <span className="font-semibold">{fmtDur(min)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Como ler esta ficha">
        <p className="text-xs text-slate-600 leading-relaxed">
          <strong>Disponibilidade</strong> é o tempo em produção dividido pelo tempo total (produção + paradas) — acima
          de 90% é saudável, abaixo de 75% indica equipamento que exige manutenção. <strong>Principal falha</strong> é
          a categoria de parada que mais tempo consumiu na máquina.
        </p>
      </Section>
    </>
  );
}