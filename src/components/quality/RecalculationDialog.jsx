import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { withCompany } from '@/lib/companyScope';
import {
  getAvailableRevisions, isRevisionValidated, REVISION_STATES,
  characteristicLabelForReport, calculateQualityResult, buildAlerts,
  parseReportNumber, nextVersionNumber, CALCULATION_VERSION,
  PENDING_REVISION_MESSAGE,
} from '@/lib/qualityNorms';
import { X, RefreshCw, AlertTriangle, GitCompare } from 'lucide-react';

// Recálculo CONTROLADO de laudos — operação sempre EXPLÍCITA.
// NUNCA substitui o laudo original (nunca faz update no original): cria um
// NOVO QualityReport (012/26-R1, -R2...) preservando integralmente a versão
// de origem, e registra usuário/data/motivo (auditoria do recálculo).
export default function RecalculationDialog({ report, reports, onClose, onSaved, onCompare }) {
  const available = getAvailableRevisions(report.norm_reference);
  const defaultRevision = available.find(r => r.state === REVISION_STATES.VALIDATED)?.id
    || available[0]?.id
    || '';
  const [revision, setRevision] = useState(report.norm_revision && available.some(r => r.id === report.norm_revision)
    ? report.norm_revision
    : defaultRevision);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const charLabel = characteristicLabelForReport(report);
  const pending = revision ? !isRevisionValidated(report.norm_reference, revision) : false;
  const originalNumber = parseReportNumber(report.report_number).base;

  async function handleConfirm() {
    if (!revision || !reason.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = calculateQualityResult({
        productFamily: report.product_family,
        normReference: report.norm_reference,
        normRevision: revision,
        specimens: report.specimens || [],
        productType: null,
        targetResistance: report.target_resistance,
        finalAgeDays: report.final_age_days,
      });

      const base = parseReportNumber(report.report_number).base;
      const existingNumbers = (reports || [])
        .map(r => r.report_number)
        .filter(n => parseReportNumber(n).base === base);
      const newNumber = nextVersionNumber(base, existingNumbers);

      const finalAge = result.calculationMetadata.final_age_days;
      const hasFinalAge = (report.specimens || []).some(s =>
        Number(s.age_days) === finalAge && Number(s.resistance_mpa) > 0);
      const normAlerts = buildAlerts({
        norm_reference: report.norm_reference,
        average: result.averageResistance,
        min: result.minimumResistance,
        target: result.targetResistance,
        traffic_type: report.traffic_type,
        thickness_ok: report.thickness_ok,
        hasFinalAge,
      });

      const me = await base44.auth.me().catch(() => null);
      const recalculatedBy = me ? (me.full_name || me.email || '—') : '—';

      const { id, created_date, updated_date, created_by_id, company_id, ...rest } = report;
      const payload = {
        ...rest,
        report_number: newNumber,
        product_family: result.productFamily,
        norm_revision: revision,
        characteristic_label: result.characteristicLabel,
        characteristic_resistance: +result.characteristicResistance.toFixed(2),
        estimated_fck: +result.characteristicResistance.toFixed(2),
        average_resistance: +result.averageResistance.toFixed(2),
        min_resistance: +result.minimumResistance.toFixed(2),
        is_compliant: pending ? null : result.complianceStatus === 'APROVADO',
        alerts: [...normAlerts, ...result.warnings],
        report_version: (report.report_version || 1) + 1,
        original_report_id: report.original_report_id || report.id,
        recalculated_from_report_id: report.id,
        recalculation_reason: reason.trim(),
        recalculated_at: new Date().toISOString(),
        recalculated_by: recalculatedBy,
        calculation_version: CALCULATION_VERSION,
        status: pending ? 'Rascunho' : (report.status || 'Emitido'),
      };

      await base44.entities.QualityReport.create(withCompany(payload));
      onSaved?.();
      onClose?.();
    } catch (e) {
      setError(e.message || 'Não foi possível criar a nova versão do laudo.');
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card rounded-xl shadow-xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Recalcular conforme revisão normativa</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Laudo {report.report_number} — {report.product_type_name || 'Artefato'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-muted/40 rounded-lg border border-border p-3 text-xs text-muted-foreground space-y-1">
            <p><span className="font-semibold text-foreground">{charLabel} de projeto:</span> {report.target_resistance ? `${report.target_resistance} MPa` : '—'}</p>
            <p><span className="font-semibold text-foreground">Norma atual:</span> {report.norm_reference}{report.norm_revision ? ` — ${report.norm_revision}` : ' (revisão não registrada — laudo histórico)'}</p>
            <p><span className="font-semibold text-foreground">Base de numeração:</span> {originalNumber}</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Nova Revisão Normativa</label>
            <select
              value={revision}
              onChange={e => setRevision(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {available.map(r => (
                <option key={r.id} value={r.id}>
                  {r.label}{r.state === REVISION_STATES.PENDING ? ' — parâmetros pendentes' : ''}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground mt-1">O laudo original permanece intacto — será criada uma nova versão.</p>
          </div>

          {pending && (
            <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400">{PENDING_REVISION_MESSAGE} A nova versão será criada como Rascunho, sem status de conformidade.</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Motivo do Recálculo *</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Ex: revisão normativa atualizada; correção de dados de ensaio..."
              className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <div className="flex justify-end gap-3">
            {(report.original_report_id || /-R\d+$/.test(report.report_number || '')) && onCompare && (
              <button onClick={onCompare}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border border-border text-muted-foreground hover:bg-muted">
                <GitCompare className="w-4 h-4" /> Comparar versões
              </button>
            )}
            <button onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm border border-border text-muted-foreground hover:bg-muted">Cancelar</button>
            <button onClick={handleConfirm} disabled={loading || !revision || !reason.trim()}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Recalculando...' : 'Executar recálculo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}