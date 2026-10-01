/**
 * Motor de compressão versionado para BLOCOS VAZADOS DE CONCRETO
 * PARA ALVENARIA — ABNT NBR 6136-1:2026 (Requisitos) + NBR 6136-2:2026
 * (Métodos de ensaio).
 *
 * blockCompressionEngine v2026.1
 *
 * CAMADAS (nunca misturadas):
 *   1 — CÁLCULO: fb individual e fbk estimado.
 *   2 — VALIDAÇÃO DO ENSAIO: n, dimensões, área, força, idade,
 *       velocidade, preparação, equipamento, dados obrigatórios.
 *   3 — CONFORMIDADE DO PRODUTO: fbk_estimado ≥ fbk_especificado.
 *   4 — DECISÃO DO LOTE: fluxo prova/contraprova.
 *
 * REGRAS FUNDAMENTAIS:
 * - fbk especificado vem do cadastro do produto (ProductType).
 * - Área BRUTA é utilizada (nunca a líquida).
 * - Ψ é consultado na tabela versionada (nunca hardcoded).
 * - Laudos históricos NUNCA são recalculados.
 */

import {
  NBR_6136_2026_COMPRESSION,
  NBR_6136_2016_COMPRESSION,
  getBlockCompressionParams,
  getBlockPsi,
  getBlockIndexI,
  validateLoadingRate,
} from './blockNormativeParams';
import { round2 } from './resistanceCurve/stats';

// ── CAMADA 1: Cálculo individual e estatístico ─────────────

/**
 * Calcula a resistência individual de um corpo de prova de bloco.
 * fb = F / Ab (área bruta, nunca líquida).
 *
 * Aceita ambos os formatos:
 *   - maximum_force_n + gross_area_mm2 (formato 2026)
 *   - rupture_load_kn + area_cm2 (formato legado)
 *
 * Conversões (rastreabilidade):
 *   kN → N: × 1000
 *   cm² → mm²: × 100
 *   N/mm² = MPa
 */
export function calcBlockIndividualResistance(specimen) {
  if (!specimen) return 0;
  const forceN = Number(specimen.maximum_force_n) || (Number(specimen.rupture_load_kn) || 0) * 1000;
  const areaMm2 = Number(specimen.gross_area_mm2) || (Number(specimen.area_cm2) || 0) * 100;
  if (!forceN || !areaMm2) return 0;
  return forceN / areaMm2; // N/mm² = MPa
}

/**
 * Motor NBR 6136-2:2026 — cálculo da resistência característica
 * estimada (fbk,est) para blocos vazados de concreto.
 *
 * @param {Array} specimens — corpos de prova da prova (6 CPs)
 * @param {{fbkEspecificado?: number}} options
 */
export function calculateBlockCompression2026(specimens, { fbkEspecificado = 0 } = {}) {
  const params = NBR_6136_2026_COMPRESSION;
  const steps = [];

  // 1. Resistências individuais (fb = F/Ab, área bruta)
  const rawSpecimens = (specimens || []).filter(s => s);
  const individualResults = rawSpecimens.map((s, idx) => {
    const forceN = Number(s.maximum_force_n) || (Number(s.rupture_load_kn) || 0) * 1000;
    const areaMm2 = Number(s.gross_area_mm2) || (Number(s.area_cm2) || 0) * 100;
    const fb = (forceN && areaMm2) ? forceN / areaMm2 : 0;
    return {
      specimen_id: s.specimen_id || s.id || idx + 1,
      sample_id: s.sample_id || null,
      maximum_force_n: forceN,
      gross_area_mm2: areaMm2,
      individual_strength_mpa: fb,
      failure_mode: s.failure_mode || null,
      validity_status: s.validity_status || (fb > 0 ? 'VALID' : 'INVALID'),
    };
  });

  const validResults = individualResults.filter(r => r.individual_strength_mpa > 0);
  const values = validResults.map(r => r.individual_strength_mpa);
  const n = values.length;

  steps.push({ step: 1, description: `Resistências individuais fb = F/Ab (n=${n})`, values: values.map(v => round2(v)) });

  // 2. Validação de n
  if (n < params.min_specimens) {
    steps.push({ step: 2, description: `Dados insuficientes — mínimo de ${params.min_specimens} CPs válidos`, error: 'INSUFFICIENT_DATA' });
    return {
      engine: params,
      fbk_calculado: 0,
      fbk_minimo_psi: 0,
      fbk_estimado: 0,
      n,
      i: null,
      psi: null,
      method: null,
      compliant: false,
      approval: null,
      error: 'INSUFFICIENT_DATA',
      error_message: `Mínimo de ${params.min_specimens} corpos de prova válidos (NBR 6136-2:2026).`,
      calculation_memory: { steps, result: null },
      individual_results: individualResults,
      sorted_values: [],
    };
  }

  // 3. Ordenação crescente (derivada — valores originais inalterados)
  const sorted = [...values].sort((a, b) => a - b);
  steps.push({ step: 3, description: 'Ordenação crescente (derivada — originais preservados)', values: sorted.map(v => round2(v)) });

  // 4. fb(1) — menor resistência individual
  const fb1 = sorted[0];
  steps.push({ step: 4, description: 'fb(1) — menor resistência individual', value: round2(fb1) });

  // 5. Cálculo do fbk
  let fbkCalculado;
  let method;
  let psi = null;
  let i = null;

  if (n >= params.large_sample_threshold) {
    // Amostra grande (n ≥ 18): média − k × s
    method = 'large_sample';
    const mean = sorted.reduce((a, b) => a + b, 0) / n;
    const variance = sorted.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
    const stdDev = Math.sqrt(variance);
    fbkCalculado = mean - params.large_sample_k * stdDev;
    steps.push({ step: 5, description: `Método: amostra grande (n ≥ ${params.large_sample_threshold})`, method });
    steps.push({ step: 6, description: 'Média das resistências', value: round2(mean) });
    steps.push({ step: 7, description: 'Desvio-padrão (s)', value: round2(stdDev) });
    steps.push({ step: 8, description: `fbk,cal = média − ${params.large_sample_k} × s`, formula: `${mean.toFixed(4)} − ${params.large_sample_k} × ${stdDev.toFixed(4)}`, value: round2(fbkCalculado) });
  } else {
    // Amostra pequena (6 ≤ n ≤ 16): 2 × média dos (i−1) menores − fb(i)
    method = 'small_sample';
    i = getBlockIndexI(n);
    psi = getBlockPsi(n);
    steps.push({ step: 5, description: 'Método: amostra pequena (6 ≤ n ≤ 16)', method });
    steps.push({ step: 6, description: `Índice estatístico (i) para n=${n}`, value: i });
    steps.push({ step: 7, description: `Coeficiente Ψ para n=${n}`, value: psi });

    const lowestIminus1 = sorted.slice(0, i - 1);
    const meanIminus1 = lowestIminus1.reduce((a, b) => a + b, 0) / (i - 1);
    const fbI = sorted[i - 1]; // fb(i), 0-indexed

    steps.push({ step: 8, description: `Média dos (i−1)=${i - 1} menores valores`, values: lowestIminus1.map(v => round2(v)), value: round2(meanIminus1) });
    steps.push({ step: 9, description: `fb(${i}) — ${i}ª menor resistência`, value: round2(fbI) });
    fbkCalculado = 2 * meanIminus1 - fbI;
    steps.push({ step: 10, description: `fbk,cal = 2 × média(${i - 1} menores) − fb(${i})`, formula: `2 × ${meanIminus1.toFixed(4)} − ${fbI.toFixed(4)}`, value: round2(fbkCalculado) });
  }

  // 6. Piso: fbk ≥ Ψ × fb(1)
  let floorApplied = false;
  let fbkMinimoPsi = 0;
  if (psi != null) {
    fbkMinimoPsi = psi * fb1;
    steps.push({ step: 11, description: `Piso: Ψ × fb(1) = ${psi} × ${fb1.toFixed(4)}`, value: round2(fbkMinimoPsi) });
    if (fbkCalculado < fbkMinimoPsi) {
      steps.push({ step: 12, description: 'fbk final = piso (maior valor aplicado)', from: round2(fbkCalculado), to: round2(fbkMinimoPsi) });
      fbkCalculado = fbkMinimoPsi;
      floorApplied = true;
    } else {
      steps.push({ step: 12, description: 'fbk mantido (acima do piso)' });
    }
  } else {
    steps.push({ step: 11, description: 'Piso não aplicável (amostra grande)' });
  }

  // 7. fbk estimado
  const fbkEstimado = Math.max(0, fbkCalculado);
  steps.push({ step: 13, description: 'fbk estimado (MAX do calculado e do piso)', value: round2(fbkEstimado) });

  // ── CAMADA 3: Conformidade do produto ───────────────────
  const fbkEsp = Number(fbkEspecificado) || 0;
  const compliant = fbkEsp > 0 && fbkEstimado >= fbkEsp;
  const approval = !fbkEsp ? null
    : compliant ? 'CONFORME'
    : 'NÃO CONFORME';
  steps.push({ step: 14, description: `Conformidade: fbk estimado ${fbkEstimado.toFixed(2)} ≥ fbk especificado ${fbkEsp}`, value: compliant });

  return {
    engine: params,
    fbk_calculado: round2(fbkCalculado),
    fbk_minimo_psi: round2(fbkMinimoPsi),
    fbk_estimado: round2(fbkEstimado),
    n,
    i,
    psi,
    method,
    floor_applied: floorApplied,
    fb1: round2(fb1),
    fbk_especificado: fbkEsp,
    compliant,
    approval,
    error: null,
    calculation_memory: { steps, result: { fbk_estimado: round2(fbkEstimado), psi, i, method, compliant } },
    individual_results: individualResults,
    sorted_values: sorted.map(v => round2(v)),
  };
}

// ── Motor NBR 6136:2016 (revisão anterior — preservada) ────
export function calculateBlockCompression2016(specimens, { targetFbk = 0 } = {}) {
  const params = NBR_6136_2016_COMPRESSION;
  const values = (specimens || [])
    .map(s => Number(s.resistance_mpa) || Number(s.individual_strength_mpa) || 0)
    .filter(v => v > 0);
  const n = values.length;

  const steps = [];
  steps.push({ step: 1, description: `Resistências individuais (n=${n})`, values: values.map(v => round2(v)) });

  if (n < params.min_specimens) {
    steps.push({ step: 2, description: `Dados insuficientes — mínimo de ${params.min_specimens} CPs válidos`, error: 'INSUFFICIENT_DATA' });
    return {
      engine: params,
      fbk_est: 0,
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
  const fbkEst = Math.max(0, mean - params.k_factor * stdDev);
  const minVal = Math.min(...values);

  steps.push({ step: 2, description: 'Média das resistências', value: round2(mean) });
  steps.push({ step: 3, description: 'Desvio-padrão (s)', value: round2(stdDev) });
  steps.push({ step: 4, description: `fbk,est = média − ${params.k_factor} × s`, formula: `${mean.toFixed(2)} − ${params.k_factor} × ${stdDev.toFixed(4)}`, value: round2(fbkEst) });
  steps.push({ step: 5, description: 'Menor resistência individual', value: round2(minVal) });

  const compliant = targetFbk > 0
    ? fbkEst >= targetFbk && minVal >= params.min_individual_ratio * targetFbk
    : false;
  const approval = !targetFbk ? null
    : compliant ? 'CONFORME'
    : fbkEst >= 0.95 * targetFbk ? 'ATENÇÃO'
    : 'NÃO CONFORME';

  steps.push({ step: 6, description: `Conformidade: fbk,est ${fbkEst.toFixed(2)} ≥ fbk ${targetFbk}`, value: compliant });

  return {
    engine: params,
    fbk_est: round2(fbkEst),
    average: round2(mean),
    min: round2(minVal),
    std_dev: round2(stdDev),
    compliant,
    approval,
    error: null,
    calculation_memory: { steps, result: { fbk_est: round2(fbkEst), compliant } },
  };
}

// ── CAMADA 2: Validação do ensaio ──────────────────────────
/**
 * Valida os dados do ensaio de compressão de blocos.
 * Não bloqueia por idade (aviso não bloqueante conforme regra normativa).
 * Dados incompletos impedem a conclusão.
 */
export function validateBlockTest(specimens, options = {}) {
  const errors = [];
  const warnings = [];

  const validSpecs = (specimens || []).filter(s => {
    const fb = Number(s.individual_strength_mpa) || calcBlockIndividualResistance(s);
    return fb > 0;
  });

  // n de corpos de prova
  if (validSpecs.length < NBR_6136_2026_COMPRESSION.min_specimens) {
    errors.push(`Número insuficiente de corpos de prova válidos: ${validSpecs.length} (mínimo ${NBR_6136_2026_COMPRESSION.min_specimens}).`);
  }

  // Dimensões e área
  validSpecs.forEach((s, idx) => {
    const hasDims = (Number(s.length_mm) > 0 && Number(s.width_mm) > 0 && Number(s.height_mm) > 0)
      || (Number(s.gross_area_mm2) > 0);
    if (!hasDims) {
      errors.push(`CP ${idx + 1}: dimensões ou área bruta não informadas.`);
    }
    const hasForce = Number(s.maximum_force_n) > 0 || Number(s.rupture_load_kn) > 0;
    if (!hasForce) {
      errors.push(`CP ${idx + 1}: força máxima de ruptura não informada.`);
    }
  });

  // Idade (aviso não bloqueante)
  const ages = validSpecs.map(s => Number(s.age_days) || 0).filter(a => a > 0);
  if (ages.length && !ages.some(a => a === 28)) {
    warnings.push('Ensaio não realizado aos 28 dias (idade de referência) — conformidade preliminar.');
  }

  // Velocidade de carregamento
  if (options.loading_rate_mpa_s != null && options.fbk_especificado) {
    const lr = validateLoadingRate(options.loading_rate_mpa_s, options.fbk_especificado);
    if (lr.status === 'FORA_DO_LIMITE') {
      warnings.push(`Velocidade de carregamento ${lr.message}`);
    }
  }

  // Equipamento
  if (options.equipment) {
    const eq = options.equipment;
    if (!eq.calibration_number) {
      warnings.push('Certificado de calibração da prensa não informado.');
    }
    if (eq.calibration_date && eq.calibration_valid_until) {
      const validUntil = new Date(eq.calibration_valid_until);
      if (validUntil < new Date()) {
        warnings.push('Calibração da prensa vencida — verificar validade do certificado.');
      }
    }
    if (!eq.equipment_accuracy_class) {
      warnings.push('Classe de acurácia da prensa não registrada.');
    }
  }

  // Condição de preparação/umidade
  if (options.preparation_condition && !options.humidity_relative_percent) {
    warnings.push('Condição de preparação informada sem registro de umidade relativa.');
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── CAMADA 4: Decisão do lote (prova/contraprova) ──────────
/**
 * Decide o resultado final do lote com base no fluxo prova/contraprova.
 * A contraprova NUNCA é somada à prova — cálculo independente.
 *
 * @param {{compliant: boolean, fbk_estimado: number}} proofResult
 * @param {{compliant: boolean, fbk_estimado: number}|null} counterproofResult
 * @param {string} counterproofState — NOT_REQUIRED|AVAILABLE|REQUIRED|IN_PROGRESS|COMPLETED
 */
export function decideLot(proofResult, counterproofResult, counterproofState) {
  if (!proofResult) return { final_lot_result: null, counterproof_required: false };

  // Prova conforme → lote aprovado, contraprova não necessária
  if (proofResult.compliant) {
    return {
      final_lot_result: 'CONFORME',
      counterproof_required: false,
      counterproof_state: counterproofState || 'NOT_REQUIRED',
    };
  }

  // Prova não conforme → contraprova pode ser necessária
  const required = counterproofState === 'REQUIRED' || counterproofState === 'IN_PROGRESS' || counterproofState === 'COMPLETED';

  if (counterproofResult && counterproofState === 'COMPLETED') {
    // Contraprova executada — resultado final baseado na contraprova
    return {
      final_lot_result: counterproofResult.compliant ? 'CONFORME' : 'NÃO CONFORME',
      counterproof_required: true,
      counterproof_state: 'COMPLETED',
    };
  }

  return {
    final_lot_result: proofResult.compliant ? 'CONFORME' : 'NÃO CONFORME',
    counterproof_required: !proofResult.compliant,
    counterproof_state: counterproofState || (proofResult.compliant ? 'NOT_REQUIRED' : 'AVAILABLE'),
  };
}

// ── Ponto de entrada unificado ──────────────────────────────
export function calculateBlockCompression(specimens, options = {}, revision = '2016') {
  if (revision === '2026') {
    return calculateBlockCompression2026(specimens, options);
  }
  return calculateBlockCompression2016(specimens, options);
}

export function getBlockEngineMetadata(revision) {
  const params = getBlockCompressionParams(revision);
  return {
    normative_standard: params.normative_standard,
    normative_requirements: params.normative_requirements,
    normative_version: params.normative_version,
    test_method_revision: params.test_method_revision,
    requirements_revision: params.requirements_revision,
    engine_name: params.engine_name,
    engine_version: params.engine_version,
    parameter_version: params.parameter_version,
    calculation_timestamp: new Date().toISOString(),
  };
}

// ── Detecção de revisão para laudos históricos ─────────────
// Laudos sem normative_revision são tratados como 2016 (preservação)
export function resolveBlockRevision(report) {
  if (report?.normative_revision) return report.normative_revision;
  return '2016';
}

// ── Alertas específicos do motor 2026 (blocos) ────────────
export function buildBlockAlerts2026(result, { fbkEspecificado, hasFinalAge } = {}) {
  const alerts = [];
  if (!result || result.error) {
    if (result?.error_message) alerts.push(result.error_message);
    return alerts;
  }
  if (fbkEspecificado > 0 && result.fbk_estimado < fbkEspecificado) {
    alerts.push(`fbk estimado (${result.fbk_estimado.toFixed(2)} MPa) abaixo do fbk especificado (${fbkEspecificado} MPa).`);
  }
  if (result.floor_applied) {
    const floor = result.psi * result.fb1;
    alerts.push(`Piso normativo aplicado: fbk,est limitado a Ψ × fb(1) = ${result.psi} × ${result.fb1.toFixed(2)} = ${floor.toFixed(2)} MPa.`);
  }
  if (!hasFinalAge) {
    alerts.push('Ensaio na idade de referência (28 dias) ainda não realizado — conformidade preliminar.');
  }
  return alerts;
}