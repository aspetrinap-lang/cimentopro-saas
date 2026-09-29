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

export function computeSpecimen(spec, normReference) {
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
    const age = Number(s.age_days) || 0;
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
    if (average > 0 && average < 35) {
      alerts.push(`Resistência média (${average.toFixed(2)} MPa) abaixo do mínimo da NBR 9781 (35 MPa).`);
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

  const computed = (specimens || []).map(s => computeSpecimen(s, normReference));
  const groups = groupByAge(computed);
  const final_age_days = Number(finalAgeDays)
    || (groups.length ? Math.max(...groups.map(g => g.age_days)) : 0);
  const finalGroup = groups.find(g => g.age_days === final_age_days) || { specimens: [] };
  const { average, min } = ageStats(finalGroup.specimens);
  const characteristicResistance = estimateCharacteristicResistance(finalGroup.specimens);
  const target = Number(targetResistance) || 0;

  const revision_state = normRevision ? getRevisionState(normReference, normRevision) : null;
  const pending = normRevision ? !isRevisionValidated(normReference, normRevision) : false;

  let complianceStatus;
  if (pending) {
    complianceStatus = 'PENDENTE_PARAMETRIZACAO';
  } else if (!target || !characteristicResistance) {
    complianceStatus = 'INDEFINIDO';
  } else {
    complianceStatus = checkApproval({ estimatedFck: characteristicResistance, target });
  }

  const warnings = [];
  if (pending) warnings.push(PENDING_REVISION_MESSAGE);

  const individualResults = finalGroup.specimens.map(s => ({
    id: s.id,
    age_days: s.age_days,
    area_cm2: s.area_cm2,
    rupture_load_kn: s.rupture_load_kn,
    resistance_mpa: s.resistance_mpa,
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