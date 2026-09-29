// Testes do MOTOR CENTRAL de qualidade (node:test — `node --test src/lib/__tests__/`)
// Cenários obrigatórios: pavimentos 60/80/100 mm; bloco; laudo histórico
// (preservação, sem recálculo automático); recálculo controlado; versionamento
// (012/26-R1, -R2); comparação entre versões; revisões normativas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CALCULATION_VERSION, PRODUCT_FAMILY, PAVER_LOADING_DEVICE_AREA_CM2,
  resolveQualityProductFamily, familyForNormReference,
  characteristicLabelForFamily, characteristicLabelForNorm, characteristicLabelForReport,
  getAvailableRevisions, getRevisionState, isRevisionValidated,
  calcAreaCm2, calcResistance, computeSpecimen, groupByAge, ageStats,
  estimateCharacteristicResistance, calculateQualityResult,
  parseReportNumber, nextVersionNumber, versionBadge, isRecalculatedReport,
  compareReports, checkThickness,
} from '../qualityNormEngine.js';

// Pavimento: carga de ruptura para a resistência desejada (área fixa 56,75 cm²)
const paverLoad = (resistanceMpa) => +(resistanceMpa * 5.675).toFixed(4);
// Bloco: área 140 × 190 mm = 266 cm²
const blockLoad = (resistanceMpa) => +(resistanceMpa * 26.6).toFixed(4);

const paverSpecimens = [
  { id: 1, age_days: 28, width_mm: 100, length_mm: 200, height_mm: 60, rupture_load_kn: paverLoad(36.5) },
  { id: 2, age_days: 28, width_mm: 100, length_mm: 200, height_mm: 60, rupture_load_kn: paverLoad(37.2) },
  { id: 3, age_days: 28, width_mm: 100, length_mm: 200, height_mm: 60, rupture_load_kn: paverLoad(35.8) },
  { id: 4, age_days: 28, width_mm: 100, length_mm: 200, height_mm: 60, rupture_load_kn: paverLoad(36.1) },
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
  const r = calcResistance({ rupture_load_kn: paverLoad(36.5) }, 'NBR 9781');
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
  const result80 = calculateQualityResult({
    productFamily: 'PAVER', normReference: 'NBR 9781', normRevision: 'NBR 9781:2013',
    specimens: paverSpecimens.map(s => ({ ...s, height_mm: 80 })), targetResistance: 50, finalAgeDays: 28,
  });
  assert.equal(result80.characteristicLabel, 'fpk');
  assert.equal(result80.complianceStatus, 'REPROVADO'); // 35,4 < 50
  assert.equal(result80.calculationMetadata.paver_loading_device_area_cm2, PAVER_LOADING_DEVICE_AREA_CM2);
});

test('3. novo pavimento — cálculo completo (fpk est ≥ fpk de projeto → APROVADO)', () => {
  const pt = { name: 'Paver 60', category: 'Pavimento', norm_class: '35' };
  const result = calculateQualityResult({
    productFamily: resolveQualityProductFamily(pt),
    normReference: 'NBR 9781', normRevision: 'NBR 9781:2013',
    specimens: paverSpecimens, productType: pt, targetResistance: 35, finalAgeDays: 28,
  });
  assert.equal(result.productFamily, 'PAVER');
  assert.equal(result.characteristicLabel, 'fpk');
  assert.equal(result.averageResistance.toFixed(2), '36.40');
  assert.equal(result.minimumResistance.toFixed(2), '35.80');
  assert.ok(Math.abs(result.characteristicResistance - 35.40) < 0.05);
  assert.equal(result.complianceStatus, 'APROVADO');
  assert.equal(result.calculationMetadata.calculation_version, CALCULATION_VERSION);
  assert.equal(result.calculationMetadata.revision_state, 'CONFIGURADA_E_VALIDADA');
  assert.equal(result.individualResults.length, 4);
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
});

test('5. laudo histórico — engine reproduz EXATAMENTE os valores armazenados', () => {
  const stored = {
    average_resistance: 36.4,
    min_resistance: 35.8,
    estimated_fck: 35.4,
  };
  const result = calculateQualityResult({
    productFamily: null, normReference: 'NBR 9781', normRevision: null,
    specimens: paverSpecimens, productType: null, targetResistance: 35, finalAgeDays: 28,
  });
  assert.equal(result.averageResistance.toFixed(2), stored.average_resistance.toFixed(2));
  assert.equal(result.minimumResistance.toFixed(2), stored.min_resistance.toFixed(2));
  assert.ok(Math.abs(result.characteristicResistance - stored.estimated_fck) < 0.05);
});

test('6. abertura de laudo antigo — sem recálculo automático (engine NÃO muta os dados)', () => {
  const specimens = paverSpecimens.map(s => ({ ...s }));
  const snapshot = JSON.stringify(specimens);
  calculateQualityResult({
    productFamily: 'PAVER', normReference: 'NBR 9781', normRevision: 'NBR 9781:2013',
    specimens, targetResistance: 35, finalAgeDays: 28,
  });
  assert.equal(JSON.stringify(specimens), snapshot);
});

test('7. preservação de resultado — fallback de leitura para laudos antigos sem family/revision', () => {
  // Laudo antigo sem product_family/norm_revision: rótulo resolvido SOMENTE em leitura
  const oldReport = { norm_reference: 'NBR 9781', estimated_fck: 35.4 };
  assert.equal(characteristicLabelForReport(oldReport), 'fpk');
  const oldBlockReport = { norm_reference: 'NBR 6136' };
  assert.equal(characteristicLabelForReport(oldBlockReport), 'fbk');
  // Família a partir da norma quando o artefato não informa
  assert.equal(familyForNormReference('NBR 9781'), 'PAVER');
  assert.equal(familyForNormReference('NBR 6136'), 'CONCRETE_BLOCK');
});

test('8. recálculo controlado — nova revisão, mesmo motor, dados de origem intactos', () => {
  const originalSpecimens = paverSpecimens.map(s => ({ ...s }));
  const result = calculateQualityResult({
    productFamily: 'PAVER', normReference: 'NBR 9781', normRevision: 'NBR 9781-1:2026',
    specimens: originalSpecimens, targetResistance: 35, finalAgeDays: 28,
  });
  // Revisão 2026 (pendente): permitida para recálculo, mas SEM resultado definitivo
  assert.equal(result.complianceStatus, 'PENDENTE_PARAMETRIZACAO');
  assert.ok(result.warnings.some(w => w.includes('ainda não foram validados/configurados')));
  assert.equal(result.calculationMetadata.revision_state, 'PENDENTE_PARAMETRIZACAO');
  assert.equal(JSON.stringify(originalSpecimens), JSON.stringify(paverSpecimens));
});

test('9. criação de nova versão — 012/26 → 012/26-R1', () => {
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

test('10. encadeamento de versões — 012/26-R2', () => {
  assert.equal(nextVersionNumber('012/26', ['012/26', '012/26-R1']), '012/26-R2');
  assert.equal(nextVersionNumber('012/26', ['012/26', '012/26-R1', '012/26-R2']), '012/26-R3');
});

test('11. comparação entre versões — diferenças numéricas corretas', () => {
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

test('12. registro de revisões normativas — estados corretos', () => {
  assert.equal(getRevisionState('NBR 9781', 'NBR 9781:2013'), 'CONFIGURADA_E_VALIDADA');
  assert.equal(getRevisionState('NBR 9781', 'NBR 9781-1:2026'), 'PENDENTE_PARAMETRIZACAO');
  assert.equal(getRevisionState('NBR 9781', 'NBR 9781-2:2026'), 'PENDENTE_PARAMETRIZACAO');
  assert.equal(getRevisionState('NBR 6136', 'NBR 6136:2018'), 'CONFIGURADA_E_VALIDADA');
  assert.equal(isRevisionValidated('NBR 9781', 'NBR 9781:2013'), true);
  assert.equal(isRevisionValidated('NBR 9781', 'NBR 9781-1:2026'), false);
  assert.equal(getAvailableRevisions('NBR 9781').length, 3);
  assert.equal(getAvailableRevisions('NBR 6136').length, 2);
});

test('13. agrupamento por idade e estatísticas', () => {
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