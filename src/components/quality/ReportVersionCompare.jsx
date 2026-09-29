import { useMemo, useState } from 'react';
import {
  parseReportNumber, versionBadge, compareReports, characteristicLabelForReport,
} from '@/lib/qualityNorms';
import { X, GitCompare } from 'lucide-react';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR');
}

// Comparação lado a lado entre versões de laudo (ORIGINAL × RECALCULADO),
// com DIFERENÇA dos valores numéricos relevantes.
export default function ReportVersionCompare({ report, reports, onClose }) {
  const chain = useMemo(() => {
    const rootId = report.original_report_id || report.id;
    const versions = (reports || []).filter(r =>
      r.id === rootId || r.original_report_id === rootId);
    return versions.sort((a, b) =>
      ((a.report_version || 1) - (b.report_version || 1)) ||
      String(a.report_number).localeCompare(String(b.report_number)));
  }, [report, reports]);

  const [leftId, setLeftId] = useState(report.original_report_id || report.id);
  const [rightId, setRightId] = useState(report.id);

  const left = chain.find(r => r.id === leftId) || chain[0];
  const right = chain.find(r => r.id === rightId) || chain[0];
  const leftLabel = left ? characteristicLabelForReport(left) : 'fpk';
  const rightLabel = right ? characteristicLabelForReport(right) : 'fpk';

  const diffs = useMemo(() => (left && right ? compareReports(left, right) : null), [left, right]);

  if (!left || !right) return null;
  const complianceText = v => (v == null ? '—' : v ? 'CONFORME' : 'NÃO CONFORME');

  const Row = ({ label, leftValue, rightValue, diff, tone }) => (
    <tr className="border-b border-border">
      <td className="px-3 py-2 text-xs text-muted-foreground font-medium">{label}</td>
      <td className="px-3 py-2 text-sm">{leftValue}</td>
      <td className="px-3 py-2 text-sm">{rightValue}</td>
      <td className={`px-3 py-2 text-sm text-right ${tone || ''}`}>{diff ?? '—'}</td>
    </tr>
  );

  const complianceDiff = (left.is_compliant != null && right.is_compliant != null && left.is_compliant !== right.is_compliant)
    ? `${complianceText(left.is_compliant)} → ${complianceText(right.is_compliant)}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card rounded-xl shadow-xl border border-border w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <GitCompare className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Comparar Versões</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {parseReportNumber(report.report_number).base} — {chain.length} versão(ões)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <select value={leftId} onChange={e => setLeftId(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              {chain.map(r => (
                <option key={r.id} value={r.id}>{r.report_number} — {versionBadge(r.report_number)}</option>
              ))}
            </select>
            <select value={rightId} onChange={e => setRightId(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
              {chain.map(r => (
                <option key={r.id} value={r.id}>{r.report_number} — {versionBadge(r.report_number)}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-border bg-muted/40 p-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resultado Original</div>
            <div className="rounded-lg border border-border bg-muted/40 p-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resultado Recalculado</div>
            <div className="rounded-lg border border-border bg-muted/40 p-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Diferença</div>
          </div>

          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full">
              <tbody>
                <Row label="Nº do Laudo" leftValue={left.report_number} rightValue={right.report_number} />
                <Row label="Versão" leftValue={versionBadge(left.report_number)} rightValue={versionBadge(right.report_number)} />
                <Row label="Norma" leftValue={left.norm_reference} rightValue={right.norm_reference} />
                <Row label="Revisão Normativa" leftValue={left.norm_revision || '—'} rightValue={right.norm_revision || '—'} />
                <Row label="Resistência Média (MPa)" leftValue={left.average_resistance != null ? left.average_resistance.toFixed(2) : '—'}
                  rightValue={right.average_resistance != null ? right.average_resistance.toFixed(2) : '—'}
                  diff={diffs?.average_resistance?.difference} />
                <Row label="Resistência Mínima (MPa)" leftValue={left.min_resistance != null ? left.min_resistance.toFixed(2) : '—'}
                  rightValue={right.min_resistance != null ? right.min_resistance.toFixed(2) : '—'}
                  diff={diffs?.min_resistance?.difference} />
                <Row label={`Resistência Característica (${rightLabel})`} leftValue={left.characteristic_resistance != null ? left.characteristic_resistance.toFixed(2) : '—'}
                  rightValue={right.characteristic_resistance != null ? right.characteristic_resistance.toFixed(2) : '—'}
                  diff={diffs?.characteristic_resistance?.difference} />
                <Row label={`Rótulo (${leftLabel} / ${rightLabel})`} leftValue={leftLabel} rightValue={rightLabel} />
                <Row label={`${leftLabel} de Projeto (MPa)`} leftValue={left.target_resistance || '—'} rightValue={right.target_resistance || '—'}
                  diff={diffs?.target_resistance?.difference} />
                <Row label="Conformidade" leftValue={complianceText(left.is_compliant)} rightValue={complianceText(right.is_compliant)} diff={complianceDiff} />
                <Row label="Status" leftValue={left.status || '—'} rightValue={right.status || '—'} />
                <Row label="Data do Ensaio" leftValue={fmtDate(left.test_date)} rightValue={fmtDate(right.test_date)} />
                <Row label="Motor de Cálculo" leftValue={left.calculation_version || 'legado'} rightValue={right.calculation_version || 'legado'} />
              </tbody>
            </table>
          </div>

          {(right.original_report_id || right.recalculated_at) && (
            <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2 text-sm">
              <p className="text-xs font-bold uppercase text-muted-foreground">Recálculo — Auditoria</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Usuário Responsável</p>
                  <p className="font-medium">{right.recalculated_by || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Data do Recálculo</p>
                  <p className="font-medium">{fmtDateTime(right.recalculated_at)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Motivo</p>
                  <p className="font-medium">{right.recalculation_reason || '—'}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm border border-border text-muted-foreground hover:bg-muted">Fechar</button>
          </div>
        </div>
      </div>
    </div>
  );
}