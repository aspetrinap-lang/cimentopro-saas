// MOTOR CENTRAL DE CÁLCULO DE QUALIDADE — fonte única de cálculo do módulo
// de Laudos. Nenhuma tela (Form, View, Quality, Curva, Relatórios) pode ter
// fórmula própria: todas consomem as funções deste arquivo.
//
// Fase estrutural: os cálculos aqui presentes são os mesmos já usados pelo
// sistema (preservação de resultados históricos), apenas ENCAPSULADOS. A
// arquitetura está preparada para que cada revisão normativa tenha seus
// próprios critérios, sem alterar a interface do motor.
//
// Rótulos corretos: fpk (pavimento intertravado) e fbk (bloco de alvenaria).
// O valor legado estimated_fck permanece em todo o sistema por compatibilidade
// (AIAnalysis, AnalysisReport, ResistanceGrowthReport etc.) — nunca apagado.

export const CALCULATION_VERSION = 'quality-engine-1.0';

// Famílias de produto (identificação central — não depende exclusivamente de texto livre)
export const PRODUCT_FAMILY = {
  PAVER: 'PAVER',
  CONCRETE_BLOCK: 'CONCRETE_BLOCK',
};

// Área do DISPOSITIVO DE CARREGAMENTO do pavimento (cm²) — usada no cálculo.
// NÃO é a área geométrica da peça. Blocos NUNCA usam esta área.
export const PAVER_LOADING_DEVICE_AREA_CM2 = 56.75;

// Estados possíveis de uma revisão normativa registrada
export const REVISION_STATES = {
  VALIDATED: 'CONFIGURADA_E_VALIDADA',      // cálculo validado para emissão definitiva
  PENDING: 'PENDENTE_PARAMETRIZACAO',       // selecionável p/ rascunho e recálculo; sem resultado definitivo
};

// Revisões normativas registradas por norma. NUNCA inventar fatores, fórmulas
// ou coeficientes: revisões pendentes seguem com o cálculo estrutural atual
// claramente marcado como preliminar (rascunho), até parametrização validada.
export const NORM_REVISIONS = {
  'NBR 9781': [
    { id: 'NBR 9781:2013', label: 'ABNT NBR 9781:2013', state: 'CONFIGURADA_E_VALIDADA' },
    { id: 'NBR 9781-1:2026', label: 'ABNT NBR 9781-1:2026 (série)', state: 'PENDENTE_PARAMETRIZACAO' },
    { id: 'NBR 9781-2:2026', label: 'ABNT NBR 9781-2:2026 (série)', state: 'PENDENTE_PARAMETRIZACAO' },
  ],
  'NBR 6136': [
    { id: 'NBR 6136:2018', label: 'ABNT NBR 6136:2018', state: 'CONFIGURADA_E_VALIDADA' },
    { id: 'NBR 6136:2026', label: 'ABNT NBR 6136:2026 (série)', state: 'PENDENTE_PARAMETRIZACAO' },
  ],
};

export const PENDING_REVISION_MESSAGE =
  'Esta revisão normativa está disponível para seleção, porém seus parâmetros de cálculo ainda não foram validados/configurados para emissão definitiva.';

// Revisão padrão (validada) por norma — usada como seleção inicial na emissão
export const DEFAULT_REVISION_BY_NORM = {
  'NBR 9781': 'NBR 9781:2013',
  'NBR 6136': 'NBR 6136:2018',
};

// ---------- PAVIMENTO INTERTRAVADO (PAVER) — NBR 9781 ----------

// Fator multiplicativo p (Tabela A.1) por revisão normativa. Valores da
// NBR 9781:2013 confirmados no texto do Anexo A da norma (60 → 0,95 |
// 80 → 1,00 | 100 → 1,05). A série 2026 permanece VAZIA até parametrização
// validada — NUNCA copiar automaticamente os fatores de 2013.
export const PAVER_THICKNESS_FACTORS = {
  'NBR 9781:2013': { 60: 0.95, 80: 1.00, 100: 1.05 },
  'NBR 9781:2026': {},
};

// Tabela A.2 — Coeficiente de Student (confiança de 80%) — EXCLUSIVA da
// NBR 9781:2013 (Anexo A). Configuração normativa FECHADA: sem interpolação,
// extrapolação ou cálculo estatístico de fallback.
export const PAVER_STUDENT_TABLE_2013 = {
  6: 0.920, 7: 0.906, 8: 0.896, 9: 0.889, 10: 0.883, 12: 0.876,
  14: 0.870, 16: 0.866, 18: 0.863, 20: 0.861, 22: 0.859, 24: 0.858,
  26: 0.856, 28: 0.855, 30: 0.854, 32: 0.842,
};

// Revisões da série 2026 (pendentes de parametrização própria)
function isPaverRevision2026(revisionId) {
  return /:2026$/.test(String(revisionId || ''));
}

// Fator p da espessura NOMINAL (nunca medida, largura, comprimento, categoria
// ou valor digitado). Arquitetura aberta a novas espessuras: basta registrar
// o par espessura → p na tabela central da revisão.
export function getPaverThicknessFactor({ nominalThicknessMm, normRevision }) {
  const revision = normRevision || 'NBR 9781:2013';
  if (isPaverRevision2026(revision)) {
    return { status: 'PENDENTE_PARAMETRIZACAO', p: null, warning: 'Revisão normativa 2026 sem fatores p parametrizados/validados (Tabela A.1).' };
  }
  const table = PAVER_THICKNESS_FACTORS[revision];
  const t = Number(nominalThicknessMm);
  if (!table || !t || table[t] == null) {
    return { status: 'PENDENTE_PARAMETRIZACAO', p: null, warning: 'Espessura nominal sem fator p configurado na Tabela A.1 da revisão normativa selecionada.' };
  }
  return { status: 'OK', p: table[t] };
}

// Resistência individual do pavimento: fp = (F / A) × p.
// Conversões EXPLÍCITAS e únicas — kN → N, cm² → m²; a área é SEMPRE a do
// dispositivo de carregamento (nunca a geométrica da peça); p aplicado 1 vez.
export function calculatePaverIndividualResistance({ ruptureLoadKn, loadingAreaCm2, pFactor }) {
  const forceN = Number(ruptureLoadKn) * 1000;
  const areaM2 = Number(loadingAreaCm2) / 10000;
  const resistanceMpa = (forceN / areaM2) / 1000000;
  const correctedResistanceMpa = resistanceMpa * Number(pFactor);
  return { forceN, areaM2, resistanceMpa, correctedResistanceMpa };
}

// Estatísticas descritivas da amostra (aceita números ou objetos de CP)
function paverSampleStats(resistances) {
  const values = (resistances || [])
    .map(r => Number(typeof r === 'object' ? r?.resistance_mpa : r) || 0)
    .filter(v => v > 0);
  const n = values.length;
  const mean = n ? values.reduce((a, b) => a + b, 0) / n : 0;
  const s = n > 1 ? Math.sqrt(values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1)) : null;
  return { values, n, mean, s };
}

// fpk,est NBR 9781:2013 (Anexo A): fpk,est = fp − t × s, t da Tabela A.2.
// Tamanho de amostra fora da tabela → PENDING_STATISTICAL_PARAMETER (nada de
// interpolar, extrapolar, calcular t por distribuição ou usar 1,65);
// n < 6 → INSUFFICIENT_SAMPLE. Estatísticas descritivas seguem disponíveis.
export function estimatePaverFpk2013({ resistances }) {
  const { values, n, mean, s } = paverSampleStats(resistances);
  const method = 'NBR 9781:2013 — Tabela A.2';
  if (n < 6) {
    return { status: 'INSUFFICIENT_SAMPLE', fpk_est: null, fp: mean, s, student_n: n, student_t: null, statistical_method: method, warning: `Amostra insuficiente (n = ${n}) — o mínimo previsto na Tabela A.2 da NBR 9781:2013 é n = 6.` };
  }
  const t = PAVER_STUDENT_TABLE_2013[n];
  if (t == null) {
    return { status: 'PENDING_STATISTICAL_PARAMETER', fpk_est: null, fp: mean, s, student_n: n, student_t: null, statistical_method: method, warning: 'Tamanho de amostra fora da Tabela A.2 da NBR 9781:2013. O fpk,est não foi calculado.' };
  }
  return { status: 'OK', fpk_est: Math.max(0, mean - t * s), fp: mean, s, student_n: n, student_t: t, statistical_method: method, warning: null };
}

// fpk,est revisão 2026 — SEM parametrização estatística própria validada:
// nunca reutilizar a Tabela A.2 (nem os fatores p) de 2013. Média e
// desvio-padrão podem ser exibidos; fpk,est normativo NÃO é calculado.
export function estimatePaverFpk2026({ resistances }) {
  const { n, mean, s } = paverSampleStats(resistances);
  return { status: 'PENDENTE_PARAMETRIZACAO', fpk_est: null, fp: mean, s, student_n: n, student_t: null, statistical_method: null, warning: 'Revisão normativa 2026 sem parametrização estatística validada — fpk,est não calculado.' };
}

// Porta única do fpk,est de pavimento, por revisão normativa.
export function estimatePaverFpk({ normRevision, resistances }) {
  if (isPaverRevision2026(normRevision)) return estimatePaverFpk2026({ resistances });
  if (normRevision === 'NBR 9781:2013') return estimatePaverFpk2013({ resistances });
  // Laudo sem revisão registrada (histórico): critério estrutural de
  // compatibilidade (média − 1,65 × s) — NÃO é resultado normativo definitivo.
  const { n, mean, s } = paverSampleStats(resistances);
  if (n < 3 || s == null) {
    return { status: 'INSUFFICIENT_SAMPLE', fpk_est: null, fp: mean, s, student_n: n, student_t: null, statistical_method: 'estrutural — média − 1,65 × s', warning: 'Amostra insuficiente para estimativa da resistência característica.' };
  }
  return { status: 'OK', fpk_est: Math.max(0, mean - 1.65 * s), fp: mean, s, student_n: n, student_t: null, statistical_method: 'estrutural — média − 1,65 × s', warning: null };
}

// Conformidade do pavimento na idade de referência: fpk,est ≥ fpk especificado.
export function evaluatePaverCompliance({ normRevision, targetResistance, characteristicResistance, finalAgeDays, referenceAgeDays }) {
  if (isPaverRevision2026(normRevision)) {
    return { status: 'PENDENTE_PARAMETRIZACAO', warnings: [PENDING_REVISION_MESSAGE] };
  }
  if (!targetResistance || characteristicResistance == null) {
    return { status: 'INDEFINIDO', warnings: characteristicResistance == null ? ['fpk,est não calculado — a conformidade normativa não pode ser avaliada.'] : [] };
  }
  const warnings = [];
  const ref = Number(referenceAgeDays) || 28;
  if (Number(finalAgeDays) < ref) {
    warnings.push(`Ensaio aos ${finalAgeDays} dias, antes da idade de referência (${ref} dias) — conformidade preliminar.`);
  }
  return {
    status: Number(characteristicResistance) >= Number(targetResistance) ? 'CONFORME' : 'NAO_CONFORME',
    warnings,
  };
}

// ---------- FAMÍLIA DO PRODUTO ----------

// Resolve a família a partir do artefato. Ordem de prioridade:
// 1) product_family explícito (novo cadastro);
// 2) texto de categoria/nome (fallback de leitura);
// 3) classe da norma (35/50 numéricas → pavimento; A/B/C → bloco).
// Para laudos antigos SEM o campo, é fallback somente de LEITURA — nunca
// gravado automaticamente no banco.
export function resolveQualityProductFamily(productType) {
  if (!productType) return null;
  if (productType.product_family === PRODUCT_FAMILY.PAVER) return PRODUCT_FAMILY.PAVER;
  if (productType.product_family === PRODUCT_FAMILY.CONCRETE_BLOCK) return PRODUCT_FAMILY.CONCRETE_BLOCK;
  const text = `${productType.category || ''} ${productType.name || ''}`.toLowerCase();
  if (/pavimento|paver|intertravad|meio[- ]?fio/.test(text)) return PRODUCT_FAMILY.PAVER;
  if (/bloco/.test(text)) return PRODUCT_FAMILY.CONCRETE_BLOCK;
  const cls = String(productType.norm_class || '').trim();
  if (cls === '35' || cls === '50') return PRODUCT_FAMILY.PAVER;
  if (/^[ABC]$/.test(cls)) return PRODUCT_FAMILY.CONCRETE_BLOCK;
  return null;
}

export function familyForNormReference(normReference) {
  if (normReference === 'NBR 9781') return PRODUCT_FAMILY.PAVER;
  if (normReference === 'NBR 6136') return PRODUCT_FAMILY.CONCRETE_BLOCK;
  return null;
}

export function normReferenceForFamily(family) {
  if (family === PRODUCT_FAMILY.PAVER) return 'NBR 9781';
  if (family === PRODUCT_FAMILY.CONCRETE_BLOCK) return 'NBR 6136';
  return null;
}

// ---------- RÓTULOS (fpk / fbk) ----------

export function characteristicLabelForFamily(family) {
  if (family === PRODUCT_FAMILY.PAVER) return 'fpk';
  if (family === PRODUCT_FAMILY.CONCRETE_BLOCK) return 'fbk';
  return null;
}

export function characteristicLabelForNorm(normReference) {
  return characteristicLabelForFamily(familyForNormReference(normReference));
}

// Rótulo efetivo para exibição de um laudo: usa o rótulo armazenado; para
// laudos históricos sem o campo, faz fallback somente de leitura.
export function characteristicLabelForReport(report) {
  if (report?.characteristic_label) return report.characteristic_label;
  const family = report?.product_family || familyForNormReference(report?.norm_reference);
  return characteristicLabelForFamily(family) || 'fck';
}

// ---------- REVISÕES NORMATIVAS ----------

export function getAvailableRevisions(normReference) {
  return NORM_REVISIONS[normReference] || [];
}

export function getRevisionState(normReference, revisionId) {
  const found = getAvailableRevisions(normReference).find(r => r.id === revisionId);
  return found ? found.state : null;
}

export function isRevisionValidated(normReference, revisionId) {
  return getRevisionState(normReference, revisionId) === REVISION_STATES.VALIDATED;
}

// Revisão é selecionável quando registrada (validada OU pendente)
export function isRevisionSelectable(normReference, revisionId) {
  return getRevisionState(normReference, revisionId) != null;
}

// ---------- CÁLCULOS (fase estrutural — mesmos critérios atuais) ----------

export function calcAreaCm2(spec, normReference) {
  // Pavimento intertravado (NBR 9781): área do dispositivo de carregamento, fixa
  if (normReference === 'NBR 9781') return PAVER_LOADING_DEVICE_AREA_CM2;
  // Bloco: área geométrica largura × comprimento
  const w = Number(spec.width_mm) || 0;
  const l = Number(spec.length_mm) || 0;
  if (!w || !l) return 0;
  return (w * l) / 100; // mm² → cm²
}

export function calcResistance(spec, normReference) {
  const load = Number(spec.rupture_load_kn) || 0;
  const area = Number(spec.area_cm2) || calcAreaCm2(spec, normReference);
  if (!load || !area) return 0;
  return (load / area) * 10; // kN/cm² → MPa
}

// Corpo de prova de PAVIMENTO: espessura nominal por CP (fallback: padrão do
// laudo → height_mm legado, pois para paver altura = espessura); área fixa do
// dispositivo; fator p por espessura nominal. Sem fator p configurado, a
// resistência individual fica SEM correção (nunca apresentada como fp
// corrigido) e o resultado final é impedido de sair como fpk normativo.
function computePaverSpecimen(spec, opts = {}) {
  const area = Number(spec.loading_area_cm2) || PAVER_LOADING_DEVICE_AREA_CM2;
  const nominalRaw = Number(spec.nominal_thickness_mm) > 0 ? spec.nominal_thickness_mm
    : (Number(opts.nominalThicknessMm) > 0 ? opts.nominalThicknessMm : spec.height_mm);
  const nominal = Number(nominalRaw) > 0 ? Number(nominalRaw) : null;
  const load = Number(spec.rupture_load_kn) || 0;
  const fRes = getPaverThicknessFactor({ nominalThicknessMm: nominal, normRevision: opts.normRevision });
  const raw = load > 0 ? (load / area) * 10 : 0; // kN/cm² → MPa (sem p)
  const resistance = fRes.p != null ? raw * fRes.p : raw;
  return {
    ...spec,
    area_cm2: +area.toFixed(2),
    loading_area_cm2: area,
    nominal_thickness_mm: nominal,
    p_factor: fRes.p,
    p_status: fRes.status,
    resistance_mpa: +resistance.toFixed(2),
  };
}

export function computeSpecimen(spec, normReference, opts = {}) {
  // Pavimento intertravado (NBR 9781): área do dispositivo + fator p
  if (normReference === 'NBR 9781') return computePaverSpecimen(spec, opts);
  const area = calcAreaCm2(spec, normReference);
  const resistance = calcResistance({ ...spec, area_cm2: area }, normReference);
  return {
    ...spec,
    area_cm2: +area.toFixed(2),
    resistance_mpa: +resistance.toFixed(2),
  };
}

// Agrupa corpos de prova por idade (dias)
export function groupByAge(specimens) {
  const groups = {};
  (specimens || []).forEach(s => {
    const age = Number(s.age_days ?? s.test_age_days) || 0;
    if (!groups[age]) groups[age] = [];
    groups[age].push(s);
  });
  return Object.entries(groups)
    .map(([age, specs]) => ({ age_days: Number(age), specimens: specs }))
    .sort((a, b) => a.age_days - b.age_days);
}

// Média e mínima de um conjunto de corpos de prova
export function ageStats(specs) {
  const values = (specs || []).map(s => Number(s.resistance_mpa) || 0).filter(v => v > 0);
  if (!values.length) return { average: 0, min: 0 };
  return {
    average: values.reduce((a, b) => a + b, 0) / values.length,
    min: Math.min(...values),
  };
}

// Resistência mínima por tipo de tráfego (NBR 9781) — MPa (fallback sem classe)
export const MIN_RESISTANCE_BY_TRAFFIC = {
  'Pedestres/Leves': 35,
  'Pesado': 35,
};

// Verifica conformidade dimensional da espessura (NBR 9781): variação ≤ 3 mm
export const DIMENSIONAL_TOLERANCE_MM = 3;
export function checkThickness(nominal, measured) {
  if (nominal == null || measured == null) return true; // sem dados → não alerta
  return Math.abs(Number(measured) - Number(nominal)) <= DIMENSIONAL_TOLERANCE_MM;
}

// Gera alertas informativos (não bloqueantes)
export function buildAlerts({ norm_reference, average, min, target, traffic_type, thickness_ok, hasFinalAge }) {
  const alerts = [];
  if (target > 0) {
    if (average < target) {
      alerts.push(`Resistência média (${average.toFixed(2)} MPa) abaixo do fck de projeto (${target} MPa).`);
    }
    if (min < 0.8 * target) {
      alerts.push(`Menor resistência individual (${min.toFixed(2)} MPa) inferior a 80% do fck (0,8 × ${target} = ${(0.8 * target).toFixed(2)} MPa).`);
    }
  }
  if (norm_reference === 'NBR 9781') {
    const minResist = MIN_RESISTANCE_BY_TRAFFIC[traffic_type];
    if (minResist && average > 0 && average < minResist) {
      alerts.push(`Resistência média (${average.toFixed(2)} MPa) abaixo do mínimo da NBR 9781 para tráfego ${traffic_type} (${minResist} MPa).`);
    }
    if (thickness_ok === false) {
      alerts.push(`Espessura medida fora da tolerância de ±${DIMENSIONAL_TOLERANCE_MM} mm da nominal (NBR 9781).`);
    }
  }
  if (!hasFinalAge) {
    alerts.push('Ensaio na idade de referência (28 dias) ainda não realizado — conformidade preliminar.');
  }
  return alerts;
}

// Estimativa de resistência característica pela média e desvio-padrão da amostra
// (critério estrutural atual): R,est = média − 1,65 × s (mínimo de 3 CPs válidos)
export function estimateCharacteristicResistance(specimens) {
  const values = (specimens || [])
    .map(s => Number(s.resistance_mpa) || 0)
    .filter(v => v > 0);
  if (values.length < 3) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (values.length - 1);
  const stdDev = Math.sqrt(variance);
  return Math.max(0, mean - 1.65 * stdDev);
}

// Conformidade (critério estrutural atual): média ≥ alvo E mínima ≥ 0,8 × alvo
export function checkCompliance({ average, min, target }) {
  if (!target || !average) return false;
  return average >= target && min >= 0.8 * target;
}

// Critério de aprovação (estrutural): R,est ≥ alvo → APROVADO; 95–100% → ATENÇÃO
// Retorna 'APROVADO' | 'ATENÇÃO' | 'REPROVADO' | null (sem dados)
export function checkApproval({ estimatedFck, target }) {
  if (!target || !estimatedFck) return null;
  if (estimatedFck >= target) return 'APROVADO';
  if (estimatedFck >= 0.95 * target) return 'ATENÇÃO';
  return 'REPROVADO';
}

// ---------- INTERFACE PRINCIPAL DO MOTOR ----------

// calculateQualityResult — única porta de cálculo de resultado de laudo.
// Não muta os dados de entrada (preservação de laudos históricos).
export function calculateQualityResult({
  productFamily,
  normReference,
  normRevision,
  specimens,
  productType,
  targetResistance,
  finalAgeDays,
}) {
  const family = productFamily
    || familyForNormReference(normReference)
    || resolveQualityProductFamily(productType);
  const characteristicLabel = characteristicLabelForFamily(family) || 'fck';

  const computed = (specimens || []).map(s => computeSpecimen(s, normReference, {
    nominalThicknessMm: productType?.nominal_thickness_mm ?? productType?.height_mm ?? null,
    normRevision,
  }));
  const groups = groupByAge(computed);
  const final_age_days = Number(finalAgeDays)
    || (groups.length ? Math.max(...groups.map(g => g.age_days)) : 0);
  const finalGroup = groups.find(g => g.age_days === final_age_days) || { specimens: [] };
  const { average, min } = ageStats(finalGroup.specimens);
  const target = Number(targetResistance) || 0;
  const warnings = [];

  const isPaverFamily = family === PRODUCT_FAMILY.PAVER;

  // fpk,est do pavimento pela revisão normativa (Tabela A.2); blocos e laudos
  // sem revisão seguem o critério estrutural de compatibilidade.
  let characteristicResistance;
  let paverEstimation = null;
  if (isPaverFamily && normRevision) {
    paverEstimation = estimatePaverFpk({ normRevision, resistances: finalGroup.specimens });
    characteristicResistance = paverEstimation.status === 'OK' ? paverEstimation.fpk_est : null;
    const missingP = finalGroup.specimens.some(s => Number(s.rupture_load_kn) > 0 && s.p_factor == null);
    if (missingP) {
      paverEstimation = { ...paverEstimation, status: 'PENDENTE_PARAMETRIZACAO', fpk_est: null };
      characteristicResistance = null;
      warnings.push('Fator p não configurado para a espessura nominal de um ou mais corpos de prova — fpk,est normativo não calculado.');
    } else if (paverEstimation.warning) {
      warnings.push(paverEstimation.warning);
    }
  } else {
    characteristicResistance = estimateCharacteristicResistance(finalGroup.specimens);
  }

  const revision_state = normRevision ? getRevisionState(normReference, normRevision) : null;
  const pending = normRevision ? !isRevisionValidated(normReference, normRevision) : false;

  let complianceStatus;
  if (pending) {
    complianceStatus = 'PENDENTE_PARAMETRIZACAO';
  } else if (isPaverFamily && normRevision) {
    const paverCompliance = evaluatePaverCompliance({
      normRevision,
      targetResistance: target,
      characteristicResistance,
      finalAgeDays: final_age_days,
      referenceAgeDays: finalAgeDays || 28,
    });
    (paverCompliance.warnings || []).forEach(w => warnings.push(w));
    complianceStatus = paverCompliance.status === 'CONFORME' ? 'APROVADO'
      : paverCompliance.status === 'NAO_CONFORME' ? 'REPROVADO'
      : 'INDEFINIDO';
  } else if (!target || !characteristicResistance) {
    complianceStatus = 'INDEFINIDO';
  } else {
    complianceStatus = checkApproval({ estimatedFck: characteristicResistance, target });
  }

  if (pending) warnings.push(PENDING_REVISION_MESSAGE);

  const individualResults = finalGroup.specimens.map(s => ({
    id: s.id,
    age_days: s.age_days,
    area_cm2: s.area_cm2,
    rupture_load_kn: s.rupture_load_kn,
    resistance_mpa: s.resistance_mpa,
    ...(isPaverFamily ? {
      nominal_thickness_mm: s.nominal_thickness_mm ?? null,
      measured_thickness_mm: s.measured_thickness_mm ?? null,
      loading_area_cm2: s.loading_area_cm2 ?? null,
      p_factor: s.p_factor ?? null,
    } : {}),
  }));

  return {
    productFamily: family,
    characteristicLabel,
    individualResults,
    averageResistance: average,
    minimumResistance: min,
    characteristicResistance,
    targetResistance: target,
    complianceStatus,
    warnings,
    calculationMetadata: {
      calculation_version: CALCULATION_VERSION,
      norm_reference: normReference || null,
      norm_revision: normRevision || null,
      revision_state: revision_state || null,
      final_age_days,
      specimen_count: finalGroup.specimens.length,
      paver_loading_device_area_cm2: family === PRODUCT_FAMILY.PAVER ? PAVER_LOADING_DEVICE_AREA_CM2 : null,
      statistical_method: paverEstimation?.statistical_method ?? null,
      student_n: paverEstimation?.student_n ?? null,
      student_t: paverEstimation?.student_t ?? null,
    },
  };
}

// ---------- VERSIONAMENTO DE LAUDOS ----------

// '012/26' → { base: '012/26', versionIndex: 0 }
// '012/26-R1' → { base: '012/26', versionIndex: 1 }
export function parseReportNumber(reportNumber) {
  const m = String(reportNumber || '').match(/^(\d+\/\d+)(?:-R(\d+))?$/);
  if (!m) return { base: String(reportNumber || ''), versionIndex: 0 };
  return { base: m[1], versionIndex: Number(m[2] || 0) };
}

// Próximo número de versão de recálculo para uma base ('012/26')
export function nextVersionNumber(base, existingNumbers) {
  const indexes = (existingNumbers || [])
    .map(n => parseReportNumber(n))
    .filter(p => p.base === base)
    .map(p => p.versionIndex);
  return `${base}-R${indexes.length ? Math.max(...indexes) + 1 : 1}`;
}

// Selo de versão para exibição: 'ORIGINAL' | 'R1' | 'R2'...
export function versionBadge(reportNumber) {
  const { versionIndex } = parseReportNumber(reportNumber);
  return versionIndex > 0 ? `R${versionIndex}` : 'ORIGINAL';
}

// Um laudo é versão recalculada quando tem original_report_id (ou nº -Rn)
export function isRecalculatedReport(report) {
  return !!report?.original_report_id || /-R\d+$/.test(String(report?.report_number || ''));
}

// ---------- COMPARAÇÃO ENTRE VERSÕES ----------

function numOrNull(v) {
  const n = Number(v);
  return v == null || Number.isNaN(n) ? null : n;
}

function diffOrNull(a, b) {
  if (a == null || b == null) return null;
  return +(Number(b) - Number(a)).toFixed(2);
}

// Diferenças numéricas entre duas versões de laudo
export function compareReports(original, recalculated) {
  const fields = ['average_resistance', 'min_resistance', 'characteristic_resistance', 'target_resistance'];
  const out = {};
  fields.forEach(f => {
    const a = numOrNull(original?.[f]);
    const b = numOrNull(recalculated?.[f]);
    out[f] = { original: a, recalculated: b, difference: diffOrNull(a, b) };
  });
  return out;
}