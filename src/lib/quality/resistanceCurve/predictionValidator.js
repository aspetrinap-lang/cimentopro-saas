// Validação de previsões (PREVER → MEDIR → COMPARAR → VALIDAR → APRENDER).
// A previsão original NUNCA é apagada nem alterada: apenas recebe o resultado
// real (actual_strength), o erro e a data de validação.
import { mean, round2 } from './stats';

// Emparelha previsões pendentes (actual_strength null) com resultados reais
// posteriores à previsão, do mesmo produto (e traço, quando conhecido) e idade.
// O "real" é a média dos resultados medidos após a previsão naquela idade.
export function validatePending(predictions, results) {
  const updates = [];
  (predictions || []).forEach((p) => {
    if (p.actual_strength != null) return; // já validada — preservada
    const age = Number(p.target_age_days) || 0;
    if (!age) return;
    const matches = (results || []).filter(
      (r) =>
        r.product_id === p.product_id &&
        age === Number(r.age_days) &&
        (!p.trace_id || !r.trace_id || p.trace_id === r.trace_id) &&
        r.date && r.date > String(p.prediction_date || '').slice(0, 10)
    );
    if (matches.length === 0) return;
    const actual = round2(mean(matches.map((m) => m.value)));
    if (actual == null || actual <= 0) return;
    const pred = Number(p.predicted_strength) || 0;
    updates.push({
      id: p.id,
      actual_strength: actual,
      prediction_error: pred > 0 ? round2(actual - pred) : null,
      prediction_error_pct: pred > 0 ? round2(((actual - pred) / pred) * 100) : null,
      validated_at: new Date().toISOString(),
    });
  });
  return updates;
}

// Métricas acumuladas sobre previsões JÁ validadas (nunca inventadas —
// sem validações suficientes, as métricas permanecem nulas).
export function validationMetrics(predictions) {
  const v = (predictions || []).filter((p) => p.actual_strength != null);
  if (v.length === 0) return null;
  const abs = v.map((p) => Math.abs(p.prediction_error || 0));
  const mae = mean(abs);
  const rmse = Math.sqrt(mean(v.map((p) => Math.pow(p.prediction_error || 0, 2))));
  const pe = v.filter((p) => p.prediction_error_pct != null).map((p) => Math.abs(p.prediction_error_pct));
  const withBounds = v.filter((p) => p.lower_bound != null && p.upper_bound != null);
  const coverage = withBounds.filter((p) => p.actual_strength >= p.lower_bound && p.actual_strength <= p.upper_bound);
  return {
    count: v.length,
    mae: round2(mae),
    rmse: round2(rmse),
    mape: pe.length ? round2(mean(pe)) : null,
    bias: round2(mean(v.map((p) => p.prediction_error || 0))),
    coverage_pct: withBounds.length ? Math.round((coverage.length / withBounds.length) * 100) : null,
    records: v,
  };
}