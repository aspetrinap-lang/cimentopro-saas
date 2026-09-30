// Persistência das previsões do motor de curva de resistência.
// Entidade StrengthPrediction — multi-tenant (company_id obrigatório).
// Regras:
//  - A previsão original NUNCA é apagada nem alterada depois de criada;
//    a validação apenas ADICIONA o resultado real, o erro e a data.
//  - Dedupe: só cria nova previsão quando o valor projetado mudou
//    (previsão idêntica pendente para mesma produto/traço/idade é reaproveitada).
import { base44 } from '@/api/base44Client';
import { scopedFilter } from '@/lib/companyScope';
import { validatePending } from './resistanceCurve/predictionValidator';

export async function loadPredictions() {
  return base44.entities.StrengthPrediction.filter(scopedFilter({}), '-created_date', 500);
}

// Grava as previsões da curva e valida as pendentes contra laudos posteriores.
// curve: estrutura do resistanceCurveEngine (com results normalizados).
export async function syncPredictions(curve) {
  if (!curve || !curve.company_id || !curve.product_id) {
    return { created: 0, validated: 0 };
  }
  const existing = await loadPredictions();

  // 1. Criação das previsões atuais (apenas idades SEM resultado real ainda).
  const realAges = new Set(curve.real.points.map((p) => p.age_days));
  const toCreate = [];
  (curve.ai.points || []).forEach((p) => {
    if (realAges.has(p.age_days)) return;
    const duplicate = existing.some(
      (e) =>
        e.product_id === curve.product_id &&
        (e.trace_id || null) === (curve.trace_id || null) &&
        Number(e.target_age_days) === p.age_days &&
        e.actual_strength == null &&
        Math.abs((Number(e.predicted_strength) || 0) - p.value) < 0.005
    );
    if (duplicate) return;
    toCreate.push({
      company_id: curve.company_id,
      product_id: curve.product_id,
      product_name: curve.product_name || '',
      trace_id: curve.trace_id || '',
      trace_name: curve.trace_name || '',
      prediction_date: new Date().toISOString(),
      target_age_days: p.age_days,
      predicted_strength: p.value,
      lower_bound: p.lower,
      upper_bound: p.upper,
      model_version: curve.engine_version,
      model_method: curve.ai.method || '',
      confidence: curve.ai.confidence || 'BAIXA',
    });
  });
  if (toCreate.length > 0) {
    await base44.entities.StrengthPrediction.bulkCreate(toCreate);
  }

  // 2. Validação das pendentes contra resultados reais posteriores.
  const all = toCreate.length > 0 ? await loadPredictions() : existing;
  const updates = validatePending(all, curve.results || []);
  if (updates.length > 0) {
    await base44.entities.StrengthPrediction.bulkUpdate(updates);
  }
  return { created: toCreate.length, validated: updates.length };
}