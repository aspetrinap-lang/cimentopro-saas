// Testes do MOTOR CENTRAL de qualidade (node:test — `node --test src/lib/__tests__/`)
// Cenários obrigatórios: pavimentos 60/80/100 mm (fator p, Tabela A.1); bloco;
// Tabela A.2 (Coeficiente de Student 80%) com bloqueios; laudo histórico
// (preservação, sem recálculo automático); recálculo controlado; versionamento
// (012/26-R1, -R2); comparação entre versões; revisões normativas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CALCULATION_VERSION, PRODUCT_FAMILY, PAVER_LOADING_DEVICE_AREA_CM2,
  PAVER_THICKNESS_FACTORS, PAVER_STUDENT_TABLE_2013,
  resolveQualityProductFamily, familyForNormReference,
  characteristicLabelForFamily, characteristicLabelForNorm, characteristicLabelForReport,
  getAvailableRevisions, getRevisionState, isRevisionValidated,
  calcAreaCm2, calcResistance, computeSpecimen, groupByAge, ageStats,
  estimateCharacteristicResistance, calculateQualityResult,
  getPaverThicknessFactor, calculatePaverIndividualResistance,
  estimatePaverFpk, estimatePaverFpk2013, estimatePaverFpk2026,
  evaluatePaverCompliance,
  parseReportNumber, nextVersionNumber, versionBadge, isRecalculatedReport,
  compareReports, checkThickness,
} from '../qualityNormEngine.js';

// Pavimento: carga de ruptura para a resistência individual (fp) desejada.
// fp = (F / 56,75 cm²) × p → F = (fp / p) × 5,675 (kN)
const paverLoad = (fp, p = 0.95) => +((fp / p) * 5.675).toFixed(4);
// Bloco: área 140 × 190 mm = 266 cm²
const blockLoad = (resistanceMpa) => +(resistanceMpa * 26.6).toFixed(4);

// Amostra de pavimento NBR 9781:2013 — espessura nominal 60 mm (p = 0,95)
const PAVER_FP = [36.5, 37.2, 35.8, 36.1, 36.9, 36.4];
const paverSpecimens = PAVER_FP.map((fp, i) => ({
  id: i + 1, age_days: 28, width_mm: 100, length_mm: 200,
  nominal_thickness_mm: 60, loading_area_cm2: PAVER_LOADING_DEVICE_AREA_CM2,
  rupture_load_kn: paverLoad(fp, 0.95),
}));

// Amostra legada (modelo antigo — sem espessura nominal por CP): preservação
// de laudos históricos com o critério estrutural de compatibilidade
const legacyPaverSpecimens = [
  { id: 1, age_days: 28, width_mm: 100, length_mm: 200, height_mm: 60, rupture_load_kn: paverLoad(36.5, 1) },
  { id: 2, age_days: 28, width_mm: 100, length_mm: 200, height_mm: 60, rupture_load_kn: paverLoad(37.2, 1) },
  { id: 3, age_days: 28, width_mm: 100, length_mm: 200, height_mm: 60, rupture_load_kn: paverLoad(35.8, 1) },
  { id: 4, age_days: 28, width_mm: 100, length_mm: 200, height_mm: 60, rupture_load_kn: paverLoad(36.1, 1) },
];

const blockSpecimens = [
  { id: 1, age_days: 28, width_mm: 140, length_mm: 190, height_mm: 140, rupture_load_kn: blockLoad(8.2) },
  { id: 2, age_days: 28, width_mm: 140, length_mm: 190, height_mm: 140, rupture_load_kn: blockLoad(7.9) },
  { id: 3, age_days: 28, width_mm: 140, length_mm: 190, height_mm: 140, rupture_load_kn: blockLoad(8.5) },
  { id: 4, age_days: 28, width_mm: 140, length_mm: 190, height_mm: 140, rupture_load_kn: blockLoad(8.1) },
];

// ---------- Família do produto ----------

test('1. novo pavimento (60 mm) — família PAVER, rótulo fpk, área do dispositivo fixa', () => {
  const pt = { name: 'Paver Hexagonal 60', category: 'Pavimentos Intertravados', norm_class: '35' };
  assert.equal(resolveQualityProductFamily(pt), PRODUCT_FAMILY.PAVER);
  assert.equal(characteristicLabelForFamily(PRODUCT_FAMILY.PAVER), 'fpk');
  assert.equal(characteristicLabelForNorm('NBR 9781'), 'fpk');
  // Área NÃO depende das dimensões da peça (é a área do dispositivo de carregamento)
  assert.equal(calcAreaCm2({ width_mm: 100, length_mm: 200 }, 'NBR 9781'), PAVER_LOADING_DEVICE_AREA_CM2);
  assert.equal(calcAreaCm2({ width_mm: 98, length_mm: 198 }, 'NBR 9781'), PAVER_LOADING_DEVICE_AREA_CM2);
  const r = calcResistance({ rupture_load_kn: paverLoad(36.5, 1) }, 'NBR 9781');
  assert.ok(Math.abs(r - 36.5) < 0.01);
});

test('2. pavimentos 80 mm e 100 mm — mesma família/norma, espessuras suportadas', () => {
  const pt80 = { name: 'Paver 80', category: 'Pavimento', norm_class: '50' };
  const pt100 = { name: 'Paver 100', category: 'Pavimento', norm_class: '50' };
  assert.equal(resolveQualityProductFamily(pt80), PRODUCT_FAMILY.PAVER);
  assert.equal(resolveQualityProductFamily(pt100), PRODUCT_FAMILY.PAVER);
  // Espessura é a MESMA dimensão da altura — sem campos duplicados
  assert.equal(checkThickness(80, 81), true);
  assert.equal(checkThickness(100, 104), false);
  // 80 mm → p = 1,00 (resistência individual sem correção)
  const specimens80 = PAVER_FP.map((fp, i) => ({
    id: i + 1, age_days: 28, width_mm: 100, length_mm: 200,
    nominal_thickness_mm: 80, rupture_load_kn: paverLoad(fp, 1),
  }));
  const result80 = calculateQualityResult({
    productFamily: 'PAVER', normReference: 'NBR 9781', normRevision: 'NBR 9781:2013',
    specimens: specimens80, targetResistance: 50, finalAgeDays: 28,
  });
  assert.equal(result80.characteristicLabel, 'fpk');
  assert.equal(result80.complianceStatus, 'REPROVADO'); // 36,48 < 50
  assert.equal(result80.calculationMetadata.paver_loading_device_area_cm2, PAVER_LOADING_DEVICE_AREA_CM2);
});

test('3. novo pavimento — cálculo completo NBR 9781:2013 (fpk,est = fp − t × s)', () => {
  const pt = { name: 'Paver 60', category: 'Pavimento', norm_class: '35' };
  const result = calculateQualityResult({
    productFamily: resolveQualityProductFamily(pt),
    normReference: 'NBR 9781', normRevision: 'NBR 9781:2013',
    specimens: paverSpecimens, productType: pt, targetResistance: 35, finalAgeDays: 28,
  });
  assert.equal(result.productFamily, 'PAVER');
  assert.equal(result.characteristicLabel, 'fpk');
  assert.equal(result.averageResistance.toFixed(2), '36.48');
  assert.equal(result.minimumResistance.toFixed(2), '35.80');
  // fp = média 36,4833 | s = 0,5115 | t (n=6) = 0,920 → fpk,est ≈ 36,01
  assert.ok(Math.abs(result.characteristicResistance - 36.01) < 0.01);
  assert.equal(result.complianceStatus, 'APROVADO');
  assert.equal(result.calculationMetadata.calculation_version, CALCULATION_VERSION);
  assert.equal(result.calculationMetadata.revision_state, 'CONFIGURADA_E_VALIDADA');
  assert.equal(result.calculationMetadata.statistical_method, 'NBR 9781:2013 — Tabela A.2');
  assert.equal(result.calculationMetadata.student_n, 6);
  assert.equal(result.calculationMetadata.student_t, 0.920);
  assert.equal(result.individualResults.length, 6);
});

test('4. novo bloco — família CONCRETE_BLOCK, rótulo fbk, área geométrica L×W', () => {
  const pt = { name: 'Bloco 14', category: 'Blocos de Concreto', norm_class: 'A' };
  assert.equal(resolveQualityProductFamily(pt), PRODUCT_FAMILY.CONCRETE_BLOCK);
  assert.equal(characteristicLabelForFamily(PRODUCT_FAMILY.CONCRETE_BLOCK), 'fbk');
  assert.equal(characteristicLabelForNorm('NBR 6136'), 'fbk');
  // Bloco NUNCA usa a área do dispositivo do pavimento
  assert.ok(Math.abs(calcAreaCm2({ width_mm: 140, length_mm: 190 }, 'NBR 6136') - 266) < 0.01);
  const result = calculateQualityResult({
    productFamily: 'CONCRETE_BLOCK', normReference: 'NBR 6136', normRevision: 'NBR 6136:2018',
    specimens: blockSpecimens, productType: pt, targetResistance: 8, finalAgeDays: 28,
  });
  assert.equal(result.characteristicLabel, 'fbk');
  assert.ok(result.characteristicResistance > 7.6 && result.characteristicResistance < 7.9);
  assert.equal(result.complianceStatus, 'ATENÇÃO');
  assert.equal(result.calculationMetadata.paver_loading_device_area_cm2, null);
  assert.equal(result.calculationMetadata.statistical_method, null);
});

// ---------- Fator p — Tabela A.1 ----------

test('5. Tabela A.1 — fatores p por espessura nominal (NBR 9781:2013)', () => {
  assert.equal(getPaverThicknessFactor({ nominalThicknessMm: 60, normRevision: 'NBR 9781:2013' }).p, 0.95);
  assert.equal(getPaverThicknessFactor({ nominalThicknessMm: 80, normRevision: 'NBR 9781:2013' }).p, 1.00);
  assert.equal(getPaverThicknessFactor({ nominalThicknessMm: 100, normRevision: 'NBR 9781:2013' }).p, 1.05);
  assert.equal(getPaverThicknessFactor({ nominalThicknessMm: 60, normRevision: 'NBR 9781:2013' }).status, 'OK');
  // Espessura fora da tabela: SEM interpolação/extrapolacao
  assert.equal(getPaverThicknessFactor({ nominalThicknessMm: 70, normRevision: 'NBR 9781:2013' }).status, 'PENDENTE_PARAMETRIZACAO');
  // O fator vem SEMPRE da espessura nominal — nunca da medida
  assert.equal(getPaverThicknessFactor({ nominalThicknessMm: 80, normRevision: 'NBR 9781:2013' }).p, 1.00);
});

test('6. revisão 2026 — fatores p NÃO copiados de 2013 (PENDENTE_PARAMETRIZACAO)', () => {
  const f60 = getPaverThicknessFactor({ nominalThicknessMm: 60, normRevision: 'NBR 9781-1:2026' });
  assert.equal(f60.status, 'PENDENTE_PARAMETRIZACAO');
  assert.equal(f60.p, null);
  assert.ok(f60.warning);
  const f100 = getPaverThicknessFactor({ nominalThicknessMm: 100, normRevision: 'NBR 9781-2:2026' });
  assert.equal(f100.status, 'PENDENTE_PARAMETRIZACAO');
  assert.equal(f100.p, null);
  assert.deepEqual(PAVER_THICKNESS_FACTORS['NBR 9781:2026'], {});
});

// ---------- Resistência individual fp ----------

test('7. fp = (F / A) × p — conversões explícitas e únicas (kN→N, cm²→m²)', () => {
  const r = calculatePaverIndividualResistance({ ruptureLoadKn: 80, loadingAreaCm2: 56.75, pFactor: 0.95 });
  assert.equal(r.forceN, 80000);
  assert.ok(Math.abs(r.areaM2 - 0.005675) < 1e-9);
  // 80.000 N / 0,005675 m² / 1e6 = 14,0974 MPa × p 0,95 = 13,3925 MPa
  assert.ok(Math.abs(r.resistanceMpa - 14.0974) < 0.001);
  assert.ok(Math.abs(r.correctedResistanceMpa - 13.3925) < 0.001);
  // p aplicado exatamente UMA vez (corrigido = bruto × p)
  assert.ok(Math.abs(r.correctedResistanceMpa - r.resistanceMpa * 0.95) < 1e-12);
  // Área geométrica (100 × 200) NUNCA entra no cálculo
  const r2 = calculatePaverIndividualResistance({ ruptureLoadKn: 36.5, loadingAreaCm2: PAVER_LOADING_DEVICE_AREA_CM2, pFactor: 1 });
  assert.ok(Math.abs(r2.correctedResistanceMpa - 36.5) < 0.01);
});

test('8. corpos de prova de pavimento — computeSpecimen aplica área fixa e p por CP', () => {
  const s = computeSpecimen(
    { id: 1, age_days: 28, width_mm: 100, length_mm: 200, nominal_thickness_mm: 60, rupture_load_kn: paverLoad(36.5, 0.95) },
    'NBR 9781',
    { normRevision: 'NBR 9781:2013' },
  );
  assert.equal(s.area_cm2, PAVER_LOADING_DEVICE_AREA_CM2);
  assert.equal(s.p_factor, 0.95);
  assert.equal(s.resistance_mpa, 36.5);
  // Sem espessura em nenhum nível → p indisponível, resistência SEM correção
  const s2 = computeSpecimen({ id: 2, age_days: 28, rupture_load_kn: 207.11 }, 'NBR 9781', {});
  assert.equal(s2.p_factor, null);
  assert.equal(s2.resistance_mpa, 36.5);
});

// ---------- Tabela A.2 — Coeficiente de Student (80%) ----------

test('9. Tabela A.2 — pares normativos obrigatórios (NBR 9781:2013)', () => {
  assert.equal(PAVER_STUDENT_TABLE_2013[6], 0.920);
  assert.equal(PAVER_STUDENT_TABLE_2013[7], 0.906);
  assert.equal(PAVER_STUDENT_TABLE_2013[8], 0.896);
  assert.equal(PAVER_STUDENT_TABLE_2013[9], 0.889);
  assert.equal(PAVER_STUDENT_TABLE_2013[10], 0.883);
  assert.equal(PAVER_STUDENT_TABLE_2013[12], 0.876);
  assert.equal(PAVER_STUDENT_TABLE_2013[32], 0.842);
});

test('10. fpk,est NBR 9781:2013 — n=6 (fpk,est = fp − t × s, t = 0,920)', () => {
  const est = estimatePaverFpk2013({ resistances: PAVER_FP });
  assert.equal(est.status, 'OK');
  assert.ok(Math.abs(est.fp - 36.483333) < 0.001);
  assert.ok(Math.abs(est.s - 0.511534) < 0.001);
  assert.equal(est.student_n, 6);
  assert.equal(est.student_t, 0.920);
  assert.equal(est.statistical_method, 'NBR 9781:2013 — Tabela A.2');
  // fpk,est = 36,4833 − 0,920 × 0,5115 = 36,0127
  assert.ok(Math.abs(est.fpk_est - 36.0127) < 0.001);
});

test('11. tamanho de amostra FORA da Tabela A.2 — bloqueio sem interpolar/extrapolar', () => {
  [11, 13, 15].forEach(n => {
    const resistances = Array.from({ length: n }, (_, i) => 36 + (i % 3) * 0.4);
    const est = estimatePaverFpk2013({ resistances });
    assert.equal(est.status, 'PENDING_STATISTICAL_PARAMETER');
    assert.equal(est.fpk_est, null);
    assert.ok(est.warning.includes('Tabela A.2'));
    assert.equal(est.statistical_method, 'NBR 9781:2013 — Tabela A.2');
    assert.equal(est.student_n, n);
    assert.equal(est.student_t, null);
    // Estatísticas descritivas seguem disponíveis
    assert.ok(est.fp > 0);
    assert.ok(est.s > 0);
  });
  // n=11 não pode herdar t entre 10 (0,883) e 12 (0,876) — nenhum valor calculado
  assert.equal(PAVER_STUDENT_TABLE_2013[11], undefined);
  assert.equal(PAVER_STUDENT_TABLE_2013[13], undefined);
  assert.equal(PAVER_STUDENT_TABLE_2013[15], undefined);
});

test('12. amostra insuficiente (n < 6) — INSUFFICIENT_SAMPLE, sem fpk,est', () => {
  const est = estimatePaverFpk2013({ resistances: [36.5, 37.2, 35.8, 36.1, 36.9] });
  assert.equal(est.status, 'INSUFFICIENT_SAMPLE');
  assert.equal(est.fpk_est, null);
  assert.ok(est.warning.includes('insuficiente'));
});

// ---------- Revisão 2026 — sem parametrização estatística ----------

test('13. revisão 2026 — NUNCA reutiliza Tabela A.2 nem fatores p de 2013', () => {
  const est = estimatePaverFpk2026({ resistances: PAVER_FP });
  assert.equal(est.status, 'PENDENTE_PARAMETRIZACAO');
  assert.equal(est.fpk_est, null);
  assert.equal(est.student_t, null);
  assert.equal(est.statistical_method, null);
  assert.ok(est.warning);
  // Dispatcher: revisão 2026 → PENDENTE mesmo com amostra perfeita
  const viaDispatcher = estimatePaverFpk({ normRevision: 'NBR 9781-1:2026', resistances: PAVER_FP });
  assert.equal(viaDispatcher.status, 'PENDENTE_PARAMETRIZACAO');
});

// ---------- Conformidade de pavimento ----------

test('14. conformidade do pavimento — fpk,est ≥ fpk especificado (NBR 9781:2013)', () => {
  assert.equal(evaluatePaverCompliance({
    normRevision: 'NBR 9781:2013', targetResistance: 35,
    characteristicResistance: 36.01, finalAgeDays: 28, referenceAgeDays: 28,
  }).status, 'CONFORME');
  assert.equal(evaluatePaverCompliance({
    normRevision: 'NBR 9781:2013', targetResistance: 35,
    characteristicResistance: 34.2, finalAgeDays: 28, referenceAgeDays: 28,
  }).status, 'NAO_CONFORME');
  // Ensaio antes da idade de referência → conformidade preliminar (warning)
  const early = evaluatePaverCompliance({
    normRevision: 'NBR 9781:2013', targetResistance: 35,
    characteristicResistance: 36.01, finalAgeDays: 21, referenceAgeDays: 28,
  });
  assert.equal(early.status, 'CONFORME');
  assert.ok(early.warnings.some(w => w.includes('antes da idade de referência')));
  // fpk,est não calculado → conformidade não pode ser avaliada
  assert.equal(evaluatePaverCompliance({
    normRevision: 'NBR 9781:2013', targetResistance: 35,
    characteristicResistance: null, finalAgeDays: 28, referenceAgeDays: 28,
  }).status, 'INDEFINIDO');
  // Revisão 2026 → PENDENTE (nunca "CONFORME")
  assert.equal(evaluatePaverCompliance({
    normRevision: 'NBR 9781-1:2026', targetResistance: 35,
    characteristicResistance: 36.01, finalAgeDays: 28, referenceAgeDays: 28,
  }).status, 'PENDENTE_PARAMETRIZACAO');
});

// ---------- Laudos históricos — preservação ----------

test('15. laudo histórico — engine reproduz EXATAMENTE os valores armazenados', () => {
  const stored = {
    average_resistance: 36.4,
    min_resistance: 35.8,
    estimated_fck: 35.4,
  };
  const result = calculateQualityResult({
    productFamily: null, normReference: 'NBR 9781', normRevision: null,
    specimens: legacyPaverSpecimens, productType: null, targetResistance: 35, finalAgeDays: 28,
  });
  assert.equal(result.averageResistance.toFixed(2), stored.average_resistance.toFixed(2));
  assert.equal(result.minimumResistance.toFixed(2), stored.min_resistance.toFixed(2));
  assert.ok(Math.abs(result.characteristicResistance - stored.estimated_fck) < 0.05);
});

test('16. abertura de laudo antigo — sem recálculo automático (engine NÃO muta os dados)', () => {
  const specimens = legacyPaverSpecimens.map(s => ({ ...s }));
  const snapshot = JSON.stringify(specimens);
  calculateQualityResult({
    productFamily: 'PAVER', normReference: 'NBR 9781', normRevision: 'NBR 9781:2013',
    specimens, targetResistance: 35, finalAgeDays: 28,
  });
  assert.equal(JSON.stringify(specimens), snapshot);
});

test('17. preservação de resultado — fallback de leitura para laudos antigos sem family/revision', () => {
  // Laudo antigo sem product_family/norm_revision: rótulo resolvido SOMENTE em leitura
  const oldReport = { norm_reference: 'NBR 9781', estimated_fck: 35.4 };
  assert.equal(characteristicLabelForReport(oldReport), 'fpk');
  const oldBlockReport = { norm_reference: 'NBR 6136' };
  assert.equal(characteristicLabelForReport(oldBlockReport), 'fbk');
  // Família a partir da norma quando o artefato não informa
  assert.equal(familyForNormReference('NBR 9781'), 'PAVER');
  assert.equal(familyForNormReference('NBR 6136'), 'CONCRETE_BLOCK');
});

// ---------- Recálculo e versionamento ----------

test('18. recálculo controlado — nova revisão, mesmo motor, dados de origem intactos', () => {
  const originalSpecimens = paverSpecimens.map(s => ({ ...s }));
  const result = calculateQualityResult({
    productFamily: 'PAVER', normReference: 'NBR 9781', normRevision: 'NBR 9781-1:2026',
    specimens: originalSpecimens, targetResistance: 35, finalAgeDays: 28,
  });
  // Revisão 2026 (pendente): permitida para recálculo, mas SEM resultado definitivo
  assert.equal(result.complianceStatus, 'PENDENTE_PARAMETRIZACAO');
  assert.equal(result.characteristicResistance, null);
  assert.ok(result.warnings.some(w => w.includes('ainda não foram validados/configurados')));
  assert.equal(result.calculationMetadata.revision_state, 'PENDENTE_PARAMETRIZACAO');
  assert.equal(JSON.stringify(originalSpecimens), JSON.stringify(paverSpecimens));
});

test('19. criação de nova versão — 012/26 → 012/26-R1', () => {
  assert.equal(nextVersionNumber('012/26', ['012/26']), '012/26-R1');
  const parsed = parseReportNumber('012/26-R1');
  assert.equal(parsed.base, '012/26');
  assert.equal(parsed.versionIndex, 1);
  assert.equal(versionBadge('012/26'), 'ORIGINAL');
  assert.equal(versionBadge('012/26-R1'), 'R1');
  assert.equal(isRecalculatedReport({ report_number: '012/26-R1' }), true);
  assert.equal(isRecalculatedReport({ report_number: '012/26', original_report_id: 'x' }), true);
  assert.equal(isRecalculatedReport({ report_number: '012/26' }), false);
});

test('20. encadeamento de versões — 012/26-R2', () => {
  assert.equal(nextVersionNumber('012/26', ['012/26', '012/26-R1']), '012/26-R2');
  assert.equal(nextVersionNumber('012/26', ['012/26', '012/26-R1', '012/26-R2']), '012/26-R3');
});

test('21. comparação entre versões — diferenças numéricas corretas', () => {
  const original = {
    average_resistance: 36.4, min_resistance: 35.8,
    characteristic_resistance: 35.4, target_resistance: 35,
  };
  const recalculated = {
    average_resistance: 37.1, min_resistance: 36.2,
    characteristic_resistance: 36.05, target_resistance: 35,
  };
  const diffs = compareReports(original, recalculated);
  assert.equal(diffs.average_resistance.difference, 0.7);
  assert.equal(diffs.min_resistance.difference, 0.4);
  assert.equal(diffs.characteristic_resistance.difference, 0.65);
  assert.equal(diffs.target_resistance.difference, 0);
});

test('22. registro de revisões normativas — estados corretos', () => {
  assert.equal(getRevisionState('NBR 9781', 'NBR 9781:2013'), 'CONFIGURADA_E_VALIDADA');
  assert.equal(getRevisionState('NBR 9781', 'NBR 9781-1:2026'), 'PENDENTE_PARAMETRIZACAO');
  assert.equal(getRevisionState('NBR 9781', 'NBR 9781-2:2026'), 'PENDENTE_PARAMETRIZACAO');
  assert.equal(getRevisionState('NBR 6136', 'NBR 6136:2018'), 'CONFIGURADA_E_VALIDADA');
  assert.equal(isRevisionValidated('NBR 9781', 'NBR 9781:2013'), true);
  assert.equal(isRevisionValidated('NBR 9781', 'NBR 9781-1:2026'), false);
  assert.equal(getAvailableRevisions('NBR 9781').length, 3);
  assert.equal(getAvailableRevisions('NBR 6136').length, 2);
});

test('23. agrupamento por idade e estatísticas', () => {
  const groups = groupByAge([
    { age_days: 7, resistance_mpa: 20 },
    { age_days: 28, resistance_mpa: 30 },
    { age_days: 28, resistance_mpa: 34 },
  ]);
  assert.deepEqual(groups.map(g => g.age_days), [7, 28]);
  const s28 = ageStats(groups[1].specimens);
  assert.equal(s28.average, 32);
  assert.equal(s28.min, 30);
  assert.equal(computeSpecimen({ rupture_load_kn: 207.11 }, 'NBR 9781').resistance_mpa, 36.5);
});