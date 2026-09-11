// ─────────────────────────────────────────────────────────────────────────────
// MOTOR ÚNICO DE CUSTEIO INDUSTRIAL — CimentoPro v2.0
//
// Fonte única de verdade do custo: este módulo é usado pelo Simulador de
// Preços e (transição) pelas demais telas de custo — NENHUMA fórmula de custo
// deve viver em páginas. Cruza as 4 fontes:
//   PRODUÇÃO (ProductionOrder) → quantidade boa, refugo, horas, consumo real
//   PRODUTO  (ProductType + ConcreteTrace) → composição, peso, molde
//   MÁQUINA  (Machine + ProductionLine) → potência, tarifas
//   FINANCEIRO (MonthlyDre + DreAccount) → custos classificados da fábrica
//
// Princípios:
//   • Sem dupla contabilização: contas marcadas como já representadas no
//     cálculo operacional (traço/molde/energia das linhas) NÃO são somadas.
//   • Refugo: o custo é absorvido pela PRODUÇÃO BOA (divisores usam good).
//   • Média das últimas 3 DREs: NORMALIZADA por padrão (média dos
//     indicadores unitários de cada mês), ponderada como opção.
//   • Sem divisão por zero, sem invenção: base ausente → 0 + alerta.
//   • Rastreável: cada componente carrega origem (source) e o modelo é
//     versionado (calculation_version = "2.0").
// ─────────────────────────────────────────────────────────────────────────────
import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';
import { calculateSuggestedPrice } from '@/lib/costUtils';

export const CALCULATION_VERSION = '2.0';

export const COST_COMPONENT_TYPES = [
  { value: 'material_direct', label: 'Matéria-prima direta', industrial: true, default_basis: 'kg' },
  { value: 'mold', label: 'Molde', industrial: true, default_basis: 'none' },
  { value: 'energy', label: 'Energia', industrial: true, default_basis: 'machine_hours' },
  { value: 'direct_labor', label: 'Mão de obra direta', industrial: true, default_basis: 'machine_hours' },
  { value: 'maintenance', label: 'Manutenção', industrial: true, default_basis: 'machine_hours' },
  { value: 'depreciation', label: 'Depreciação', industrial: true, default_basis: 'machine_hours' },
  { value: 'factory_overhead', label: 'Custos fixos industriais', industrial: true, default_basis: 'machine_hours' },
  { value: 'loss', label: 'Perdas/Refugo (DRE)', industrial: true, default_basis: 'kg' },
  { value: 'selling_expense', label: 'Despesa comercial', industrial: false, default_basis: 'none' },
  { value: 'tax', label: 'Impostos', industrial: false, default_basis: 'none' },
  { value: 'commission', label: 'Comissão', industrial: false, default_basis: 'none' },
  { value: 'freight', label: 'Frete', industrial: false, default_basis: 'none' },
  { value: 'financial', label: 'Despesa financeira', industrial: false, default_basis: 'none' },
  { value: 'other', label: 'Outros', industrial: false, default_basis: 'none' },
];

export const INDUSTRIAL_COMPONENTS = COST_COMPONENT_TYPES.filter((c) => c.industrial).map((c) => c.value);
export const COMPONENT_LABELS = Object.fromEntries(COST_COMPONENT_TYPES.map((c) => [c.value, c.label]));
export const BASIS_BY_TYPE_DEFAULT = Object.fromEntries(COST_COMPONENT_TYPES.map((c) => [c.value, c.default_basis]));
export const RATE_BASES = [
  { value: 'none', label: 'Não rateia (fora do custo do produto)' },
  { value: 'kg', label: 'Peso produzido (R$/kg)' },
  { value: 'unit', label: 'Unidades produzidas (R$/un)' },
  { value: 'machine_hours', label: 'Horas de máquina (R$/h)' },
  { value: 'production_hours', label: 'Horas de produção (R$/h)' },
  { value: 'percentage', label: 'Percentual dos demais custos industriais' },
];
export const BASIS_LABELS = {
  none: 'não rateia',
  kg: 'peso (R$/kg)',
  unit: 'unidades (R$/un)',
  machine_hours: 'horas de máquina (R$/h)',
  production_hours: 'horas de produção (R$/h)',
  percentage: 'percentual',
};

// Componentes vindos do rateio da DRE (excluem material/molde/energia operacionais)
const DRE_BUCKETS = ['direct_labor', 'maintenance', 'depreciation', 'factory_overhead', 'loss', 'energy'];
const ENGINE_KEYS = [...INSUMO_KEYS, 'water'];

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const div = (a, b) => (b > 0 ? a / b : 0);
const avg = (arr) => (arr.length ? arr.reduce((s, v) => s + num(v), 0) / arr.length : 0);

// ── Peso / unidade de venda ─────────────────────────────────────────────────
// Peso real (weight_kg_per_unit) com fallback provisório do campo legado
// (volume_per_unit_m3, que historicamente guardou o peso). Nunca assume
// volume = peso: valores ausentes ficam 0 e marcados como estimados.
export function pieceWeightKg(pt) {
  if (!pt) return 0;
  const realKg = num(pt.weight_kg_per_unit);
  return realKg > 0 ? realKg : num(pt.volume_per_unit_m3);
}

export function weightPerSaleUnit(pt) {
  if (!pt) return { kg: 0, estimated: true };
  const realKg = num(pt.weight_kg_per_unit);
  const perPiece = pieceWeightKg(pt);
  const unit = String(pt.unit || 'un').toLowerCase();
  const ppm = num(pt.pieces_per_m);
  const kg = unit !== 'un' && ppm > 0 ? ppm * perPiece : perPiece;
  return { kg, estimated: realKg <= 0 || perPiece <= 0 };
}

export function saleFactor(pt) {
  const ppm = num(pt?.pieces_per_m);
  return String(pt?.unit || 'un').toLowerCase() !== 'un' && ppm > 0 ? ppm : 1;
}

export function unitLabel(pt) {
  const u = String(pt?.unit || 'un').toLowerCase();
  return u === 'm2' ? 'm²' : u === 'm' ? 'm' : 'un';
}

// ── Produção: bruta / refugo / boa ──────────────────────────────────────────
export function orderGoodQty(o) {
  return Math.max(num(o?.actual_quantity) - num(o?.loss_second_line) - num(o?.loss_discarded), 0);
}

export function productionFlow(orders) {
  const gross = orders.reduce((s, o) => s + num(o?.actual_quantity), 0);
  const refugo = orders.reduce((s, o) => s + num(o?.loss_second_line) + num(o?.loss_discarded), 0);
  const good = Math.max(gross - refugo, 0);
  return { gross, refugo, good, refugoPct: gross > 0 ? (refugo / gross) * 100 : 0 };
}

// ── Matéria-prima direta (estimativa do cadastro, por peça) ──────────────────
export function calculateDirectMaterialCost(pt, insumoCosts) {
  if (!pt) return 0;
  return INSUMO_KEYS.reduce((s, key) => s + num(pt[INSUMO_FIELDS[key].pt_field]) * num(insumoCosts?.[key]), 0);
}

// ── Ônus do refugo por unidade boa ──────────────────────────────────────────
export function calculateLossCost(industrialPerUnit, gross, good) {
  if (gross <= 0 || good >= gross) return 0;
  return num(industrialPerUnit) * (1 - good / gross);
}

// ── Classificação das contas da DRE ─────────────────────────────────────────
export function resolveAccountClassification(account) {
  const type = account?.cost_component_type || null;
  const industrial = INDUSTRIAL_COMPONENTS.includes(type);
  const rateBasis = account?.rate_basis || BASIS_BY_TYPE_DEFAULT[type] || 'none';
  const include = industrial && rateBasis !== 'none' && account?.include_in_product_cost !== false;
  return {
    type,
    industrial,
    rateBasis,
    include,
    alreadyMaterial: account?.already_included_in_direct_material === true,
    alreadyEnergy: account?.already_included_in_energy === true,
  };
}

export function buildAccountLookup(accounts) {
  const byId = {};
  const byName = {};
  (accounts || []).forEach((a) => {
    if (!a) return;
    byId[a.id] = a;
    const key = norm(a.name);
    if (key && !byName[key]) byName[key] = a;
  });
  return { byId, byName };
}

// ── Rateios genéricos por base ──────────────────────────────────────────────
function bucketCost(rates, comp, { weightKg, hoursPerUnit, sf }) {
  return (
    num(rates.perKg?.[comp]) * weightKg +
    num(rates.perHour?.[comp]) * hoursPerUnit +
    num(rates.perUnit?.[comp]) * sf
  );
}

export function calculateMachineHourCost(perHour, hoursPerUnit) {
  return Object.keys(perHour || {}).reduce((s, k) => s + num(perHour[k]) * hoursPerUnit, 0);
}

export function calculateLaborCost(rates, ctx) { return bucketCost(rates, 'direct_labor', ctx); }
export function calculateMaintenanceCost(rates, ctx) { return bucketCost(rates, 'maintenance', ctx); }
export function calculateFactoryOverhead(rates, ctx) { return bucketCost(rates, 'factory_overhead', ctx); }

function basisOf(rates, comp) {
  if (num(rates.perKg?.[comp]) > 0) return BASIS_LABELS.kg;
  if (num(rates.perHour?.[comp]) > 0) return BASIS_LABELS.machine_hours;
  if (num(rates.perUnit?.[comp]) > 0) return BASIS_LABELS.unit;
  if (num(rates.pct?.[comp]) > 0) return BASIS_LABELS.percentage;
  return null;
}

// ── Análise de UM mês (uma DRE) ─────────────────────────────────────────────
export function analyzeDreMonth({ dre, orders, productTypes, lines, accountLookup, insumoCosts, ordersPreFiltered = false }) {
  const ptMap = new Map((productTypes || []).map((p) => [p.id, p]));
  const machineToLine = new Map();
  (lines || []).forEach((l) => (l.machines || []).forEach((m) => {
    if (m.machine_id) machineToLine.set(m.machine_id, l);
  }));

  // ordersPreFiltered: os chamadores que fundem meses (média ponderada) já
  // entregam apenas as ordens do período — não filtra novamente por mês.
  const monthOrders = ordersPreFiltered
    ? (orders || [])
    : (orders || []).filter((o) => String(o.production_date || '').startsWith(dre.reference_month));

  // Agregação por produto: quantidade BOA, horas, peso, energia e material real
  const perProduct = new Map();
  for (const o of monthOrders) {
    const pt = ptMap.get(o.product_type_id);
    if (!pt) continue;
    let agg = perProduct.get(pt.id);
    if (!agg) {
      agg = { pt, gross: 0, good: 0, refugo: 0, hours: 0, weightKg: 0, lineEnergy: 0, missingLine: false, materialReal: 0, materialEstimate: 0, realOrders: 0, orders: 0 };
      perProduct.set(pt.id, agg);
    }
    const gross = num(o.actual_quantity);
    const refugo = num(o.loss_second_line) + num(o.loss_discarded);
    const good = Math.max(gross - refugo, 0);
    const hours = num(o.production_minutes) / 60;
    agg.orders += 1;
    agg.gross += gross;
    agg.refugo += refugo;
    agg.good += good;
    agg.hours += hours;
    // Base de rateio por kg: peso POR PEÇA × produção BOA — nunca mistura
    // kg/un (blocos) com kg/m² (pavimentos) na mesma base
    agg.weightKg += good * pieceWeightKg(pt);
    const line = (o.production_line_id && (lines || []).find((l) => l.id === o.production_line_id)) || machineToLine.get(o.machine_id);
    if (line) agg.lineEnergy += hours * num(line.used_power_kw) * num(line.energy_cost_per_kwh);
    else if (hours > 0) agg.missingLine = true;

    // Matéria-prima: consumo real quando lançado; senão estimativa do cadastro
    let orderReal = 0;
    let hasReal = false;
    for (const key of ENGINE_KEYS) {
      const v = num(o[INSUMO_FIELDS[key].actual]);
      if (v > 0) { hasReal = true; orderReal += v * num(insumoCosts?.[key]); }
    }
    if (hasReal) { agg.materialReal += orderReal; agg.realOrders += 1; }
    else agg.materialEstimate += good * calculateDirectMaterialCost(pt, insumoCosts);
  }

  // Classificação dos itens da DRE → buckets por base de rateio
  const buckets = { kg: {}, hours: {}, unit: {}, pct: {} };
  const warnings = [];
  const unclassified = [];
  let industrialTotal = 0;
  for (const item of (dre.items || [])) {
    if (!item || !item.account_name) continue;
    const value = num(item.actual_value);
    const account = (item.account_id && accountLookup.byId[item.account_id]) || accountLookup.byName[norm(item.account_name)];
    if (!account) {
      unclassified.push({ account_name: item.account_name, month_label: dre.month_label });
      continue;
    }
    const cls = resolveAccountClassification(account);
    if (!cls.type || !cls.industrial) continue; // receita/comercial/financeira: fora do custo industrial
    if (cls.alreadyMaterial || cls.alreadyEnergy) {
      warnings.push({
        account_name: item.account_name,
        reason: cls.alreadyEnergy
          ? 'já representada na energia operacional das linhas (kW × h × tarifa) — não somada novamente'
          : 'já representada no custo operacional (traço/produção/molde) — não somada novamente',
        month_label: dre.month_label,
      });
      continue;
    }
    if (!cls.include) continue;
    industrialTotal += value;
    const b = cls.rateBasis === 'kg' ? buckets.kg
      : (cls.rateBasis === 'machine_hours' || cls.rateBasis === 'production_hours') ? buckets.hours
      : cls.rateBasis === 'unit' ? buckets.unit
      : buckets.pct;
    b[cls.type] = (b[cls.type] || 0) + value;
  }

  const aggs = [...perProduct.values()];
  const totalGood = aggs.reduce((s, a) => s + a.good, 0);
  const totalWeight = aggs.reduce((s, a) => s + a.weightKg, 0);
  const totalHours = aggs.reduce((s, a) => s + a.hours, 0);
  const pctTotal = Object.values(buckets.pct).reduce((s, v) => s + v, 0);
  const nonPctTotal = industrialTotal - pctTotal;
  if (pctTotal > 0 && nonPctTotal <= 0) {
    warnings.push({
      account_name: '(contas percentuais)',
      reason: 'sem custos não-percentuais incluídos no mês — contas percentuais não aplicadas',
      month_label: dre.month_label,
    });
  }

  const rates = {
    perKg: {},
    perHour: {},
    perUnit: {},
    pct: {},
  };
  Object.keys(buckets.kg).forEach((k) => { rates.perKg[k] = div(buckets.kg[k], totalWeight); });
  Object.keys(buckets.hours).forEach((k) => { rates.perHour[k] = div(buckets.hours[k], totalHours); });
  Object.keys(buckets.unit).forEach((k) => { rates.perUnit[k] = div(buckets.unit[k], totalGood); });
  Object.keys(buckets.pct).forEach((k) => { rates.pct[k] = div(buckets.pct[k], nonPctTotal); });

  const dreEnergyRate = num(rates.perKg.energy) + num(rates.perHour.energy) + num(rates.perUnit.energy) + num(rates.pct.energy);
  const energyFromDre = dreEnergyRate > 0;
  const lineEnergyTotal = aggs.reduce((s, a) => s + a.lineEnergy, 0);
  if (energyFromDre) {
    warnings.push({
      account_name: 'Energia (DRE)',
      reason: 'energia da DRE rateada no produto — a energia operacional das linhas NÃO foi somada novamente',
      month_label: dre.month_label,
    });
  }

  // Custo por produto (por unidade de venda, base = produção BOA)
  const products = {};
  for (const agg of aggs) {
    const pt = agg.pt;
    const sf = saleFactor(pt);
    const wu = weightPerSaleUnit(pt);
    const hoursPerGoodPiece = agg.good > 0 ? agg.hours / agg.good : 0;
    const hoursPerUnit = hoursPerGoodPiece * sf;
    const ctx = { weightKg: wu.kg, hoursPerUnit, sf };
    const comps = {};
    const sources = {};
    const estimated = {};

    comps.material_direct = agg.good > 0 ? ((agg.materialReal + agg.materialEstimate) / agg.good) * sf : 0;
    sources.material_direct = agg.realOrders === 0
      ? 'Cadastro do artefato (estimativa — sem lançamento real de consumo)'
      : agg.realOrders === agg.orders
        ? 'Consumo real das ordens de produção'
        : 'Consumo real das ordens + estimativa do cadastro (ordens sem lançamento)';
    estimated.material_direct = agg.realOrders === 0;

    comps.mold = num(pt.mold_cost_per_unit) * sf;
    sources.mold = 'Molde: custo de aquisição ÷ vida útil ÷ peças por ciclo';
    estimated.mold = num(pt.mold_cost_per_unit) <= 0;

    if (energyFromDre) {
      comps.energy = bucketCost(rates, 'energy', ctx);
      sources.energy = `DRE ${dre.month_label} — conta de energia rateada (${basisOf(rates, 'energy') || '—'})`;
    } else {
      comps.energy = agg.good > 0 ? (agg.lineEnergy / agg.good) * sf : 0;
      sources.energy = 'Operacional: horas × potência da linha × tarifa do kWh';
      estimated.energy = true;
    }

    for (const comp of DRE_BUCKETS) {
      if (comp === 'energy') continue;
      comps[comp] = bucketCost(rates, comp, ctx);
      const basis = basisOf(rates, comp);
      sources[comp] = basis ? `DRE ${dre.month_label} — rateio por ${basis}` : 'Sem conta classificada para este componente';
    }

    // Contas percentuais: aplicadas sobre os demais custos industriais
    const sumNonPct = INDUSTRIAL_COMPONENTS.reduce((s, k) => s + num(comps[k]), 0);
    Object.keys(rates.pct).forEach((comp) => {
      comps[comp] = num(comps[comp]) + rates.pct[comp] * sumNonPct;
      sources[comp] = `DRE ${dre.month_label} — percentual sobre os demais custos industriais`;
    });

    const industrialPerUnit = INDUSTRIAL_COMPONENTS.reduce((s, k) => s + num(comps[k]), 0);
    const goodRatio = agg.gross > 0 ? agg.good / agg.gross : 1;
    products[pt.id] = {
      pt,
      weightKg: wu.kg,
      weightEstimated: wu.estimated,
      saleUnit: unitLabel(pt),
      gross: agg.gross,
      good: agg.good,
      refugo: agg.refugo,
      hours: agg.hours,
      components: comps,
      componentEstimated: estimated,
      sources,
      industrialPerUnit,
      lossBurden: calculateLossCost(industrialPerUnit, agg.gross, agg.good),
      goodRatio,
      missingLine: agg.missingLine,
    };
  }

  const insufficient = [];
  if (totalWeight <= 0) insufficient.push(`Sem peso produzido em ${dre.month_label} — rateios por kg indisponíveis (cadastre o peso dos artefatos).`);
  if (totalHours <= 0) insufficient.push(`Sem horas de produção em ${dre.month_label} — rateios por hora indisponíveis.`);
  if (unclassified.length) insufficient.push(`${unclassified.length} conta(s) da DRE de ${dre.month_label} sem classificação de custeio — excluídas do custo do produto até serem classificadas na Estrutura da DRE.`);

  return {
    reference_month: dre.reference_month,
    month_label: dre.month_label,
    dre_id: dre.id || null,
    industrialTotal,
    goodUnits: totalGood,
    weightKg: totalWeight,
    hours: totalHours,
    costPerKg: div(industrialTotal, totalWeight),
    costPerHour: div(industrialTotal, totalHours),
    energyFromDre,
    lineEnergyTotal,
    products,
    warnings,
    unclassified,
    insufficient,
  };
}

// ── Deteção de DRE anômala (comportamento atípico) ──────────────────────────
function detectAnomalies(analyses) {
  if (analyses.length < 2) return analyses.map((a) => ({ ...a, anomalous: false, anomalyReasons: [] }));
  const median = (arr) => {
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  const mKg = median(analyses.map((a) => a.costPerKg));
  const mW = median(analyses.map((a) => a.weightKg));
  const mH = median(analyses.map((a) => a.hours));
  const mG = median(analyses.map((a) => a.goodUnits));
  return analyses.map((a) => {
    const reasons = [];
    if (a.goodUnits <= 0) reasons.push('sem produção no mês');
    if (mKg > 0 && a.costPerKg > 1.5 * mKg) reasons.push('custo industrial por kg acima de 150% da mediana dos meses');
    if (mW > 0 && a.weightKg < 0.5 * mW) reasons.push('peso produzido abaixo de 50% da mediana dos meses');
    if (mH > 0 && a.hours < 0.5 * mH) reasons.push('horas de produção abaixo de 50% da mediana dos meses');
    if (mG > 0 && a.goodUnits < 0.5 * mG) reasons.push('produção boa abaixo de 50% da mediana dos meses');
    return { ...a, anomalous: reasons.length > 0, anomalyReasons: reasons };
  });
}

// ── Produto sem produção no período (fallback de cadastro, marcado) ─────────
function fallbackProduct(pt, insumoCosts, labels) {
  const sf = saleFactor(pt);
  const wu = weightPerSaleUnit(pt);
  const comps = {};
  const sources = {};
  INDUSTRIAL_COMPONENTS.forEach((k) => { comps[k] = 0; });
  comps.material_direct = calculateDirectMaterialCost(pt, insumoCosts) * sf;
  sources.material_direct = 'Cadastro do artefato (estimativa)';
  comps.mold = num(pt.mold_cost_per_unit) * sf;
  sources.mold = 'Molde: custo de aquisição ÷ vida útil ÷ peças por ciclo';
  const industrialPerUnit = comps.material_direct + comps.mold;
  return {
    pt,
    weightKg: wu.kg,
    weightEstimated: wu.estimated,
    saleUnit: unitLabel(pt),
    gross: 0,
    good: 0,
    refugo: 0,
    hours: 0,
    components: comps,
    componentEstimated: { material_direct: true, mold: true },
    sources,
    industrialPerUnit,
    lossBurden: 0,
    goodRatio: 1,
    monthsWithProduction: 0,
    missingLine: false,
    alerts: [
      'Sem produção no período analisado — custo com apenas matéria-prima e molde estimados do cadastro (rateios e consumo real indisponíveis).',
    ],
  };
}

// ── Média NORMALIZADA de todas as DREs cadastradas ──────────────────────────
// Média dos INDICADORES UNITÁRIOS de cada mês (não a soma dos totais):
// para cada componente, média dos R$/un dos meses em que o artefato foi produzido.
function averageProducts(usedAnalyses, productTypes, insumoCosts) {
  const labels = usedAnalyses.map((m) => m.month_label);
  const avgSource = labels.length === 1
    ? null
    : `Média normalizada das DREs (${labels.join(' · ')})`;
  const out = [];
  for (const pt of productTypes || []) {
    const perMonth = usedAnalyses.map((m) => m.products[pt.id]).filter((p) => p && p.gross > 0);
    if (!perMonth.length) {
      const fb = fallbackProduct(pt, insumoCosts, labels);
      out.push(fb);
      continue;
    }
    const comps = {};
    const sources = {};
    const estimated = {};
    INDUSTRIAL_COMPONENTS.forEach((key) => {
      comps[key] = avg(perMonth.map((p) => p.components[key]));
      sources[key] = avgSource
        ? `${avgSource} — ${perMonth.map((p) => p.sources[key]).find((s) => s) || ''}`.trim()
        : perMonth[0].sources[key];
      estimated[key] = perMonth.some((p) => p.componentEstimated?.[key]);
    });
    const industrialPerUnit = avg(perMonth.map((p) => p.industrialPerUnit));
    const gross = perMonth.reduce((s, p) => s + p.gross, 0);
    const good = perMonth.reduce((s, p) => s + p.good, 0);
    const lossBurden = avg(perMonth.map((p) => p.lossBurden));
    const goodRatio = avg(perMonth.map((p) => p.goodRatio));
    const alerts = [];
    if (perMonth.length < usedAnalyses.length) {
      alerts.push(`Artefato produzido em ${perMonth.length} de ${usedAnalyses.length} DRE(s) — média parcial.`);
    }
    if (perMonth.some((p) => p.missingLine)) {
      alerts.push('Ordens sem linha de produção vinculada — energia operacional possivelmente subestimada.');
    }
    out.push({
      pt,
      weightKg: perMonth[0].weightKg,
      weightEstimated: perMonth.some((p) => p.weightEstimated),
      saleUnit: unitLabel(pt),
      gross,
      good,
      refugo: gross - good,
      hours: perMonth.reduce((s, p) => s + p.hours, 0),
      components: comps,
      componentEstimated: estimated,
      sources,
      industrialPerUnit,
      lossBurden,
      goodRatio,
      monthsWithProduction: perMonth.length,
      missingLine: perMonth.some((p) => p.missingLine),
      alerts,
    });
  }
  return out;
}

// ── Média PONDERADA: meses fundidos (Σ custos ÷ Σ base) ──────────────────────
function mergeDres(dres) {
  const itemsByKey = new Map();
  const monthLabels = [];
  for (const dre of dres) {
    monthLabels.push(dre.month_label);
    for (const it of dre.items || []) {
      if (!it || !it.account_name) continue;
      const key = it.account_id || `n:${norm(it.account_name)}`;
      let m = itemsByKey.get(key);
      if (!m) {
        m = { account_name: it.account_name, account_id: it.account_id || null, planned_value: 0, actual_value: 0 };
        itemsByKey.set(key, m);
      }
      m.planned_value += num(it.planned_value);
      m.actual_value += num(it.actual_value);
    }
  }
  return {
    reference_month: dres.map((d) => d.reference_month).join('+'),
    month_label: `Média ponderada (${monthLabels.join(' · ')})`,
    items: [...itemsByKey.values()],
  };
}

// ── Custo para venda + preço sugerido ───────────────────────────────────────
// Preço = (Custo Industrial + Frete + Outros) ÷ (1 − Margem% − Comissão% − Imposto%)
export function calculateSellingCost(industrialPerUnit, { commission = 0, freight = 0, other = 0, margin = 0, taxRate = 0 } = {}) {
  const c = num(commission);
  const f = num(freight);
  const o = num(other);
  const m = num(margin);
  const t = num(taxRate);
  const industrial = num(industrialPerUnit);
  const denom = 1 - m / 100 - c / 100 - t / 100;
  if (denom <= 0) {
    return {
      invalid: true,
      message: 'Configuração inválida: impostos + comissão + margem ≥ 100%.',
      industrial, freight: f, other: o, commissionValue: 0, taxValue: 0,
      sellingCost: 0, marginValue: 0, price: 0,
    };
  }
  const price = calculateSuggestedPrice(industrial, { commission: c, freight: f, other: o, margin: m, taxRate: t });
  const commissionValue = price * (c / 100);
  const taxValue = price * (t / 100);
  const sellingCost = industrial + f + o + commissionValue + taxValue;
  return {
    invalid: false,
    message: null,
    industrial,
    freight: f,
    other: o,
    commissionValue,
    taxValue,
    sellingCost,
    marginValue: price - sellingCost,
    price,
  };
}

export { calculateSuggestedPrice };

// ── MODELO COMPLETO ─────────────────────────────────────────────────────────
// mode: 'normalized' (padrão) | 'weighted' | 'single'
export function buildCostModel({
  dres = [],
  orders = [],
  productTypes = [],
  lines = [],
  accounts = [],
  insumoCosts = {},
  mode = 'normalized',
  excludedMonths = [],
  selectedMonth = null,
}) {
  const lookup = buildAccountLookup(accounts);
  const sorted = [...dres].sort((a, b) => String(a.reference_month).localeCompare(String(b.reference_month)));
  const baseDres = sorted; // TODAS as DREs cadastradas da empresa entram na média
  const analyze = (dre) => analyzeDreMonth({ dre, orders, productTypes, lines, accountLookup: lookup, insumoCosts });

  const insufficient = [];
  if (!dres.length) insufficient.push('Nenhuma DRE cadastrada — o custo usa apenas estimativas de cadastro (matéria-prima e molde).');
  else if (baseDres.length < 3) insufficient.push(`Apenas ${baseDres.length} DRE(s) cadastrada(s) — a média usa menos de 3 meses.`);

  // ── Modo: mês selecionado ──
  if (mode === 'single') {
    const dre = sorted.find((d) => d.reference_month === selectedMonth) || sorted[sorted.length - 1] || null;
    if (!dre) {
      return {
        calculation_version: CALCULATION_VERSION,
        mode,
        months: [],
        usedLabels: [],
        average: null,
        warnings: [],
        unclassified: [],
        insufficient,
        products: (productTypes || []).map((pt) => fallbackProduct(pt, insumoCosts, [])),
      };
    }
    const single = analyze(dre);
    const months = [{ ...single, anomalous: false, anomalyReasons: [], userExcluded: false }];
    const products = (productTypes || []).map((pt) => {
      const p = single.products[pt.id];
      if (p) {
        return {
          ...p,
          monthsWithProduction: 1,
          alerts: [
            ...(p.weightEstimated ? ['Peso estimado — atualize o cadastro do produto (Peso por Unidade).'] : []),
            ...(p.missingLine ? ['Ordens sem linha de produção vinculada — energia operacional possivelmente subestimada.'] : []),
          ],
        };
      }
      return fallbackProduct(pt, insumoCosts, [dre.month_label]);
    });
    return {
      calculation_version: CALCULATION_VERSION,
      mode,
      months,
      usedLabels: [dre.month_label],
      average: { label: `DRE ${dre.month_label}`, costPerKg: single.costPerKg, costPerHour: single.costPerHour, industrialTotal: single.industrialTotal },
      warnings: single.warnings,
      unclassified: single.unclassified,
      insufficient: [...insufficient, ...single.insufficient],
      products,
    };
  }

  // ── Modos de média: últimas 3 DREs, com exclusão manual de meses ──
  const allAnalyses = detectAnomalies(baseDres.map(analyze)).map((a) => ({
    ...a,
    userExcluded: excludedMonths.includes(a.reference_month),
  }));
  const used = allAnalyses.filter((a) => !a.userExcluded);
  const usedDres = baseDres.filter((d) => !excludedMonths.includes(d.reference_month));
  if (!used.length) {
    return {
      calculation_version: CALCULATION_VERSION,
      mode,
      months: allAnalyses,
      usedLabels: [],
      average: null,
      warnings: [],
      unclassified: [],
      insufficient: [...insufficient, 'Todas as DREs do período foram excluídas da média — reabra ao menos uma para calcular.'],
      products: (productTypes || []).map((pt) => fallbackProduct(pt, insumoCosts, [])),
    };
  }

  let products;
  let average;
  if (mode === 'weighted') {
    const merged = mergeDres(usedDres);
    const usedRefs = new Set(usedDres.map((d) => d.reference_month));
    const usedOrders = orders.filter((o) => usedRefs.has(String(o.production_date || '').slice(0, 7)));
    const mergedAnalysis = analyzeDreMonth({ dre: merged, orders: usedOrders, productTypes, lines, accountLookup: lookup, insumoCosts, ordersPreFiltered: true });
    average = {
      label: `Média ponderada (${used.map((m) => m.month_label).join(' · ')})`,
      costPerKg: mergedAnalysis.costPerKg,
      costPerHour: mergedAnalysis.costPerHour,
      industrialTotal: mergedAnalysis.industrialTotal,
    };
    products = (productTypes || []).map((pt) => {
      const p = mergedAnalysis.products[pt.id];
      if (p) {
        return {
          ...p,
          monthsWithProduction: used.length,
          alerts: [
            ...(p.weightEstimated ? ['Peso estimado — atualize o cadastro do produto (Peso por Unidade).'] : []),
            ...(p.missingLine ? ['Ordens sem linha de produção vinculada — energia operacional possivelmente subestimada.'] : []),
          ],
        };
      }
      return fallbackProduct(pt, insumoCosts, used.map((m) => m.month_label));
    });
  } else {
    // normalized — PADRÃO
    products = averageProducts(used, productTypes, insumoCosts).map((p) => ({
      ...p,
      alerts: [
        ...(p.alerts || []),
        ...(p.weightEstimated ? ['Peso estimado — atualize o cadastro do produto (Peso por Unidade).'] : []),
      ],
    }));
    average = {
      label: `Média normalizada (${used.map((m) => m.month_label).join(' · ')})`,
      costPerKg: avg(used.map((m) => m.costPerKg)),
      costPerHour: avg(used.map((m) => m.costPerHour)),
      industrialTotal: avg(used.map((m) => m.industrialTotal)),
    };
  }

  // Alerta de DRE anômala incluída/excluída
  const anomalousIncluded = allAnalyses.filter((a) => a.anomalous && !a.userExcluded);
  const excludedNotes = allAnalyses.filter((a) => a.userExcluded).map((a) => `DRE ${a.month_label} excluída da média por decisão do usuário.`);
  anomalousIncluded.forEach((a) => insufficient.push(`DRE ${a.month_label} com comportamento atípico (${a.anomalyReasons.join('; ')}) — avalie antes de utilizar como referência.`));

  const warnings = [];
  const seen = new Set();
  used.forEach((m) => m.warnings.forEach((w) => {
    const key = `${w.account_name}|${w.reason}`;
    if (!seen.has(key)) { seen.add(key); warnings.push(w); }
  }));
  const unclassified = [];
  used.forEach((m) => unclassified.push(...m.unclassified));
  used.forEach((m) => insufficient.push(...m.insufficient));

  return {
    calculation_version: CALCULATION_VERSION,
    mode,
    months: allAnalyses,
    usedLabels: used.map((m) => m.month_label),
    average,
    warnings,
    unclassified,
    insufficient: [...insufficient, ...excludedNotes],
    products,
  };
}