import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { scopedFilter } from '@/lib/companyScope';
import { Boxes } from 'lucide-react';
import ReportSheet from './ReportSheet';
import Section from './Section';
import { inRange, fmtDur } from '@/lib/reportUtils';

const fmtInt = (n) => (Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const fmtBRL = (v) => (v == null || !isFinite(v) ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }));

const lifecycle = (m) => {
  if (!m.max_cycles || m.status === 'Descartado') return null;
  const pct = (m.cycles_used || 0) / m.max_cycles * 100;
  if (pct >= 90) return { pct, label: '🔴 Crítico' };
  if (pct >= 70) return { pct, label: '🟠 Atenção' };
  return { pct, label: '🟢 Normal' };
};

// Ficha técnica A4 do Controle de Moldes: inventário, vida útil e
// manutenções de moldes no período selecionado.
export default function MoldsReport({ onClose }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.entities.Mold.filter(scopedFilter(), 'name'),
      base44.entities.PreventiveMaintenance.filter(scopedFilter({}), '-date', 500),
    ]).then(([molds, maintenances]) => setData({ molds, maintenances }));
  }, []);

  return (
    <ReportSheet
      title="Ficha Técnica — Controle de Moldes"
      subtitle="Inventário, vida útil em ciclos e manutenções de moldes de produção"
      icon={Boxes}
      onClose={onClose}
    >
      {({ start, end }) =>
        !data ? (
          <p className="text-sm text-slate-500 text-center py-10">Carregando dados do período...</p>
        ) : (
          <Content molds={data.molds} maintenances={data.maintenances} start={start} end={end} />
        )
      }
    </ReportSheet>
  );
}

function Content({ molds, maintenances, start, end }) {
  const moldMap = useMemo(() => Object.fromEntries(molds.map((m) => [m.id, m])), [molds]);

  const maintRows = useMemo(
    () =>
      maintenances
        .filter((p) => p.mold_id && inRange(p.date, start, end))
        .map((p) => ({ ...p, mold: moldMap[p.mold_id] || { name: p.mold_name || 'Molde removido', code: '—' } })),
    [maintenances, moldMap, start, end]
  );

  const counts = useMemo(() => {
    const lc = molds.map(lifecycle);
    return {
      total: molds.length,
      active: molds.filter((m) => m.status === 'Ativo').length,
      maint: molds.filter((m) => m.status === 'Em Manutenção').length,
      discarded: molds.filter((m) => m.status === 'Descartado').length,
      critical: lc.filter((l) => l?.pct >= 90).length,
      attention: lc.filter((l) => l && l.pct >= 70 && l.pct < 90).length,
    };
  }, [molds]);

  const totalCost = molds.reduce((s, m) => s + (Number(m.cost) || 0), 0);

  const Stat = ({ label, value }) => (
    <div className="border border-slate-200 rounded-lg p-2.5">
      <p className="text-slate-500 font-semibold uppercase tracking-wide text-[10px]">{label}</p>
      <p className="text-sm font-bold text-slate-900 mt-0.5">{value}</p>
    </div>
  );

  return (
    <>
      <Section title="Resumo do inventário">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
          <Stat label="Total de moldes" value={fmtInt(counts.total)} />
          <Stat label="Ativos" value={fmtInt(counts.active)} />
          <Stat label="Em manutenção" value={fmtInt(counts.maint)} />
          <Stat label="Descartados" value={fmtInt(counts.discarded)} />
          <Stat label="Críticos (≥90%)" value={fmtInt(counts.critical)} />
          <Stat label="Em atenção (≥70%)" value={fmtInt(counts.attention)} />
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Custo total de aquisição do parque de moldes: <strong>{fmtBRL(totalCost)}</strong>. Moldes com vida útil
          igual ou superior a 90% estão críticos e devem ser avaliados para manutenção ou substituição.
        </p>
      </Section>

      <Section title="Vida útil por molde">
        {molds.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhum molde cadastrado.</p>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-300">
                <th className="py-1.5 font-semibold">Código</th>
                <th className="py-1.5 font-semibold">Molde</th>
                <th className="py-1.5 font-semibold">Artefatos</th>
                <th className="py-1.5 text-right font-semibold">Peças/ciclo</th>
                <th className="py-1.5 text-right font-semibold">Ciclos usados</th>
                <th className="py-1.5 text-right font-semibold">Vida útil</th>
                <th className="py-1.5 text-right font-semibold">Uso</th>
                <th className="py-1.5 text-right font-semibold">Restantes</th>
                <th className="py-1.5 font-semibold">Estado</th>
                <th className="py-1.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {molds.map((m) => {
                const lc = lifecycle(m);
                return (
                  <tr key={m.id} className="border-b border-slate-200">
                    <td className="py-1.5 font-mono text-slate-600">{m.code}</td>
                    <td className="py-1.5 font-medium text-slate-900">{m.name}</td>
                    <td className="py-1.5 text-slate-600">{m.product_type_names?.length ? m.product_type_names.join(', ') : '—'}</td>
                    <td className="py-1.5 text-right">{m.units_per_cycle ? fmtInt(m.units_per_cycle) : '—'}</td>
                    <td className="py-1.5 text-right">{fmtInt(m.cycles_used)}</td>
                    <td className="py-1.5 text-right">{m.max_cycles ? fmtInt(m.max_cycles) : '—'}</td>
                    <td className="py-1.5 text-right font-semibold">{lc ? `${lc.pct.toFixed(1).replace('.', ',')}%` : '—'}</td>
                    <td className="py-1.5 text-right">{m.max_cycles ? fmtInt(Math.max(m.max_cycles - (m.cycles_used || 0), 0)) : '—'}</td>
                    <td className="py-1.5">{lc ? lc.label : m.status === 'Descartado' ? '⚪ Descartado' : '—'}</td>
                    <td className="py-1.5 text-slate-600">{m.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>

      <Section title={`Manutenções de moldes no período (${fmtInt(maintRows.length)})`}>
        {maintRows.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhuma manutenção de molde registrada no período selecionado.</p>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-300">
                <th className="py-1.5 font-semibold">Data</th>
                <th className="py-1.5 font-semibold">Molde</th>
                <th className="py-1.5 font-semibold">Tipo</th>
                <th className="py-1.5 font-semibold">Peça trocada</th>
                <th className="py-1.5 font-semibold">Responsável</th>
                <th className="py-1.5 text-right font-semibold">Duração</th>
                <th className="py-1.5 font-semibold">Descrição</th>
              </tr>
            </thead>
            <tbody>
              {maintRows.map((p, i) => (
                <tr key={p.id || i} className="border-b border-slate-200">
                  <td className="py-1.5 whitespace-nowrap">{p.date?.split('-').reverse().join('/')}</td>
                  <td className="py-1.5 font-medium text-slate-900">{p.mold.name}</td>
                  <td className="py-1.5">{p.maintenance_type}</td>
                  <td className="py-1.5 text-slate-600">{p.replaced_part || '—'}</td>
                  <td className="py-1.5 text-slate-600">{p.technician || '—'}</td>
                  <td className="py-1.5 text-right">{p.duration_minutes ? fmtDur(p.duration_minutes) : '—'}</td>
                  <td className="py-1.5 text-slate-600">{p.description || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Como ler esta ficha">
        <p className="text-xs text-slate-600 leading-relaxed">
          A <strong>vida útil</strong> é medida em ciclos de moldagem: moldes com uso até 70% estão normais 🟢, de 70%
          a 90% em atenção 🟠 e a partir de 90% críticos 🔴, quando devem ser avaliados para manutenção ou substituição.
          As manutenções listadas são as registradas no período selecionado no topo da ficha.
        </p>
      </Section>
    </>
  );
}