// resistanceCurveEngine v1.0 — motor central de curva de desenvolvimento da resistência.
// Concentra TODA a matemática (normalização, referência, real, projeção IA,
// backtesting, confiança, validação e alertas). O Engenheiro Virtual e os
// cartões apenas CONSOMEM a estrutura final — nunca recalculam.
//
// Ciclo: DADOS REAIS → ANÁLISE → PROJEÇÃO → NOVO ENSAIO → VALIDAÇÃO → APRENDIZADO.
// A curva é uma camada ANALÍTICA e PREDITIVA — não substitui os motores
// normativos (NBR 6136 / NBR 9781) nem os critérios de aceitação dos laudos.
import { normalizeResults, flagOutliers } from './resistanceCurve/dataNormalizer';
import { realCurve } from './resistanceCurve/realCurve';
import { resolveR28, buildReferenceCurve } from './resistanceCurve/referenceCurve';
import { buildAiCurve, STANDARD_AGES } from './resistanceCurve/aiCurve';
import { baseStatus, confidence } from './resistanceCurve/confidenceEngine';
import { curveAlerts } from './resistanceCurve/curveAlerts';
import { validatePending, validationMetrics } from './resistanceCurve/predictionValidator';
import { mean, round2 } from './resistanceCurve/stats';

export const ENGINE_VERSION = 'resistanceCurveEngine v1.0';
export { STANDARD_AGES };

// Constrói a estrutura completa da curva para um produto (+ traço) da empresa.
// Multi-tenant obrigatório: `reports` deve vir SEMPRE filtrado por company_id
// (scopedFilter) — o motor nunca cruza dados de empresas diferentes.
export function buildResistanceCurve({
  company_id,
  product_id,
  product_name,
  dimensions,
  trace_id,
  trace_name,
  product_target,
  reports,
  productTypesById = {},
  storedPredictions = [],
  generated_at,
}) {
  // 1. Histórico COMPLETO dos laudos existentes (sem corte de período).
  const all = flagOutliers(normalizeResults(reports, productTypesById));

  // 2. Segmentação: 1º produto+traço · fallback "mesmo produto" (sempre informado).
  const scope = { level: 'geral', fallback_reason: null };
  let results = all;
  if (product_id) {
    const byProduct = all.filter((r) => r.product_id === product_id);
    const withTrace = trace_id ? byProduct.filter((r) => r.trace_id === trace_id) : byProduct;
    if (trace_id && withTrace.length >= 5) {
      results = withTrace;
      scope.level = 'produto+traço';
    } else if (byProduct.length > 0) {
      results = byProduct;
      scope.level = 'produto';
      if (trace_id) {
        scope.fallback_reason =
          'Histórico do produto+traço insuficiente — curva construída com todo o histórico do produto (fallback informado).';
      }
    } else {
      results = [];
      scope.level = 'produto';
    }
  }

  const dates = results.map((r) => r.date).filter(Boolean).sort();
  const realPoints = realCurve(results);

  // 3. R28 por prioridade (alvo do produto → histórico 28d → real 28d). Nunca inventado.
  const hist28 = mean((results.filter((r) => r.age_days === 28) || []).map((r) => r.value));
  const r28 = resolveR28({ productTarget: Number(product_target) || 0, historical28: hist28, actual28: hist28 });
  const referencePoints = buildReferenceCurve(r28);

  // 4. Projeção IA (determinística) + backtesting.
  const ai = buildAiCurve(results, realPoints);

  // 5. Validação contínua — previsões armazenadas (empresa + produto).
  const ownPredictions = (storedPredictions || []).filter(
    (p) => p.product_id === product_id && (!p.trace_id || !trace_id || p.trace_id === trace_id)
  );
  const validatedPredictions = ownPredictions.filter((p) => p.actual_strength != null);
  const validation = validationMetrics(ownPredictions);

  // 6. Status da base + confiança (critérios objetivos).
  const base = {
    result_count: results.length,
    lot_count: new Set(results.map((r) => r.lot_key)).size,
    age_count: realPoints.length,
    report_count: new Set(results.map((r) => r.report_id)).size,
    period_start: dates[0] || null,
    period_end: dates[dates.length - 1] || null,
  };
  base.status = baseStatus({
    result_count: base.result_count,
    lot_count: base.lot_count,
    age_count: base.age_count,
    validated_count: validatedPredictions.length,
  });
  const avgCv = mean(realPoints.filter((p) => p.cv != null && p.count >= 2).map((p) => p.cv));
  const maxRealAge = realPoints.length ? Math.max(...realPoints.map((p) => p.age_days)) : null;
  const maxProjAge = ai.points.length ? Math.max(...ai.points.map((p) => p.age_days)) : null;
  const conf = confidence({
    result_count: base.result_count,
    lot_count: base.lot_count,
    age_count: base.age_count,
    avg_cv: avgCv,
    max_real_age: maxRealAge,
    max_projected_age: maxProjAge,
    validated_count: validatedPredictions.length,
    backtest: ai.backtest,
  });
  ai.confidence = conf.level;
  ai.confidence_score = conf.score;
  ai.confidence_factors = conf.factors;

  // 7. Alertas analíticos (informativos, nunca normativos).
  const alerts = curveAlerts({
    base: { status_key: base.status.key },
    realPoints,
    referencePoints,
    ai,
    validatedPredictions,
  });

  // 8. Auditoria — o usuário consegue saber de onde a curva foi construída.
  const audit = {
    company_id,
    product_id,
    product_name,
    trace_id,
    trace_name,
    period_start: base.period_start,
    period_end: base.period_end,
    report_count: base.report_count,
    result_count: base.result_count,
    lot_count: base.lot_count,
    ages_used: realPoints.map((p) => p.age_days),
    model_method: ai.method,
    model_version: ENGINE_VERSION,
    data_source: 'QualityReport.specimens (laudos históricos da empresa)',
    generated_at: generated_at || null,
    scope: scope.level,
  };

  return {
    company_id,
    product_id,
    product_name,
    dimensions,
    trace_id,
    trace_name,
    target_strength: Number(product_target) || null,
    r28,
    reference: { r28_source: r28.source, points: referencePoints },
    real: { points: realPoints, max_age: maxRealAge },
    ai,
    base,
    scope,
    validation,
    alerts,
    audit,
    engine_version: ENGINE_VERSION,
    results, // normalizados (com flag de outlier) — usados na validação de previsões
  };
}

// Curvas para vários produtos (resumo para o Engenheiro Virtual / interpretação IA).
export function buildCurvesForProducts({
  company_id,
  reports,
  productTypes = [],
  traces = [],
  predictions = [],
  maxProducts = 5,
  generated_at,
}) {
  const productTypesById = Object.fromEntries(productTypes.map((p) => [p.id, p]));
  const tracesById = Object.fromEntries(traces.map((t) => [t.id, t]));
  const all = flagOutliers(normalizeResults(reports, productTypesById));
  const counts = {};
  all.forEach((r) => {
    if (!r.product_id) return;
    (counts[r.product_id] = counts[r.product_id] || []).push(r);
  });
  const top = Object.entries(counts)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, maxProducts);
  return top.map(([productId]) => {
    const pt = productTypesById[productId];
    const traceId = pt?.concrete_trace_id || null;
    return buildResistanceCurve({
      company_id,
      product_id: productId,
      product_name: pt?.name,
      trace_id: traceId,
      trace_name: traceId ? tracesById[traceId]?.name : null,
      product_target: Number(pt?.target_resistance) || 0,
      reports,
      productTypesById,
      storedPredictions: predictions,
      generated_at,
    });
  });
}

// Resumo compacto e determinístico — entrada da interpretação do Engenheiro
// Virtual e do fingerprint de cache. O EV usa linguagem de tendência/projeção/
// estimativa/confiança — NUNCA trata a projeção como garantia.
export function compactAiSummary(curve) {
  if (!curve) return null;
  const ageSet = new Set([
    ...curve.real.points.map((p) => p.age_days),
    ...curve.reference.points.map((p) => p.age_days),
    ...curve.ai.points.map((p) => p.age_days),
  ]);
  const points = [...ageSet]
    .sort((a, b) => a - b)
    .map((age) => {
      const real = curve.real.points.find((p) => p.age_days === age);
      const ref = curve.reference.points.find((p) => p.age_days === age);
      const aiP = curve.ai.points.find((p) => p.age_days === age);
      return {
        age,
        real: real ? real.average : null,
        ref_lower: ref?.lower ?? null,
        ref_center: ref?.center ?? null,
        ref_upper: ref?.upper ?? null,
        ai_center: aiP ? aiP.value : null,
        ai_lower: aiP ? aiP.lower : null,
        ai_upper: aiP ? aiP.upper : null,
      };
    });
  return {
    product_name: curve.product_name,
    trace_name: curve.trace_name,
    scope: curve.scope.level,
    fallback_reason: curve.scope.fallback_reason,
    result_count: curve.base.result_count,
    lot_count: curve.base.lot_count,
    period_start: curve.base.period_start,
    period_end: curve.base.period_end,
    base_status_label: curve.base.status.label,
    r28_source: curve.r28.source,
    confidence: curve.ai.confidence,
    model_method: curve.ai.method,
    model_version: curve.engine_version,
    backtest: curve.ai.backtest
      ? { n: curve.ai.backtest.n, mae: curve.ai.backtest.mae, mape: curve.ai.backtest.mape }
      : null,
    validation: curve.validation
      ? {
          count: curve.validation.count,
          mae: curve.validation.mae,
          bias: curve.validation.bias,
          coverage_pct: curve.validation.coverage_pct,
        }
      : null,
    points,
    alerts: (curve.alerts || []).map((a) => `${a.code}: ${a.message}`),
  };
}

// Série unificada para o gráfico (X = idade, Y = MPa) — consumida pelos cartões.
export function buildChartSeries(curve) {
  const ageSet = new Set([
    ...curve.real.points.map((p) => p.age_days),
    ...curve.reference.points.map((p) => p.age_days),
    ...curve.ai.points.map((p) => p.age_days),
  ]);
  return [...ageSet]
    .sort((a, b) => a - b)
    .map((age) => {
      const real = curve.real.points.find((p) => p.age_days === age);
      const ref = curve.reference.points.find((p) => p.age_days === age);
      const aiP = curve.ai.points.find((p) => p.age_days === age);
      return {
        age_days: age,
        realAvg: real ? real.average : null,
        realCount: real ? real.count : 0,
        refLower: ref ? ref.lower ?? null : null,
        refCenter: ref ? ref.center ?? null : null,
        refUpper: ref ? ref.upper ?? null : null,
        refLowerPct: ref ? ref.lower_pct : null,
        refUpperPct: ref ? ref.upper_pct : null,
        aiCenter: aiP ? aiP.value : null,
        aiLower: aiP ? aiP.lower : null,
        aiUpper: aiP ? aiP.upper : null,
      };
    });
}

export { round2 };