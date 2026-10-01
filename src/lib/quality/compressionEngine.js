/**
 * Motor de compressão versionado para pavimentos intertravados de concreto.
 *
 * Orquestra os motores NBR 9781:2013 e NBR 9781:2026, com cálculo
 * individual, estatístico, determinação automática do requisito,
 * validações rigorosas e memória de cálculo auditável.
 *
 * REGRA FUNDAMENTAL: laudos emitidos pela revisão anterior (2013)
 * permanecem integralmente preservados — nunca recalculados.
 */

import {
  NBR_9781_2026_COMPRESSION,
  NBR_9781_2013_COMPRESSION,
  getThicknessFactor,
  getPsi,
  getIndexI,
  getCompressionParams,
} from './normativeParams';

// ── Conversões de unidade (rastreabilidade) ─────────────────
// kN → N: multiplicar por 1000
// cm² → m²: dividir por 10000
// Pa → MPa: dividir por 1000000
// Resultado: f = F[kN] / A[cm²] × 10 → MPa
export function calcIndividualResistance(loadKn, areaCm2) {
  const load = Number(loadKn) || 0;
  const area = Number(areaCm2) || 0;
  if (!load || !area) return 0;
  return (load / area) * 10; // kN/cm² → MPa
}

// ── Motor NBR 9781:2013 (revisão anterior — preservada) ─────
export function calculateCompression2013(specimens, { targetFck = 0 } = {}) {
  const params = NBR_9781_2013_COMPRESSION;
  const values = (specimens || [])
    .map(s => Number(s.resistance_mpa) || 0)
    .filter(v => v > 0);
  const n = values.length;

  const steps = [];
  steps.push({ step: 1, description: `Resistências individuais (n=${n})`, values: values.map(v => +v.toFixed(2)) });

  if (n < params.min_specimens) {
    steps.push({ step: 2, description: `Dados insuficientes — mínimo de ${params.min_specimens} CPs válidos`, error: 'INSUFFICIENT_DATA' });
    return {
      engine: params,
      fpk_est: 0,
      fpk: 0,
      average: 0,
      min: 0,
      std_dev: 0,
      compliant: false,
      approval: null,
      error: 'INSUFFICIENT_DATA',
      error_message: `Mínimo de ${params.min_specimens} corpos de prova válidos.`,
      calculation_memory: { steps, result: null },
    };
  }

  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  const stdDev = Math.sqrt(variance);
  const fpkEst = Math.max(0, mean - params.k_factor * stdDev);
  const minVal = Math.min(...values);

  steps.push({ step: 2, description: 'Média das resistências', value: +mean.toFixed(2) });
  steps.push({ step: 3, description: 'Desvio-padrão (s)', value: +stdDev.toFixed(4) });
  steps.push({ step: 4, description: `fck,est = média − ${params.k_factor} × s`, formula: `${mean.toFixed(2)} − ${params.k_factor} × ${stdDev.toFixed(4)}`, value: +fpkEst.toFixed(2) });
  steps.push({ step: 5, description: 'Menor resistência individual', value: +minVal.toFixed(2) });

  const compliant = targetFck > 0
    ? fpkEst >= targetFck && minVal >= params.min_individual_ratio * targetFck
    : false;
  const approval = !targetFck ? null
    : compliant ? 'APROVADO'
    : fpkEst >= 0.95 * targetFck ? 'ATENÇÃO'
    : 'REPROVADO';

  steps.push({ step: 6, description: `Conformidade: fck,est ${fpkEst.toFixed(2)} ≥ fck ${targetFck}`, value: compliant });

  return {
    engine: params,
    fpk_est: +fpkEst.toFixed(2),
    fpk: +fpkEst.toFixed(2),
    average: +mean.toFixed(2),
    min: +minVal.toFixed(2),
    std_dev: +stdDev.toFixed(4),
    compliant,
    approval,
    error: null,
    calculation_memory: { steps, result: { fpk_est: +fpkEst.toFixed(2), compliant } },
  };
}

// ── Motor NBR 9781:2026 (revisão vigente) ──────────────────
export function calculateCompression2026(specimens, { nominalThicknessMm = 0, targetFck = 0 } = {}) {
  const params = NBR_9781_2026_COMPRESSION;
  const steps = [];

  // 1. Resistências individuais
  const rawValues = (specimens || [])
    .map(s => Number(s.resistance_mpa) || 0)
    .filter(v => v > 0);
  const n = rawValues.length;
  steps.push({ step: 1, description: `Resistências individuais (n=${n})`, values: rawValues.map(v => +v.toFixed(2)) });

  // 2. Validação de n
  if (n < params.min_specimens) {
    steps.push({ step: 2, description: `Dados insuficientes — mínimo de ${params.min_specimens} CPs válidos`, error: 'INSUFFICIENT_DATA' });
    return {
      engine: params,
      fpk_est: 0,
      fpk: 0,
      psi: null,
      thickness_factor: null,
      method: null,
      average: 0,
      min: 0,
      compliant: false,
      approval: null,
      error: 'INSUFFICIENT_DATA',
      error_message: `Mínimo de ${params.min_specimens} corpos de prova válidos (NBR 9781-2:2026).`,
      calculation_memory: { steps, result: null },
    };
  }

  if (n === params.blocked_n) {
    steps.push({ step: 2, description: 'n=17 sem parâmetro normativo validado', error: 'PENDING_STATISTICAL_PARAMETER' });
    return {
      engine: params,
      fpk_est: 0,
      fpk: 0,
      psi: null,
      thickness_factor: null,
      method: null,
      average: 0,
      min: 0,
      compliant: false,
      approval: null,
      error: 'PENDING_STATISTICAL_PARAMETER',
      error_message: 'n=17: não há parâmetro normativo validado na NBR 9781-2:2026 para esta quantidade de corpos de prova.',
      calculation_memory: { steps, result: null },
    };
  }

  // 3. Fator de espessura (p)
  const p = getThicknessFactor(nominalThicknessMm);
  steps.push({ step: 2, description: `Fator de espessura (p) — espessura nominal ${nominalThicknessMm} mm`, value: p });

  // 4. Aplicar fator de espessura às resistências individuais
  const correctedValues = rawValues.map(v => +(v * p).toFixed(4));
  steps.push({ step: 3, description: 'Resistências corrigidas pelo fator p', values: correctedValues.map(v => +v.toFixed(2)) });

  // 5. Ordenação crescente
  const sorted = [...correctedValues].sort((a, b) => a - b);
  steps.push({ step: 4, description: 'Ordenação crescente', values: sorted.map(v => +v.toFixed(2)) });

  // 6. fp(1) — menor resistência individual corrigida
  const fp1 = sorted[0];
  steps.push({ step: 5, description: 'fp(1) — menor resistência individual corrigida', value: +fp1.toFixed(2) });

  // 7. Cálculo de fpk,est
  let fpkEst;
  let method;
  let psi = null;

  if (n >= params.large_sample_threshold) {
    // Amostra grande (n ≥ 18): média − k × s
    method = 'large_sample';
    const mean = sorted.reduce((a, b) => a + b, 0) / n;
    const variance = sorted.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
    const stdDev = Math.sqrt(variance);
    fpkEst = mean - params.large_sample_k * stdDev;
    steps.push({ step: 6, description: `Método: amostra grande (n ≥ ${params.large_sample_threshold})`, method });
    steps.push({ step: 7, description: 'Média das resistências corrigidas', value: +mean.toFixed(2) });
    steps.push({ step: 8, description: 'Desvio-padrão (s)', value: +stdDev.toFixed(4) });
    steps.push({ step: 9, description: `fpk,est = média − ${params.large_sample_k} × s`, formula: `${mean.toFixed(2)} − ${params.large_sample_k} × ${stdDev.toFixed(4)}`, value: +fpkEst.toFixed(2) });
  } else {
    // Amostra pequena (6 ≤ n ≤ 16): 2 × média dos (i−1) menores − fp(i)
    method = 'small_sample';
    const i = getIndexI(n);
    psi = getPsi(n);
    steps.push({ step: 6, description: 'Método: amostra pequena (6 ≤ n ≤ 16)', method });
    steps.push({ step: 7, description: `Índice estatístico (i) para n=${n}`, value: i });
    steps.push({ step: 8, description: `Coeficiente ψ para n=${n}`, value: psi });

    const lowestIminus1 = sorted.slice(0, i - 1);
    const meanIminus1 = lowestIminus1.reduce((a, b) => a + b, 0) / (i - 1);
    const fpI = sorted[i - 1]; // fp(i), 0-indexed

    steps.push({ step: 9, description: `Média dos (i−1)=${i - 1} menores valores`, values: lowestIminus1.map(v => +v.toFixed(2)), value: +meanIminus1.toFixed(2) });
    steps.push({ step: 10, description: `fp(${i}) — ${i}ª menor resistência`, value: +fpI.toFixed(2) });
    fpkEst = 2 * meanIminus1 - fpI;
    steps.push({ step: 11, description: `fpk,est = 2 × média(${i - 1} menores) − fp(${i})`, formula: `2 × ${meanIminus1.toFixed(2)} − ${fpI.toFixed(2)}`, value: +fpkEst.toFixed(2) });
  }

  // 8. Piso: fpk,est ≥ ψ × fp(1)
  let floorApplied = false;
  if (psi != null) {
    const floor = psi * fp1;
    steps.push({ step: 12, description: `Piso: ψ × fp(1) = ${psi} × ${fp1.toFixed(2)}`, value: +floor.toFixed(2) });
    if (fpkEst < floor) {
      steps.push({ step: 13, description: 'fpk,est final = piso (maior valor aplicado)', from: +fpkEst.toFixed(2), to: +floor.toFixed(2) });
      fpkEst = floor;
      floorApplied = true;
    } else {
      steps.push({ step: 13, description: 'fpk,est mantido (acima do piso)' });
    }
  } else {
    steps.push({ step: 12, description: 'Piso não aplicável (amostra grande)' });
  }

  // 9. fpk final
  const fpk = Math.max(0, fpkEst);
  steps.push({ step: 14, description: 'fpk final', value: +fpk.toFixed(2) });

  // 10. Conformidade
  const compliant = targetFck > 0 && fpk >= targetFck;
  const approval = !targetFck ? null
    : compliant ? 'APROVADO'
    : fpk >= 0.95 * targetFck ? 'ATENÇÃO'
    : 'REPROVADO';
  steps.push({ step: 15, description: `Conformidade: fpk ${fpk.toFixed(2)} ≥ fck ${targetFck}`, value: compliant });

  return {
    engine: params,
    fpk_est: +fpk.toFixed(2),
    fpk: +fpk.toFixed(2),
    psi,
    thickness_factor: p,
    method,
    floor_applied: floorApplied,
    fp1: +fp1.toFixed(2),
    average: +(sorted.reduce((a, b) => a + b, 0) / n).toFixed(2),
    min: +fp1.toFixed(2),
    compliant,
    approval,
    error: null,
    calculation_memory: { steps, result: { fpk: +fpk.toFixed(2), psi, thickness_factor: p, method, compliant } },
  };
}

// ── Ponto de entrada unificado ──────────────────────────────
export function calculateCompression(specimens, options = {}, revision = '2013') {
  if (revision === '2026') {
    return calculateCompression2026(specimens, options);
  }
  return calculateCompression2013(specimens, options);
}

export function getEngineMetadata(revision) {
  const params = getCompressionParams(revision);
  return {
    normative_standard: params.normative_standard,
    normative_revision: params.normative_revision,
    test_method_revision: params.test_method_revision,
    engine_name: params.engine_name,
    engine_version: params.engine_version,
    parameter_version: params.parameter_version,
    calculation_timestamp: new Date().toISOString(),
  };
}

// ── Detecção de revisão para laudos históricos ─────────────
// Laudos sem normative_revision são tratados como 2013 (preservação)
export function resolveRevision(report) {
  if (report?.normative_revision) return report.normative_revision;
  return '2013';
}

// ── Alertas específicos do motor 2026 ──────────────────────
export function buildAlerts2026(result, { target, hasFinalAge } = {}) {
  const alerts = [];
  if (!result || result.error) {
    if (result?.error_message) alerts.push(result.error_message);
    return alerts;
  }
  if (target > 0 && result.fpk < target) {
    alerts.push(`fpk estimado (${result.fpk.toFixed(2)} MPa) abaixo do fck de projeto (${target} MPa).`);
  }
  if (result.floor_applied) {
    const floor = result.psi * result.fp1;
    alerts.push(`Piso normativo aplicado: fpk,est limitado a ψ × fp(1) = ${result.psi} × ${result.fp1.toFixed(2)} = ${floor.toFixed(2)} MPa.`);
  }
  if (!hasFinalAge) {
    alerts.push('Ensaio na idade de referência (28 dias) ainda não realizado — conformidade preliminar.');
  }
  return alerts;
}