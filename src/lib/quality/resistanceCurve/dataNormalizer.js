// resistanceCurveEngine — normalização dos resultados dos laudos.
// Os laudos (QualityReport.specimens) são a FONTE DA VERDADE: o motor apenas
// CONSOME os resultados. Nunca altera, recalcula ou substitui valores reais.
import { quantile } from './stats';

// Converte os laudos em resultados normalizados por produto/traço/lote/idade.
// Aceita QUALQUER idade presente nos laudos (1/3/7/14/21/28/56/90/outras) —
// nada é descartado automaticamente. Histórico completo, sem corte de período.
export function normalizeResults(reports, productTypesById = {}) {
  const out = [];
  (reports || []).forEach((r) => {
    const productId = r.product_type_id || null;
    const traceId = (productId && productTypesById[productId]?.concrete_trace_id) || null;
    const date = r.test_date || (r.created_date || '').slice(0, 10) || null;
    (r.specimens || []).forEach((sp) => {
      const age = Number(sp.age_days) || 0;
      const value = Number(sp.resistance_mpa) || 0;
      if (!age || !value) return;
      out.push({
        report_id: r.id,
        report_number: r.report_number || '',
        product_id: productId,
        trace_id: traceId,
        lot_key: r.report_number || r.id,
        age_days: age,
        value,
        date,
      });
    });
  });
  return out;
}

// Detecta possíveis outliers por idade (método IQR, grupo com 4+ valores).
// Sinaliza — NUNCA exclui: o resultado original permanece na curva.
export function flagOutliers(results) {
  const byAge = {};
  (results || []).forEach((r) => {
    (byAge[r.age_days] = byAge[r.age_days] || []).push(r);
  });
  Object.values(byAge).forEach((group) => {
    if (group.length < 4) return;
    const q1 = quantile(group.map((g) => g.value), 0.25);
    const q3 = quantile(group.map((g) => g.value), 0.75);
    const iqr = q3 - q1;
    const lo = q1 - 1.5 * iqr;
    const hi = q3 + 1.5 * iqr;
    group.forEach((r) => {
      r.outlier = r.value < lo || r.value > hi;
    });
  });
  return results;
}