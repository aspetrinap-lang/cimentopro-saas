import { useEffect, useState } from 'react';
import { scopedFilter } from '@/lib/companyScope';
import { base44 } from '@/api/base44Client';
import { Wrench } from 'lucide-react';
import ReportSheet from './ReportSheet';
import Section from './Section';
import { inRange, fmtDur } from '@/lib/reportUtils';

const fmtDate = (d) => (d ? d.split('-').reverse().join('/') : '—');

// Ficha técnica da Manutenção Preventiva: manutenções de máquinas e moldes
// registradas no período selecionado.
export default function MaintenanceReport({ onClose }) {
  const [maintenances, setMaintenances] = useState(null);

  useEffect(() => {
    base44.entities.PreventiveMaintenance.filter(scopedFilter({}), '-date', 1000).then(setMaintenances);
  }, []);

  return (
    <ReportSheet
      title="Ficha Técnica — Manutenção Preventiva"
      subtitle="Manutenções preventivas de máquinas e moldes registradas no período"
      icon={Wrench}
      onClose={onClose}
    >
      {({ start, end }) =>
        !maintenances ? (
          <p className="text-sm text-slate-500 text-center py-10">Carregando dados do período...</p>
        ) : (
          <Content maintenances={maintenances} start={start} end={end} />
        )
      }
    </ReportSheet>
  );
}

function Content({ maintenances, start, end }) {
  const inRangeM = maintenances.filter((m) => inRange(m.date, start, end));
  const machineM = inRangeM.filter((m) => m.machine_id);
  const moldM = inRangeM.filter((m) => m.mold_id);

  const totalDuration = inRangeM.reduce((s, m) => s + (Number(m.duration_minutes) || 0), 0);

  const byType = {};
  inRangeM.forEach((m) => {
    const t = m.maintenance_type || 'Outros';
    byType[t] = (byType[t] || 0) + 1;
  });
  const topTypes = Object.entries(byType).sort((a, b) => b[1] - a[1]);

  const Table = ({ items, nameKey }) => (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="text-left text-slate-500 border-b border-slate-300">
          <th className="py-1.5 font-semibold">Data</th>
          <th className="py-1.5 font-semibold">{nameKey === 'machine_name' ? 'Máquina' : 'Molde'}</th>
          <th className="py-1.5 font-semibold">Tipo</th>
          <th className="py-1.5 font-semibold">Peça trocada</th>
          <th className="py-1.5 font-semibold">Responsável</th>
          <th className="py-1.5 font-semibold text-right">Duração</th>
        </tr>
      </thead>
      <tbody>
        {items.slice(0, 40).map((m) => (
          <tr key={m.id} className="border-b border-slate-200">
            <td className="py-1.5 text-slate-600 whitespace-nowrap">{fmtDate(m.date)}</td>
            <td className="py-1.5 font-medium text-slate-900">{m[nameKey] || '—'}</td>
            <td className="py-1.5 text-slate-600">{m.maintenance_type || '—'}</td>
            <td className="py-1.5 text-slate-600">{m.replaced_part || '—'}</td>
            <td className="py-1.5 text-slate-600">{m.technician || '—'}</td>
            <td className="py-1.5 text-right">{m.duration_minutes ? fmtDur(m.duration_minutes) : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <>
      <Section title="Resumo do período">
        <p className="text-xs text-slate-600 leading-relaxed">
          <strong>{inRangeM.length}</strong> manutenção(ões) registrada(s) — {machineM.length} de máquinas e {moldM.length} de moldes.
          Tempo total dedicado: <strong>{fmtDur(totalDuration)}</strong>.
          {topTypes.length > 0 && <> Tipos mais frequentes: {topTypes.slice(0, 3).map(([t, n]) => `${t} (${n}×)`).join(', ')}.</>}
        </p>
      </Section>

      <Section title="Manutenções de máquinas">
        {machineM.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhuma manutenção de máquina no período.</p>
        ) : (
          <>
            <Table items={machineM} nameKey="machine_name" />
            {machineM.length > 40 && (
              <p className="text-[10px] text-slate-500 mt-1.5">Exibindo as 40 primeiras de {machineM.length} manutenções.</p>
            )}
          </>
        )}
      </Section>

      <Section title="Manutenções de moldes">
        {moldM.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhuma manutenção de molde no período.</p>
        ) : (
          <>
            <Table items={moldM} nameKey="mold_name" />
            {moldM.length > 40 && (
              <p className="text-[10px] text-slate-500 mt-1.5">Exibindo as 40 primeiras de {moldM.length} manutenções.</p>
            )}
          </>
        )}
      </Section>

      <Section title="Como ler esta ficha">
        <p className="text-xs text-slate-600 leading-relaxed">
          Cada linha é uma manutenção preventiva registrada. A <strong>peça trocada</strong> e o <strong>responsável</strong>
          {' '}documentam a intervenção; a <strong>duração</strong> mede o tempo de máquina indisponível ou dedicado ao serviço.
        </p>
      </Section>
    </>
  );
}