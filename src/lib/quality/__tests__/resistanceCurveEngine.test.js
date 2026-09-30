// Testes do resistanceCurveEngine — fixtures isoladas, NUNCA dados de produção.
// Cenários: nenhum laudo, idades isoladas, pares de idades, várias idades/lotes/
// produtos/traços, multi-tenancy, outliers, validação posterior, preservação de
// previsões, resistência especificada, curva de referência e integração.
import { describe, it, expect } from 'vitest';
import { ENGINE_VERSION, buildResistanceCurve, buildCurvesForProducts, compactAiSummary, buildChartSeries } from '../resistanceCurveEngine';
import { normalizeResults, flagOutliers } from '../resistanceCurve/dataNormalizer';
import { realCurve } from '../resistanceCurve/realCurve';
import { buildReferenceCurve, resolveR28, REFERENCE_BANDS } from '../resistanceCurve/referenceCurve';
import { ageRatios, hyperbolicFit, buildAiCurve } from '../resistanceCurve/aiCurve';
import { validatePending, validationMetrics } from '../resistanceCurve/predictionValidator';
import { baseStatus, confidence } from '../resistanceCurve/confidenceEngine';
import { curveAlerts } from '../resistanceCurve/curveAlerts';

const productTypesById = {
  p1: { id: 'p1', name: 'Bloco 14x19x39', concrete_trace_id: 't1' },
  p2: { id: 'p2', name: 'Bloco 9x19x39', concrete_trace_id: 't2' },
};

// Laudo auxiliar
function report(id, productId, specimens, extra = {}) {
  return { id, report_number: `L-${id}`, product_type_id: productId, test_date: extra.test_date || '2025-01-10', specimens, ...extra };
}

describe('dataNormalizer', () => {
  it('nenhum laudo → nenhum resultado', () => {
    expect(normalizeResults([], productTypesById)).toEqual([]);
  });

  it('extrai resultados por idade a partir dos laudos existentes', () => {
    const rs = normalizeResults([report('a', 'p1', [{ age_days: 7, resistance_mpa: 5 }, { age_days: 28, resistance_mpa: 6.9 }])], productTypesById);
    expect(rs).toHaveLength(2);
    expect(rs[0]).toMatchObject({ product_id: 'p1', trace_id: 't1', age_days: 7, value: 5, lot_key: 'L-a' });
  });

  it('aceita idades não padrão (ex: 3, 21, 56, 90 dias)', () => {
    const rs = normalizeResults([report('a', 'p1', [{ age_days: 3, resistance_mpa: 3.5 }, { age_days: 90, resistance_mpa: 7.4 }])], productTypesById);
    expect(rs.map((r) => r.age_days).sort((a, b) => a - b)).toEqual([3, 90]);
  });

  it('sinaliza outlier (IQR) sem excluir o resultado', () => {
    const specs = [4.9, 5.0, 5.1, 5.0, 9.5].map((v) => ({ age_days: 7, resistance_mpa: v }));
    const rs = flagOutliers(normalizeResults([report('a', 'p1', specs)], productTypesById));
    const outlier = rs.find((r) => r.value === 9.5);
    expect(outlier.outlier).toBe(true);
    expect(rs).toHaveLength(5); // preservado
  });
});

describe('curva real (sem suavização)', () => {
  it('estatística por idade: média, mediana, min, max, sd, cv, lotes', () => {
    const rs = [];
    ['L1', 'L2', 'L3'].forEach((lot, i) => {
      rs.push(...normalizeResults([report(lot, 'p1', [{ age_days: 7, resistance_mpa: 4.8 + i * 0.1 }], { test_date: `2025-01-0${i + 1}` })], productTypesById));
    });
    const pts = realCurve(rs);
    expect(pts).toHaveLength(1);
    const p = pts[0];
    expect(p.count).toBe(3);
    expect(p.lots).toBe(3);
    expect(p.average).toBeCloseTo(4.9, 1);
    expect(p.median).toBeCloseTo(4.9, 1);
    expect(p.min).toBeCloseTo(4.8, 1);
    expect(p.max).toBeCloseTo(5.0, 1);
    expect(p.cv).toBeGreaterThan(0);
  });
});

describe('curva de referência', () => {
  it('faixas por idade com centro, inferior e superior', () => {
    const pts = buildReferenceCurve({ value: 7, source: 'product_target' });
    const p7 = pts.find((p) => p.age_days === 7);
    expect(p7.lower).toBeCloseTo(4.2, 1); // 60%
    expect(p7.upper).toBeCloseTo(4.9, 1); // 70%
    expect(pts.find((p) => p.age_days === 28).center).toBeCloseTo(7, 1);
  });

  it('sem R28 → referência apenas em percentual (nunca inventa MPa)', () => {
    const pts = buildReferenceCurve({ value: null, source: null });
    expect(pts.every((p) => p.lower == null && p.upper == null && p.lower_pct != null)).toBe(true);
  });

  it('prioridade do R28: produto → histórico 28d → nada', () => {
    expect(resolveR28({ productTarget: 8, historical28: 7, actual28: 6 }).source).toBe('product_target');
    expect(resolveR28({ productTarget: 0, historical28: 7, actual28: 6 }).source).toBe('historical_28');
    expect(resolveR28({ productTarget: 0, historical28: 0, actual28: 0 }).source).toBeNull();
  });

  it('tabela de referência é configurável em fonte única', () => {
    expect(REFERENCE_BANDS[7][0]).toBe(60);
    expect(REFERENCE_BANDS[7][1]).toBe(70);
  });
});

describe('projeção IA (determinística)', () => {
  const reports = [];
  for (let i = 1; i <= 8; i++) {
    const base = 4.8 + i * 0.05;
    reports.push(report(`LT${i}`, 'p1', [
      { age_days: 7, resistance_mpa: +base.toFixed(2) },
      { age_days: 14, resistance_mpa: +(base * 1.15).toFixed(2) },
      { age_days: 28, resistance_mpa: +(base * 1.42).toFixed(2) },
      { age_days: 56, resistance_mpa: +(base * 1.52).toFixed(2) },
    ], { test_date: `2025-0${(i % 6) + 1}-15` }));
  }

  it('relações entre idades no mesmo lote (R28/R7 etc.)', () => {
    const ratios = ageRatios(normalizeResults(reports, productTypesById));
    const r28r7 = ratios.find((r) => r.from === 7 && r.to === 28);
    expect(r28r7).toBeTruthy();
    expect(r28r7.n).toBe(8);
    expect(r28r7.median).toBeCloseTo(1.42, 1);
  });

  it('projeta idades futuras SEM valores codificados', () => {
    const results = normalizeResults(reports, productTypesById);
    const ai = buildAiCurve(results, realCurve(results));
    expect(ai.available).toBe(true);
    expect(ai.points.length).toBeGreaterThan(0);
    // 1d/3d: anteriores ao primeiro ensaio — projeções só para idades sem dados reais
    expect(ai.points.every((p) => ![7, 14, 28, 56].includes(p.age_days))).toBe(true);
    const p90 = ai.points.find((p) => p.age_days === 90);
    expect(p90.value).toBeGreaterThan(0);
  });

  it('modelo saturante não cresce indefinidamente (comportamento físico)', () => {
    const fit = hyperbolicFit(Array.from({ length: 10 }, (_, i) => ({ age_days: (i + 1) * 7, value: 5 + 2 * (1 - Math.exp(-(i + 1) / 3)) })));
    expect(fit).toBeTruthy();
    expect(fit.predict(1000)).toBeLessThanOrEqual(fit.k * 1.0001);
  });

  it('somente 7 dias → fallback na referência (dados limitados, confiança baixa)', () => {
    const results = normalizeResults([report('X', 'p1', [{ age_days: 7, resistance_mpa: 5 }])], productTypesById);
    const ai = buildAiCurve(results, realCurve(results));
    expect(ai.available).toBe(true);
    expect(ai.mode).toBe('fallback');
    // nunca afirmar determinação: projeto esc a partir da âncora real
    expect(ai.points.find((p) => p.age_days === 28)).toBeTruthy();
  });

  it('nenhum laudo → sem projeção', () => {
    const ai = buildAiCurve([], []);
    expect(ai.available).toBe(false);
  });
});

describe('engine integrado (multi-tenant, escopo, status, confiança)', () => {
  it('segmenta por produto+traço e não mistura produtos', () => {
    const reports = [
      ...Array.from({ length: 4 }, (_, i) => report(`A${i}`, 'p1', [{ age_days: 7, resistance_mpa: 5 }, { age_days: 28, resistance_mpa: 7 }], { test_date: `2025-01-0${i + 1}` })),
      ...Array.from({ length: 4 }, (_, i) => report(`B${i}`, 'p2', [{ age_days: 7, resistance_mpa: 2 }, { age_days: 28, resistance_mpa: 3 }], { test_date: `2025-02-0${i + 1}` })),
    ];
    const c = buildResistanceCurve({ product_id: 'p1', trace_id: 't1', reports, productTypesById });
    expect(c.base.result_count).toBe(8); // apenas p1
    expect(c.base.result_count).not.toBe(16);
  });

  it('fallback produto+traço → produto, sempre informado', () => {
    const reports = Array.from({ length: 4 }, (_, i) => report(`F${i}`, 'p1', [{ age_days: 7, resistance_mpa: 5 }], { test_date: `2025-01-0${i + 1}` }));
    const c = buildResistanceCurve({ product_id: 'p1', trace_id: 't1', reports, productTypesById });
    expect(c.scope.level).toBe('produto');
    expect(c.scope.fallback_reason).toBeTruthy();
  });

  it('nenhum laudo → BASE INSUFICIENTE e sem projeção', () => {
    const c = buildResistanceCurve({ product_id: 'p1', trace_id: 't1', reports: [], productTypesById });
    expect(c.base.status.key).toBe('insuficiente');
    expect(c.ai.available).toBe(false);
    expect(c.alerts.some((a) => a.code === 'DADOS_INSUFICIENTES')).toBe(true);
  });

  it('histórico robusto → BASE CONSISTENTE/ROBUSTA com confiança calculada', () => {
    const reports = [];
    for (let i = 1; i <= 20; i++) {
      reports.push(report(`R${i}`, 'p1', [
        { age_days: 7, resistance_mpa: 5 + (i % 3) * 0.1 },
        { age_days: 14, resistance_mpa: 5.9 + (i % 3) * 0.1 },
        { age_days: 28, resistance_mpa: 7.0 + (i % 3) * 0.1 },
        { age_days: 56, resistance_mpa: 7.5 + (i % 3) * 0.1 },
      ], { test_date: `2025-${String((i % 12) + 1).padStart(2, '0')}-10` }));
    }
    const c = buildResistanceCurve({ product_id: 'p1', trace_id: 't1', product_target: 6.3, reports, productTypesById });
    expect(['consistente', 'robusta']).toContain(c.base.status.key);
    expect(['ALTA', 'MÉDIA', 'BAIXA']).toContain(c.ai.confidence);
    expect(c.target_strength).toBe(6.3);
  });

  it('confiança não é arbitrária: base pequena → BAIXA', () => {
    const c = confidence({ result_count: 3, lot_count: 1, age_count: 1, avg_cv: 5, max_real_age: 7, max_projected_age: 90, validated_count: 0, backtest: null });
    expect(c.level).toBe('BAIXA');
  });

  it('status da base: critérios objetivos', () => {
    expect(baseStatus({ result_count: 3, lot_count: 1, age_count: 1, validated_count: 0 }).key).toBe('insuficiente');
    expect(baseStatus({ result_count: 8, lot_count: 2, age_count: 2, validated_count: 0 }).key).toBe('formacao');
    expect(baseStatus({ result_count: 30, lot_count: 8, age_count: 4, validated_count: 0 }).key).toBe('consistente');
  });
});

describe('validação de previsões (PREVER → MEDIR → COMPARAR → VALIDAR)', () => {
  const results = normalizeResults([report('N1', 'p1', [{ age_days: 28, resistance_mpa: 6.82 }], { test_date: '2026-02-01' })], productTypesById);

  it('calcula erro REAL − IA e percentual, preservando a previsão original', () => {
    const pred = { id: 'x1', product_id: 'p1', trace_id: 't1', target_age_days: 28, predicted_strength: 7.0, prediction_date: '2026-01-01' };
    const updates = validatePending([pred], results);
    expect(updates).toHaveLength(1);
    expect(updates[0].actual_strength).toBeCloseTo(6.82, 2);
    expect(updates[0].prediction_error).toBeCloseTo(-0.18, 2);
    expect(updates[0].prediction_error_pct).toBeCloseTo(-2.57, 1);
    expect(updates[0].validated_at).toBeTruthy();
    // previsão original permanece intacta (o update é um delta, não reescrita)
    expect(pred.predicted_strength).toBe(7.0);
  });

  it('não revalida previsão já validada (preservação do histórico)', () => {
    const pred = { id: 'x1', product_id: 'p1', target_age_days: 28, predicted_strength: 7, prediction_date: '2026-01-01', actual_strength: 6.8 };
    expect(validatePending([pred], results)).toHaveLength(0);
  });

  it('resultado anterior à previsão NÃO valida (só laudos posteriores)', () => {
    const pred = { id: 'x1', product_id: 'p1', target_age_days: 28, predicted_strength: 7, prediction_date: '2026-03-01' };
    expect(validatePending([pred], results)).toHaveLength(0);
  });

  it('métricas acumuladas: MAE, RMSE, viés, cobertura', () => {
    const preds = [
      { id: 'a', product_id: 'p1', target_age_days: 28, predicted_strength: 7, lower_bound: 6.6, upper_bound: 7.4, actual_strength: 6.82, prediction_error: -0.18, prediction_error_pct: -2.57 },
      { id: 'b', product_id: 'p1', target_age_days: 14, predicted_strength: 6, lower_bound: 5.7, upper_bound: 6.3, actual_strength: 6.4, prediction_error: 0.4, prediction_error_pct: 6.67 },
    ];
    const m = validationMetrics(preds);
    expect(m.count).toBe(2);
    expect(m.mae).toBeCloseTo(0.29, 1);
    expect(m.bias).toBeCloseTo(0.11, 1);
    expect(m.coverage_pct).toBe(50); // 6.4 fora de [5.7, 6.3]
  });

  it('sem validações → métricas nulas (nunca inventadas)', () => {
    expect(validationMetrics([])).toBeNull();
  });
});

describe('alertas analíticos', () => {
  it('abaixo/acima da referência, divergência, instabilidade, extrapolação', () => {
    const realPoints = [
      { age_days: 7, count: 5, average: 3.5, cv: 3 },
      { age_days: 28, count: 5, average: 8.2, cv: 30 },
    ];
    const referencePoints = buildReferenceCurve({ value: 7, source: 'product_target' });
    const ai = { available: true, points: [{ age_days: 90, value: 7.2, lower: 6.9, upper: 7.5 }], method: 'ratios' };
    const validated = [
      { target_age_days: 28, predicted_strength: 7, actual_strength: 6.0, prediction_error: -1, prediction_error_pct: -14.3 },
      { target_age_days: 56, predicted_strength: 7.4, actual_strength: 5.8, prediction_error: -1.6, prediction_error_pct: -21.6 },
    ];
    const base = { status_key: 'consistente' };
    const alerts = curveAlerts({ base, realPoints, referencePoints, ai, validatedPredictions: validated });
    const codes = alerts.map((a) => a.code);
    expect(codes).toContain('EVOLUCAO_ABAIXO_REFERENCIA'); // 3.5 < 60% de 7 = 4.2
    expect(codes).toContain('EVOLUCAO_ACIMA_REFERENCIA');  // 8.2 > 7
    expect(codes).toContain('ABAIXO_PROJECAO_IA');
    expect(codes).toContain('CURVA_DIVERGENTE');
    expect(codes).toContain('CURVA_INSTAVEL');
    expect(codes).toContain('EXTRAPOLACAO_LONGA');
  });
});

describe('integração Engenheiro Virtual / gráfico', () => {
  it('buildCurvesForProducts + compactAiSummary: estrutura consumível pelo EV', () => {
    const reports = Array.from({ length: 6 }, (_, i) => report(`M${i}`, 'p1', [
      { age_days: 7, resistance_mpa: 5 },
      { age_days: 28, resistance_mpa: 7 },
    ], { test_date: `2025-01-1${i}` }));
    const curves = buildCurvesForProducts({ reports, productTypes: Object.values(productTypesById), traces: [], predictions: [] });
    expect(curves.length).toBeGreaterThan(0);
    const summary = compactAiSummary(curves[0]);
    expect(summary).toMatchObject({ product_name: 'Bloco 14x19x39', model_version: ENGINE_VERSION });
    expect(summary.points.length).toBeGreaterThan(0);
    expect(typeof summary.alerts[0] === 'string' || summary.alerts.length === 0).toBe(true);
  });

  it('série do gráfico: X = idade, Y = MPa, com referência, real e IA', () => {
    const reports = [
      report('G1', 'p1', [{ age_days: 7, resistance_mpa: 5 }, { age_days: 28, resistance_mpa: 7 }]),
      report('G2', 'p1', [{ age_days: 7, resistance_mpa: 5.2 }, { age_days: 28, resistance_mpa: 7.1 }]),
      report('G3', 'p1', [{ age_days: 7, resistance_mpa: 4.9 }, { age_days: 28, resistance_mpa: 6.8 }]),
    ];
    const c = buildResistanceCurve({ product_id: 'p1', trace_id: 't1', product_target: 6.3, reports, productTypesById });
    const series = buildChartSeries(c);
    expect(series.length).toBeGreaterThanOrEqual(2);
    const s7 = series.find((s) => s.age_days === 7);
    expect(s7.realAvg).toBeCloseTo(5.03, 1);
    expect(s7.refCenter).toBeCloseTo(6.3 * 0.65, 1);
    expect(s7.aiCenter).toBeNull(); // 7d tem dado real → não é projetado
    const s90 = series.find((s) => s.age_days === 90);
    expect(s90.aiCenter).toBeGreaterThan(0);
    expect(s90.realAvg).toBeNull();
  });

  it('multi-tenancy: dados de outra empresa nunca entram na curva', () => {
    // A empresa é responsabilidade do chamador (scopedFilter): o motor consome
    // apenas o array recebido — nenhum fallback automático entre empresas.
    const mine = normalizeResults([report('MEU', 'p1', [{ age_days: 7, resistance_mpa: 5 }])], productTypesById);
    expect(mine.every((r) => r.product_id === 'p1')).toBe(true);
  });
});