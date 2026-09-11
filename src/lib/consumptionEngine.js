// Motor de consumo — Etapas 1 a 3 do Engenheiro Virtual:
// consumo esperado = produção boa × consumo padrão do artefato (nunca planejado × real),
// consumo específico (peça / 1.000 peças / m³) e proporções entre insumos do traço.
import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';

// INSUMO_KEYS não inclui água — o motor analisa água também (relação água/cimento)
const ENGINE_KEYS = [...INSUMO_KEYS, 'water'];

const AGGREGATE_KEYS = ['sand_artificial', 'sand_medium', 'sand_fine', 'gravel'];
const SAND_KEYS = ['sand_artificial', 'sand_medium', 'sand_fine'];

// Limiares de desvio (%) do consumo esperado
export const DEVIATION_THRESHOLDS = { OK_MAX: 5, ALERTA_MAX: 10 };

// Produção: bruta, refugo (2ª linha + descarte) e boa (aprovada)
export function productionFlow(orders) {
  const gross = orders.reduce((s, o) => s + (Number(o.actual_quantity) || 0), 0);
  const refugo = orders.reduce((s, o) => s + (Number(o.loss_second_line) || 0) + (Number(o.loss_discarded) || 0), 0);
  const good = Math.max(gross - refugo, 0);
  return { gross, refugo, good, refugoPct: gross > 0 ? (refugo / gross) * 100 : 0 };
}

function sumActual(orders, field) {
  return orders.reduce((s, o) => s + (Number(o[field]) || 0), 0);
}

function ratio(num, den) {
  return num > 0 && den > 0 ? num / den : null;
}

function deviationStatus(deviationPct) {
  if (deviationPct == null) return 'sem-padrao';
  const abs = Math.abs(deviationPct);
  if (abs <= DEVIATION_THRESHOLDS.OK_MAX) return 'ok';
  if (abs <= DEVIATION_THRESHOLDS.ALERTA_MAX) return 'atencao';
  return 'desvio';
}

// Análise de consumo de um grupo de ordens do mesmo artefato (ou de uma ordem única).
// Referência técnica: consumo padrão por unidade cadastrado no artefato (ProductType,
// preenchido a partir do traço). Sem padrão → análise preliminar (confiabilidade baixa).
export function analyzeConsumption(orders, productType) {
  const flow = productionFlow(orders);
  const volumePerUnit = Number(productType?.volume_per_unit_m3) || 0;
  const rows = [];
  let inTraceCount = 0;
  let noTraceCount = 0;

  ENGINE_KEYS.forEach((key) => {
    const f = INSUMO_FIELDS[key];
    const standard = productType ? Number(productType[f.pt_field]) || 0 : 0;
    const actual = sumActual(orders, f.actual);
    if (standard <= 0 && actual <= 0) return; // insumo fora do traço e sem consumo registrado
    if (standard > 0) inTraceCount += 1;
    else noTraceCount += 1;

    const expected = standard > 0 ? flow.good * standard : 0;
    const deviation = expected > 0 ? actual - expected : null;
    const deviationPct = expected > 0 ? (deviation / expected) * 100 : null;
    const volumeM3 = volumePerUnit > 0 ? flow.good * volumePerUnit : 0;

    rows.push({
      key,
      unit: f.unit,
      standardPerUnit: standard > 0 ? standard : null,
      expected,
      actual,
      deviation,
      deviationPct,
      status: deviationStatus(deviationPct),
      perPiece: flow.good > 0 && actual > 0 ? actual / flow.good : null,
      per1000: flow.good > 0 && actual > 0 ? (actual / flow.good) * 1000 : null,
      volumeM3,
      perM3: volumeM3 > 0 && actual > 0 ? actual / volumeM3 : null,
    });
  });

  // Proporções do traço: consumo real vs padrão cadastrado
  const std = (key) => (productType ? Number(productType[INSUMO_FIELDS[key].pt_field]) || 0 : 0);
  const stdAgg = AGGREGATE_KEYS.reduce((s, k) => s + std(k), 0);
  const stdSand = SAND_KEYS.reduce((s, k) => s + std(k), 0);
  const actCement = sumActual(orders, INSUMO_FIELDS.cement.actual);
  const actWater = sumActual(orders, INSUMO_FIELDS.water.actual);
  const actAgg = AGGREGATE_KEYS.reduce((s, k) => s + sumActual(orders, INSUMO_FIELDS[k].actual), 0);
  const actSand = SAND_KEYS.reduce((s, k) => s + sumActual(orders, INSUMO_FIELDS[k].actual), 0);

  const prop = (actualValue, standardValue) => ({
    actual: actualValue,
    standard: standardValue,
    deviationPct: actualValue != null && standardValue
      ? ((actualValue - standardValue) / standardValue) * 100
      : null,
  });

  const proportions = {
    cementAggregate: prop(ratio(actCement, actAgg), ratio(std('cement'), stdAgg)),
    aggregateCement: prop(ratio(actAgg, actCement), ratio(stdAgg, std('cement'))),
    waterCement: prop(ratio(actWater, actCement), ratio(std('water'), std('cement'))),
    sandAggregate: prop(ratio(actSand, actAgg), ratio(stdSand, stdAgg)),
  };

  const confidence = inTraceCount === 0 ? 'baixa' : noTraceCount > 0 ? 'media' : 'alta';

  return {
    artifactName: productType?.name || orders[0]?.product_type_name || '—',
    productTypeId: orders[0]?.product_type_id || null,
    ordersCount: orders.length,
    flow,
    volumePerUnit,
    rows,
    proportions,
    confidence,
  };
}

// Agrupa as ordens por artefato e analisa cada grupo com seu traço específico
export function analyzeConsumptionByArtifact(orders, productTypesById) {
  const groups = new Map();
  orders.forEach((o) => {
    const id = o.product_type_id || 'sem-artefato';
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(o);
  });
  const analyses = [];
  groups.forEach((groupOrders, id) => {
    const a = analyzeConsumption(groupOrders, productTypesById?.[id]);
    if (a.rows.length > 0) analyses.push(a);
  });
  return analyses;
}

// Agregado do período: soma esperado/real por insumo entre artefatos; o padrão
// exibido é a média ponderada pela produção boa de cada artefato.
export function mergeAnalyses(analyses) {
  if (!analyses || analyses.length === 0) return null;
  const flow = analyses.reduce(
    (acc, a) => ({
      gross: acc.gross + a.flow.gross,
      refugo: acc.refugo + a.flow.refugo,
      good: acc.good + a.flow.good,
    }),
    { gross: 0, refugo: 0, good: 0 }
  );
  flow.refugoPct = flow.gross > 0 ? (flow.refugo / flow.gross) * 100 : 0;

  const byKey = new Map();
  analyses.forEach((a) => {
    a.rows.forEach((r) => {
      if (!byKey.has(r.key)) {
        byKey.set(r.key, { key: r.key, unit: r.unit, expected: 0, actual: 0, volumeM3: 0, inTrace: true });
      }
      const m = byKey.get(r.key);
      m.expected += r.expected;
      m.actual += r.actual;
      m.volumeM3 += r.volumeM3;
      m.inTrace = m.inTrace && r.standardPerUnit != null;
    });
  });

  const rows = [...byKey.values()].map((m) => {
    const standardPerUnit = flow.good > 0 && m.inTrace ? m.expected / flow.good : null;
    const deviation = m.expected > 0 ? m.actual - m.expected : null;
    const deviationPct = m.expected > 0 ? (deviation / m.expected) * 100 : null;
    return {
      ...m,
      standardPerUnit,
      deviation,
      deviationPct,
      status: deviationStatus(deviationPct),
      perPiece: null,
      per1000: flow.good > 0 && m.actual > 0 ? (m.actual / flow.good) * 1000 : null,
      perM3: m.volumeM3 > 0 && m.actual > 0 ? m.actual / m.volumeM3 : null,
    };
  });

  const confidence = analyses.some((a) => a.confidence === 'baixa')
    ? 'baixa'
    : analyses.some((a) => a.confidence === 'media')
      ? 'media'
      : 'alta';

  return {
    artifactName: null,
    ordersCount: analyses.reduce((s, a) => s + a.ordersCount, 0),
    flow,
    rows,
    proportions: null,
    confidence,
    artifactAnalyses: analyses,
  };
}