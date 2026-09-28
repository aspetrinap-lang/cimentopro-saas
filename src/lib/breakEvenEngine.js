// ─────────────────────────────────────────────────────────────────────────────
// MOTOR DE PONTO DE EQUILÍBRIO — CimentoPro v1.0
//
// Camada FINANCEIRA sobre o industrialCostEngine v2.2: NÃO recria nenhuma
// fórmula de custeio. Consome o modelo do motor (componentes variáveis por
// produto, rateios, produção boa, horas históricas) e soma as contas da DRE
// classificadas pelo gestor na Estrutura da DRE (campos break_even_classification
// e cash_effect da DreAccount).
//
// Três indicadores INDEPENDENTES (não são sinônimos):
//   PE INDUSTRIAL = Custos Fixos Industriais ÷ MC%          (visão de custo de fábrica)
//   PE CAIXA      = Custos Fixos de Caixa ÷ MC%             (visão de desembolso —
//                                                            depreciação/amortização NUNCA entram)
//   PE FINANCEIRO = (Custos Fixos de Caixa + Financeiro de Caixa) ÷ MC%
//
// Regras:
//   • Período: mesmo seletor do motor v2.2 (all_history | selected_month |
//     last_3 | last_6 | last_12) — várias DREs são CONSOLIDADAS (Σ/Σ ponderado),
//     nunca média aritmética de percentuais.
//   • MC oficial = Receita consolidada − Σ contas classificadas como variáveis.
//     O industrialPerUnit NUNCA é usado como custo variável inteiro: por produto
//     extraem-se apenas matéria-prima + molde + energia (operacionais) e as
//     contas variáveis da DRE rateadas pelas MESMAS bases do v2.2.
//   • Anti-dupla-contagem: contas marcadas already_included_in_direct_material /
//     already_included_in_energy NÃO são rateadas novamente por unidade.
//   • Sem divisão por zero: Receita ≤ 0 ou MC% ≤ 0 → breakEven = null
//     (nunca Infinity/NaN/0 como resultado válido).
//   • Sem invenção: mix usa vendas reais quando existem; senão produção boa
//     (com warning explícito).
//   • Rastreável: composição por conta com classificação, efeito caixa e valor.
// ─────────────────────────────────────────────────────────────────────────────
import {
  FINANCIAL_PERIODS,
  buildAccountLookup,
  buildCostModel,
  orderGoodQty,
  pieceWeightKg,
  saleFactor,
  weightPerSaleUnit,
} from '@/lib/industrialCostEngine';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const normName = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const PERIOD_MONTHS = { last_3: 3, last_6: 6, last_12: 12 };

// ── Classificações do Ponto de Equilíbrio (Estrutura da DRE) ────────────────
export const BREAK_EVEN_CLASSIFICATIONS = [
  { value: 'revenue', label: 'Receita', description: 'Receitas utilizadas para determinar o faturamento — não entram como custo.' },
  { value: 'variable', label: 'Variável', description: 'Custa/despesa que varia com a venda ou produção (matéria-prima variável, impostos sobre vendas, comissão, frete, embalagem). Reduz a Margem de Contribuição.' },
  { value: 'fixed_industrial', label: 'Fixo industrial', description: 'Custos industriais fixos: estrutura, mão de obra fixa industrial, manutenção fixa, custos fixos de fábrica. Base do Ponto de Equilíbrio Industrial.' },
  { value: 'fixed_cash', label: 'Fixo caixa', description: 'Custos/despesas fixos com desembolso de caixa: salários, encargos, aluguel, administração, contratos, seguros. Base do Ponto de Equilíbrio de Caixa.' },
  { value: 'fixed_non_cash', label: 'Fixo não caixa', description: 'Custos fixos sem desembolso imediato: depreciação, amortização, provisões. NÃO entram no Ponto de Equilíbrio de Caixa.' },
  { value: 'financial_cash', label: 'Financeiro caixa', description: 'Despesas/compromissos financeiros com desembolso: juros pagos, tarifas bancárias, parcelas. Somam-se ao Ponto de Equilíbrio Financeiro.' },
  { value: 'financial_non_cash', label: 'Financeiro não caixa', description: 'Itens financeiros sem desembolso imediato — não entram no Ponto de Equilíbrio de Caixa nem no Financeiro.' },
  { value: 'excluded', label: 'Excluir do PE', description: 'Não participa do cálculo do Ponto de Equilíbrio.' },
];
export const BREAK_EVEN_LABELS = Object.fromEntries(BREAK_EVEN_CLASSIFICATIONS.map((c) => [c.value, c.label]));

export const CASH_EFFECTS = [
  { value: 'cash_in', label: 'Entrada', description: 'Entrada de caixa (recebimento).' },
  { value: 'cash_out', label: 'Saída', description: 'Saída de caixa (desembolso).' },
  { value: 'non_cash', label: 'Não caixa', description: 'Sem desembolso imediato (depreciação, amortização, provisões).' },
  { value: 'none', label: 'Nenhum', description: 'Sem efeito de caixa definido.' },
];
export const CASH_EFFECT_LABELS = Object.fromEntries(CASH_EFFECTS.map((c) => [c.value, c.label]));

// Como a conta participa do cálculo (coluna de auditoria)
export const PARTICIPATES_LABELS = {
  revenue: '—',
  variable: 'MC',
  fixed_industrial: 'Sim',
  fixed_cash: 'Sim',
  financial_cash: 'Sim',
  fixed_non_cash: 'Não',
  financial_non_cash: 'Não',
  excluded: 'Não',
};

// ── Sugestão automática (default EDITÁVEL — não é verdade contábil) ──────────
const CLASSIFICATION_SUGGESTION = {
  material_direct: 'variable',
  mold: 'variable',
  energy: 'variable',
  direct_labor: 'variable',
  maintenance: 'fixed_industrial',
  depreciation: 'fixed_non_cash',
  factory_overhead: 'fixed_industrial',
  loss: 'variable',
  selling_expense: 'variable',
  tax: 'variable',
  commission: 'variable',
  freight: 'variable',
  financial: 'financial_cash',
  other: 'excluded',
};
export function suggestBreakEvenClassification(costComponentType) {
  return CLASSIFICATION_SUGGESTION[costComponentType] || 'excluded';
}

const CASH_EFFECT_SUGGESTION = {
  revenue: 'cash_in',
  variable: 'cash_out',
  fixed_industrial: 'cash_out',
  fixed_cash: 'cash_out',
  fixed_non_cash: 'non_cash',
  financial_cash: 'cash_out',
  financial_non_cash: 'non_cash',
  excluded: 'none',
};
export function cashEffectSuggestion(classification) {
  return CASH_EFFECT_SUGGESTION[classification] || 'none';
}

// Classificação efetiva de uma conta: contas antigas sem configuração →
// excluded/none (compatibilidade) e marcadas como não configuradas (alerta).
export function resolveBreakEvenAccount(account) {
  const configured = BREAK_EVEN_CLASSIFICATIONS.some((c) => c.value === account?.break_even_classification);
  const cashConfigured = CASH_EFFECTS.some((c) => c.value === account?.cash_effect);
  return {
    classification: configured ? account.break_even_classification : 'excluded',
    cashEffect: cashConfigured ? account.cash_effect : 'none',
    configured,
  };
}

// ── Fórmulas fundamentais (fonte única do Ponto de Equilíbrio) ──────────────
export function calculateContributionMargin(revenue, variableCosts) {
  const r = num(revenue);
  const value = r - num(variableCosts);
  return { value, percent: r > 0 ? value / r : null };
}

export function calculateBreakEven(fixedCosts, contributionMarginPercent) {
  if (contributionMarginPercent == null || !(contributionMarginPercent > 0)) return null;
  const value = num(fixedCosts) / contributionMarginPercent;
  return Number.isFinite(value) ? value : null;
}

export function calculateSafetyMargin(revenue, breakEvenRevenue) {
  const r = num(revenue);
  if (!(r > 0) || breakEvenRevenue == null) return { value: null, percent: null };
  const value = r - breakEvenRevenue;
  return { value, percent: (value / r) * 100 };
}

export function calculateOperationalResult(revenue, variableCosts, ...fixedCosts) {
  return num(revenue) - num(variableCosts) - fixedCosts.reduce((s, f) => s + num(f), 0);
}

// ── Seleção de período (mesma regra do motor v2.2) ───────────────────────────
function selectPeriodDres(dres, financialPeriod, selectedMonth, excludedMonths) {
  const sorted = [...dres].sort((a, b) => String(a.reference_month).localeCompare(String(b.reference_month)));
  const inPeriod = financialPeriod === 'selected_month'
    ? sorted.filter((d) => d.reference_month === selectedMonth)
    : PERIOD_MONTHS[financialPeriod]
      ? sorted.slice(-PERIOD_MONTHS[financialPeriod])
      : sorted;
  const used = inPeriod.filter((d) => !excludedMonths.includes(d.reference_month));
  const def = FINANCIAL_PERIODS.find((p) => p.value === financialPeriod) || FINANCIAL_PERIODS[0];
  return { used, periodLabel: def.label };
}

// ── Soma das contas da DRE do período por classificação ──────────────────────
function classifyPeriodItems(usedDres, lookup) {
  const buckets = {
    revenue: 0, variable: 0, fixed_industrial: 0, fixed_cash: 0,
    fixed_non_cash: 0, financial_cash: 0, financial_non_cash: 0, excluded: 0,
  };
  const byAccount = new Map();
  const variableAccountsDetail = [];
  let unclassifiedCount = 0;
  for (const dre of usedDres) {
    for (const it of dre.items || []) {
      if (!it || !it.account_name) continue;
      const value = num(it.actual_value);
      const account = (it.account_id && lookup.byId[it.account_id]) || lookup.byName[normName(it.account_name)] || null;
      const cls = account
        ? resolveBreakEvenAccount(account)
        : { classification: 'excluded', cashEffect: 'none', configured: false };
      if (!cls.configured) unclassifiedCount += 1;
      buckets[cls.classification] += value;
      if (cls.classification === 'variable' && account) variableAccountsDetail.push({ account, value });

      const key = account?.id || `n:${normName(it.account_name)}`;
      let row = byAccount.get(key);
      if (!row) {
        row = {
          account_name: it.account_name,
          account_id: account?.id || null,
          classification: cls.classification,
          cashEffect: cls.cashEffect,
          configured: cls.configured,
          value: 0,
        };
        byAccount.set(key, row);
      }
      row.value += value;
    }
  }
  const composition = [...byAccount.values()].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  return { buckets, composition, unclassifiedCount, variableAccountsDetail };
}

// ── Bases produtivas do período (produção BOA — mesmas regras do motor v2.2) ─
function periodBases(periodOrders, productTypes) {
  const ptMap = new Map((productTypes || []).map((p) => [p.id, p]));
  let weightKg = 0;
  let hours = 0;
  let good = 0;
  for (const o of periodOrders) {
    const pt = ptMap.get(o.product_type_id);
    if (!pt) continue;
    const g = orderGoodQty(o);
    weightKg += g * pieceWeightKg(pt);
    hours += num(o.production_minutes) / 60;
    good += g;
  }
  return { weightKg, hours, good };
}

// ── Rateio das contas variáveis da DRE por unidade (mesmas bases do v2.2) ────
// Contas já representadas no custo operacional (matéria/energia) não são
// somadas novamente — anti-dupla-contagem.
function variableUnitRates(variableAccountsDetail, bases) {
  return (variableAccountsDetail || [])
    .filter((d) => d.account
      && d.account.already_included_in_direct_material !== true
      && d.account.already_included_in_energy !== true)
    .map((d) => {
      const basis = d.account.rate_basis;
      const base = basis === 'kg' ? bases.weightKg
        : (basis === 'machine_hours' || basis === 'production_hours') ? bases.hours
        : basis === 'unit' ? bases.good
        : 0;
      return { account: d.account, basis, rate: base > 0 ? d.value / base : 0 };
    })
    .filter((r) => r.rate > 0);
}

function productBaseForBasis({ weightKg, hoursPerUnit, sf }, basis) {
  if (basis === 'kg') return weightKg;
  if (basis === 'machine_hours' || basis === 'production_hours') return hoursPerUnit;
  if (basis === 'unit') return sf;
  return 0;
}

// ── Mix de produtos ──────────────────────────────────────────────────────────
// Vendas reais por produto quando existem; senão produção boa como aproximação
// (com warning explícito — nunca substituição silenciosa).
export function calculateSalesMix({ periodOrders, productTypes, salesByProduct, model, variableAccountsDetail, bases }) {
  const warnings = [];
  const ptMap = new Map((productTypes || []).map((p) => [p.id, p]));
  const modelByProduct = new Map((model?.products || []).map((p) => [p.pt.id, p]));

  let qtyByProduct;
  let source = 'production';
  const salesEntries = Object.entries(salesByProduct || {}).filter(([, q]) => num(q) > 0);
  if (salesEntries.length) {
    qtyByProduct = new Map(salesEntries.map(([pid, q]) => [pid, num(q)]));
    source = 'sales';
  } else {
    qtyByProduct = new Map();
    for (const o of periodOrders || []) {
      const pid = o.product_type_id;
      if (!pid || !ptMap.get(pid)) continue;
      qtyByProduct.set(pid, (qtyByProduct.get(pid) || 0) + orderGoodQty(o));
    }
    if (qtyByProduct.size > 0) {
      warnings.push('Mix de vendas não disponível. O cálculo utiliza o mix de produção como aproximação.');
    }
  }

  if (!qtyByProduct.size) {
    warnings.push('Dados insuficientes para representar o mix de produtos com precisão.');
    return { source, products: [], weightedPrice: null, weightedContributionMarginPercent: null, totalQuantity: 0, warnings };
  }

  const totalQty = [...qtyByProduct.values()].reduce((s, q) => s + q, 0);
  const rates = variableUnitRates(variableAccountsDetail, bases);
  const rows = [];
  for (const [pid, qty] of qtyByProduct) {
    const pt = ptMap.get(pid);
    if (!pt) continue;
    const mp = modelByProduct.get(pid);
    const sf = saleFactor(pt);
    const wu = weightPerSaleUnit(pt);
    const hoursPerUnit = num(mp?.hoursPerGoodPiece) * sf;
    const price = num(pt.selling_price);
    // Componentes VARIÁVEIS do industrialPerUnit (nunca o total): matéria + molde + energia
    const operational = mp
      ? num(mp.components.material_direct) + num(mp.components.mold) + num(mp.components.energy)
      : 0;
    const dreVariable = rates.reduce(
      (s, r) => s + r.rate * productBaseForBasis({ weightKg: wu.kg, hoursPerUnit, sf }, r.basis),
      0
    );
    const variableUnit = operational + dreVariable;
    const contributionUnit = price - variableUnit;
    rows.push({
      id: pid,
      name: pt.name,
      unit: mp?.saleUnit || 'un',
      qty,
      share: totalQty > 0 ? qty / totalQty : 0,
      price,
      variableUnit,
      variableOperational: operational,
      variableDre: dreVariable,
      contributionUnit,
      contributionPercent: price > 0 ? contributionUnit / price : null,
      contributionTotal: contributionUnit * qty,
      revenueEstimate: price * qty,
    });
  }

  const withPrice = rows.filter((r) => r.price > 0 && r.qty > 0);
  const priceQty = withPrice.reduce((s, r) => s + r.qty, 0);
  const weightedPrice = priceQty > 0 ? withPrice.reduce((s, r) => s + r.revenueEstimate, 0) / priceQty : null;
  const revenueEstimate = rows.reduce((s, r) => s + r.revenueEstimate, 0);
  const contributionTotal = rows.reduce((s, r) => s + r.contributionTotal, 0);
  const weightedContributionMarginPercent = revenueEstimate > 0 ? contributionTotal / revenueEstimate : null;

  return {
    source,
    products: rows.sort((a, b) => b.qty - a.qty),
    weightedPrice,
    weightedContributionMarginPercent,
    totalQuantity: totalQty,
    warnings,
  };
}

// ── Ponto de Equilíbrio de UM mês individual (gráfico de evolução) ───────────
function monthlyBreakEven(dre, lookup) {
  const { buckets } = classifyPeriodItems([dre], lookup);
  const revenue = num(dre.faturamento_actual) > 0 ? num(dre.faturamento_actual) : buckets.revenue;
  const cm = calculateContributionMargin(revenue, buckets.variable);
  const mcPercent = revenue > 0 ? cm.percent : null;
  return {
    month: dre.month_label,
    revenue,
    industrial: calculateBreakEven(buckets.fixed_industrial, mcPercent),
    cash: calculateBreakEven(buckets.fixed_cash, mcPercent),
    financial: calculateBreakEven(buckets.fixed_cash + buckets.financial_cash, mcPercent),
  };
}

// ── ANÁLISE COMPLETA ─────────────────────────────────────────────────────────
// Camada financeira sobre o modelo v2.2: consome buildCostModel (fonte única do
// custeio) e classifica as contas da DRE do período por Ponto de Equilíbrio.
export function buildBreakEvenAnalysis({
  dres = [],
  orders = [],
  productTypes = [],
  lines = [],
  accounts = [],
  insumoCosts = {},
  financialPeriod = 'all_history',
  selectedMonth = null,
  excludedMonths = [],
  salesByProduct = null,
}) {
  const lookup = buildAccountLookup(accounts);
  const { used, periodLabel } = selectPeriodDres(dres, financialPeriod, selectedMonth, excludedMonths);

  const warnings = [];
  if (!used.length) warnings.push('Dados insuficientes para calcular o Ponto de Equilíbrio.');

  const { buckets, composition, unclassifiedCount, variableAccountsDetail } = classifyPeriodItems(used, lookup);
  if (unclassifiedCount > 0) {
    warnings.push('Existem contas da DRE sem classificação para o Ponto de Equilíbrio. Revise a Estrutura da DRE.');
  }

  // Receita consolidada: linha de faturamento das DREs; fallback contas de receita
  const revenueFromDre = used.reduce((s, d) => s + num(d.faturamento_actual), 0);
  const revenue = revenueFromDre > 0 ? revenueFromDre : buckets.revenue;
  const revenueSource = revenueFromDre > 0 ? 'faturamento' : 'contas de receita';

  const variableCosts = buckets.variable;
  if (revenue > 0 && variableCosts <= 0) {
    warnings.push('Nenhuma conta da DRE classificada como custo variável — a Margem de Contribuição assume praticamente 100% da receita. Revise a Estrutura da DRE.');
  }
  if (!(revenue > 0)) warnings.push('Não existe faturamento válido no período selecionado.');

  const cm = calculateContributionMargin(revenue, variableCosts);
  const mcPercent = revenue > 0 ? cm.percent : null;
  if (revenue > 0 && !(mcPercent > 0)) {
    warnings.push('Margem de Contribuição zero ou negativa. Ponto de Equilíbrio não calculável.');
  }

  const fixedIndustrialCosts = buckets.fixed_industrial;
  const fixedCashCosts = buckets.fixed_cash;
  const fixedNonCashCosts = buckets.fixed_non_cash;
  const financialCashCosts = buckets.financial_cash;
  const financialNonCashCosts = buckets.financial_non_cash;

  const industrialBreakEvenRevenue = calculateBreakEven(fixedIndustrialCosts, mcPercent);
  const cashBreakEvenRevenue = calculateBreakEven(fixedCashCosts, mcPercent);
  const financialBreakEvenRevenue = calculateBreakEven(fixedCashCosts + financialCashCosts, mcPercent);

  // Ordens do período financeiro (mesma regra do motor) e bases produtivas
  const usedRefs = new Set(used.map((d) => d.reference_month));
  const periodOrders = (orders || []).filter((o) => usedRefs.has(String(o.production_date || '').slice(0, 7)));
  const bases = periodBases(periodOrders, productTypes);

  // Modelo v2.2 — fonte única do custeio (componentes por produto)
  const model = buildCostModel({
    dres, orders, productTypes, lines, accounts, insumoCosts,
    financialPeriod, excludedMonths, selectedMonth,
  });

  const mix = calculateSalesMix({ periodOrders, productTypes, salesByProduct, model, variableAccountsDetail, bases });
  warnings.push(...mix.warnings);

  const unitsFor = (be) => (be != null && mix.weightedPrice > 0 ? be / mix.weightedPrice : null);

  const operatingResults = {
    industrial: calculateOperationalResult(revenue, variableCosts, fixedIndustrialCosts),
    cash: calculateOperationalResult(revenue, variableCosts, fixedCashCosts),
    financial: calculateOperationalResult(revenue, variableCosts, fixedCashCosts, financialCashCosts),
  };

  const safety = calculateSafetyMargin(revenue, financialBreakEvenRevenue);

  const monthlySeries = used.map((dre) => monthlyBreakEven(dre, lookup));

  const calculationStatus = !used.length
    ? 'insufficient'
    : !(revenue > 0)
      ? 'no_revenue'
      : !(mcPercent > 0)
        ? 'no_margin'
        : 'ok';

  return {
    calculationVersion: '1.0',
    costingEngineVersion: model.calculation_version,
    period: {
      label: periodLabel,
      dreCount: used.length,
      months: used.map((d) => d.month_label),
    },
    revenue: { current: revenue, source: revenueSource },
    variableCosts: { total: variableCosts, percent: revenue > 0 ? variableCosts / revenue : null },
    contributionMargin: { value: cm.value, percent: mcPercent },
    fixedIndustrialCosts,
    fixedCashCosts,
    fixedNonCashCosts,
    financialCashCosts,
    financialNonCashCosts,
    industrial: {
      fixedCosts: fixedIndustrialCosts,
      breakEvenRevenue: industrialBreakEvenRevenue,
      breakEvenUnits: unitsFor(industrialBreakEvenRevenue),
    },
    cash: {
      fixedCosts: fixedCashCosts,
      breakEvenRevenue: cashBreakEvenRevenue,
      breakEvenUnits: unitsFor(cashBreakEvenRevenue),
    },
    financial: {
      fixedCosts: fixedCashCosts,
      financialCashCosts,
      breakEvenRevenue: financialBreakEvenRevenue,
      breakEvenUnits: unitsFor(financialBreakEvenRevenue),
    },
    operatingResults,
    safetyMargin: {
      revenue,
      breakEven: financialBreakEvenRevenue,
      value: safety.value,
      percent: safety.percent,
    },
    mix,
    monthlySeries,
    composition,
    warnings,
    calculationStatus,
  };
}