// ─────────────────────────────────────────────────────────────────────────────
// MOTOR ÚNICO DE CUSTEIO INDUSTRIAL — CimentoPro v2.3
//
// Fonte única de verdade do custo: este módulo é usado pelo Simulador de
// Preços e (transição) pelas demais telas de custo — NENHUMA fórmula de custo
// deve viver em páginas. Cruza as 4 fontes:
//   PRODUÇÃO (ProductionOrder) → quantidade boa, refugo, horas, consumo real
//   PRODUTO  (ProductType + ConcreteTrace) → composição, peso, molde
//   MÁQUINA  (Machine + ProductionLine) → potência, tarifas
//   FINANCEIRO (MonthlyDre + DreAccount) → custos classificados da fábrica
//
// Princípios (v2.2 — separação de bases):
//   • BASE FINANCEIRA: DREs do período financeiro selecionado
//     (all_history padrão | selected_month | last_3 | last_6 | last_12),
//     SEMPRE por média ponderada Σ custos ÷ Σ base produtiva do período —
//     nunca média aritmética de indicadores mensais.
//   • BASE PRODUTIVA: produtividade histórica (horas por peça boa) calculada
//     sobre TODO o histórico de ordens concluídas, independente do período
//     financeiro — com hierarquia de fallback e nunca zero para produtos
//     fabricados eventualmente (calculateHistoricalProductivity).
//   • Sem dupla contabilização: contas marcadas como já representadas no
//     cálculo operacional (traço/molde/energia das linhas) NÃO são somadas.
//   • Refugo: o custo é absorvido pela PRODUÇÃO BOA (divisores usam good).
//   • Matéria-prima direta: consumo real das ordens sobre TODO o histórico
//     concluído (base produtiva) — nunca influenciada pelo período financeiro
//     nem por DREs excluídas; estimativa do cadastro apenas onde não há
//     lançamento real de consumo na ordem.
//   • Sem divisão por zero, sem invenção: base ausente → 0 + alerta.
//   • Sem arredondamento intermediário: arredonda somente na apresentação.
//   • Rastreável: cada componente carrega origem (source) e o modelo é
//     versionado (calculation_version = "2.2").
// ─────────────────────────────────────────────────────────────────────────────
import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';
import { calculateSuggestedPrice, saleFactor as productSaleFactor } from '@/lib/costUtils';
import { calculateHistoricalProductivity, historyRangeLabel } from '@/lib/pricingProductivity';

export const CALCULATION_VERSION = '2.3';

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

// Períodos financeiros do Simulador de Preços
export const FINANCIAL_PERIODS = [
  { value: 'all_history', label: 'Todas as DREs' },
  { value: 'selected_month', label: 'Mês selecionado' },
  { value: 'last_3', label: 'Últimos 3 meses' },
  { value: 'last_6', label: 'Últimos 6 meses' },
  { value: 'last_12', label: 'Últimos 12 meses' },
];
const PERIOD_MONTHS = { last_3: 3, last_6: 6, last_12: 12 };

export { historyRangeLabel };

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const div = (a, b) => (b > 0 ? a / b : 0);

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
  const factor = productSaleFactor(pt);
  return {
    kg: perPiece * factor,
    estimated: realKg <= 0 || perPiece <= 0 || factor <= 0,
  };
}

export function saleFactor(pt) {
  return productSaleFactor(pt);
}

export function unitLabel(pt) {
  const u = String(pt?.unit || 'un').toLowerCase();
  if (u === 'm2') return 'm²';
  if (u === 'm3') return 'm³';
  if (u === 'm') return 'm';
  return 'un';
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

// ── Matéria-prima: agregação por produto sobre um conjunto de ordens ────────
// Consumo real quando lançado na ordem (× custo do insumo); senão estimativa
// do cadastro para a produção boa. Base = produção BOA (refugo descontado).
function aggregateMaterialByProduct(orders, productTypes, insumoCosts) {
  const ptMap = new Map((productTypes || []).map((p) => [p.id, p]));
  const agg = new Map();
  for (const o of orders || []) {
    const pt = ptMap.get(o.product_type_id);
    if (!pt) continue;
    let m = agg.get(pt.id);
    if (!m) {
      m = { pt, good: 0, materialReal: 0, materialEstimate: 0, realOrders: 0, orders: 0 };
      agg.set(pt.id, m);
    }
    const gross = num(o.actual_quantity);
    const good = Math.max(gross - num(o.loss_second_line) - num(o.loss_discarded), 0);
    m.orders += 1;
    m.good += good;
    let orderReal = 0;
    let hasReal = false;
    for (const key of ENGINE_KEYS) {
      const v = num(o[INSUMO_FIELDS[key].actual]);
      if (v > 0) { hasReal = true; orderReal += v * num(insumoCosts?.[key]); }
    }
    if (hasReal) { m.materialReal += orderReal; m.realOrders += 1; }
    else m.materialEstimate += good * calculateDirectMaterialCost(pt, insumoCosts);
  }
  return agg;
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

  }

  // Matéria-prima: consumo real quando lançado; senão estimativa do cadastro
  const monthMaterial = aggregateMaterialByProduct(monthOrders, productTypes, insumoCosts);
  monthMaterial.forEach((m, ptId) => {
    const agg = perProduct.get(ptId);
    if (!agg) return;
    agg.materialReal = m.materialReal;
    agg.materialEstimate = m.materialEstimate;
    agg.realOrders = m.realOrders;
  });

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
    rates,
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
// financialPeriod: 'all_history' (padrão) | 'selected_month' | 'last_3' | 'last_6' | 'last_12'
//
// BASE FINANCEIRA: DREs do período selecionado, fundidas em média ponderada
//   (Σ custos ÷ Σ base produtiva do período — R$/kg, R$/hora, R$/un).
// BASE PRODUTIVA: produtividade histórica de TODO o histórico de ordens
//   concluídas (calculateHistoricalProductivity) — alimenta TODOS os
//   componentes por hora, a energia operacional e a matéria-prima direta,
//   nunca limitada pelo período financeiro. Período financeiro ≠ período
//   de produtividade/consumo.
export function buildCostModel({
  dres = [],
  orders = [],
  productTypes = [],
  lines = [],
  accounts = [],
  insumoCosts = {},
  financialPeriod = 'all_history',
  excludedMonths = [],
  selectedMonth = null,
}) {
  const lookup = buildAccountLookup(accounts);
  const sorted = [...dres].sort((a, b) => String(a.reference_month).localeCompare(String(b.reference_month)));
  const periodDef = FINANCIAL_PERIODS.find((p) => p.value === financialPeriod) || FINANCIAL_PERIODS[0];

  // DREs dentro do período financeiro selecionado
  const inPeriod = financialPeriod === 'selected_month'
    ? sorted.filter((d) => d.reference_month === selectedMonth)
    : PERIOD_MONTHS[financialPeriod]
      ? sorted.slice(-PERIOD_MONTHS[financialPeriod])
      : sorted;

  // ── BASE PRODUTIVA: histórico completo — independe do período financeiro ──
  const productivity = calculateHistoricalProductivity(orders, productTypes, lines);
  // Matéria-prima na base produtiva: consumo das ordens de TODO o histórico
  // concluído — independente do período financeiro e de DREs excluídas
  const materialByProduct = aggregateMaterialByProduct(orders, productTypes, insumoCosts);
  const lineById = new Map((lines || []).map((l) => [l.id, l]));

  const insufficient = [];
  if (!dres.length) insufficient.push('Nenhuma DRE cadastrada — o custo usa apenas estimativas de cadastro (matéria-prima e molde).');
  else if (!inPeriod.length) insufficient.push(`Nenhuma DRE no período selecionado (${periodDef.label}) — o custo usa apenas estimativas de cadastro.`);

  const analyze = (dre) => analyzeDreMonth({ dre, orders, productTypes, lines, accountLookup: lookup, insumoCosts });
  const allAnalyses = detectAnomalies(inPeriod.map(analyze)).map((a) => ({
    ...a,
    userExcluded: excludedMonths.includes(a.reference_month),
  }));
  const used = allAnalyses.filter((a) => !a.userExcluded);
  const usedDres = inPeriod.filter((d) => !excludedMonths.includes(d.reference_month));
  const usedLabels = used.map((m) => m.month_label);

  // ── BASE FINANCEIRA: média ponderada única (Σ custos ÷ Σ base) ─────────────
  const merged = mergeDres(usedDres);
  const usedRefs = new Set(usedDres.map((d) => d.reference_month));
  const usedOrders = (orders || []).filter((o) => usedRefs.has(String(o.production_date || '').slice(0, 7)));
  const mergedAnalysis = analyzeDreMonth({ dre: merged, orders: usedOrders, productTypes, lines, accountLookup: lookup, insumoCosts, ordersPreFiltered: true });
  const rates = mergedAnalysis.rates;
  const energyFromDre = mergedAnalysis.energyFromDre;
  const dreSource = usedLabels.length ? `DRE ${usedLabels.join(' · ')} (média ponderada)` : 'Sem DRE no período';

  const products = (productTypes || []).map((pt) => {
    const pr = productivity.products.get(pt.id) || {
      hoursPerGoodPiece: 0, source: null, sourceLabel: null, from: null, to: null,
      gross: 0, good: 0, refugo: 0, hours: 0, dominantLineId: null, insufficient: true,
    };
    const sf = saleFactor(pt);
    const wu = weightPerSaleUnit(pt);
    // Horas históricas do artefato (base produtiva) — nunca limitadas ao período
    const hoursPerGoodPiece = pr.hoursPerGoodPiece;
    const hoursPerUnit = hoursPerGoodPiece * sf;
    const ctx = { weightKg: wu.kg, hoursPerUnit, sf };
    const prodLabel = pr.insufficient
      ? 'sem histórico produtivo'
      : `${pr.sourceLabel}${pr.from ? ` (${historyRangeLabel(pr.from, pr.to)})` : ''}`;

    const comps = {};
    const sources = {};
    const estimated = {};
    INDUSTRIAL_COMPONENTS.forEach((k) => { comps[k] = 0; });

    // Matéria-prima direta: consumo real das ordens sobre TODO o histórico
    // concluído (base produtiva) — nunca influenciada pelo período financeiro
    // ou por DREs excluídas; estimativa do cadastro apenas onde não há lançamento
    const matAgg = materialByProduct.get(pt.id);
    if (matAgg && matAgg.good > 0) {
      comps.material_direct = ((matAgg.materialReal + matAgg.materialEstimate) / matAgg.good) * sf;
      sources.material_direct = matAgg.realOrders === 0
        ? 'Cadastro do artefato (estimativa — sem lançamento real de consumo)'
        : matAgg.realOrders === matAgg.orders
          ? 'Consumo real das ordens de produção (histórico completo)'
          : 'Consumo real das ordens + estimativa do cadastro (ordens sem lançamento)';
      estimated.material_direct = matAgg.realOrders === 0;
    } else {
      comps.material_direct = calculateDirectMaterialCost(pt, insumoCosts) * sf;
      sources.material_direct = 'Cadastro do artefato (estimativa — sem produção no histórico)';
      estimated.material_direct = true;
    }

    // Molde: cadastro (lógica inalterada)
    comps.mold = num(pt.mold_cost_per_unit) * sf;
    sources.mold = 'Molde: custo de aquisição ÷ vida útil ÷ peças por ciclo';
    estimated.mold = num(pt.mold_cost_per_unit) <= 0;

    // Energia: da DRE (rateio ponderado) ou operacional com horas históricas
    const dl = pr.dominantLineId ? lineById.get(pr.dominantLineId) : null;
    const kw = num(dl?.used_power_kw);
    const tariff = num(dl?.energy_cost_per_kwh);
    if (energyFromDre) {
      comps.energy = bucketCost(rates, 'energy', ctx);
      sources.energy = `${dreSource} — conta de energia rateada (${basisOf(rates, 'energy') || '—'})`;
    } else if (dl && kw > 0 && tariff > 0 && hoursPerGoodPiece > 0) {
      comps.energy = hoursPerGoodPiece * kw * tariff * sf;
      sources.energy = `Operacional: horas históricas (${prodLabel}) × ${kw} kW × tarifa do kWh (linha ${dl.name})`;
      estimated.energy = true;
    } else {
      comps.energy = 0;
      sources.energy = 'Sem energia operacional: sem linha vinculada ou sem histórico de horas do artefato.';
      estimated.energy = true;
    }

    // Demais componentes da DRE: rateios ponderados × base produtiva histórica
    for (const comp of DRE_BUCKETS) {
      if (comp === 'energy') continue;
      comps[comp] = bucketCost(rates, comp, ctx);
      const basis = basisOf(rates, comp);
      sources[comp] = !basis
        ? 'Sem conta classificada para este componente'
        : basis === BASIS_LABELS.machine_hours
          ? `${dreSource} — rateio por hora × horas históricas (${prodLabel})`
          : `${dreSource} — rateio por ${basis}`;
    }

    // Contas percentuais: aplicadas sobre os demais custos industriais
    const sumNonPct = INDUSTRIAL_COMPONENTS.reduce((s, k) => s + num(comps[k]), 0);
    Object.keys(rates.pct).forEach((comp) => {
      comps[comp] = num(comps[comp]) + rates.pct[comp] * sumNonPct;
      sources[comp] = `${dreSource} — percentual sobre os demais custos industriais`;
    });

    const industrialPerUnit = INDUSTRIAL_COMPONENTS.reduce((s, k) => s + num(comps[k]), 0);
    const alerts = [];
    if (pr.insufficient) alerts.push('Não há histórico produtivo suficiente para calcular o tempo de máquina deste produto.');
    if (wu.estimated) alerts.push('Peso estimado — atualize o cadastro do produto (Peso por Unidade).');
    if (!energyFromDre && hoursPerGoodPiece > 0 && !(dl && kw > 0 && tariff > 0)) {
      alerts.push('Ordens sem linha de produção vinculada — energia operacional indisponível para o artefato.');
    }
    if (pr.insufficient) {
      insufficient.push(`${pt.name}: não há histórico produtivo suficiente para calcular o tempo de máquina deste produto.`);
    }

    return {
      pt,
      weightKg: wu.kg,
      weightEstimated: wu.estimated,
      saleUnit: unitLabel(pt),
      gross: pr.gross,
      good: pr.good,
      refugo: pr.refugo,
      hours: pr.hours,
      components: comps,
      componentEstimated: estimated,
      sources,
      industrialPerUnit,
      lossBurden: calculateLossCost(industrialPerUnit, pr.gross, pr.good),
      goodRatio: pr.gross > 0 ? pr.good / pr.gross : 1,
      monthsWithProduction: used.filter((m) => (m.products[pt.id]?.gross || 0) > 0).length,
      hoursPerGoodPiece,
      productivitySource: pr.insufficient ? 'Sem histórico produtivo suficiente' : pr.sourceLabel,
      productivityRange: pr.insufficient ? null : { from: pr.from, to: pr.to },
      productivityInsufficient: pr.insufficient,
      alerts,
    };
  });

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
    financialPeriod,
    periodLabel: periodDef.label,
    months: allAnalyses,
    usedLabels,
    average: usedLabels.length ? {
      label: `Média ponderada (${usedLabels.join(' · ')})`,
      costPerKg: mergedAnalysis.costPerKg,
      costPerHour: mergedAnalysis.costPerHour,
      industrialTotal: mergedAnalysis.industrialTotal,
    } : null,
    productivity: {
      from: productivity.factory.from,
      to: productivity.factory.to,
      orders: productivity.factory.orders,
    },
    warnings,
    unclassified,
    insufficient: [...insufficient, ...excludedNotes],
    products,
  };
}