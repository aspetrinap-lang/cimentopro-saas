// ─────────────────────────────────────────────────────────────────────────────
// MOTOR DE PONTO DE EQUILÍBRO — CimentoPro v1.1
//
// Camada GERENCIAL sobre a DRE (somente leitura — nunca grava/altera valores)
// e sobre o industrialCostEngine v2.2 (usado apenas para o mix de produtos).
// A classificação oficial é FIXA — aplicada às contas da Estrutura da DRE pela
// rotina apply_break_even_classification — e o motor NUNCA reclassifica contas
// automaticamente nem usa a categoria contábil original para substituí-la.
//
// Cadeia: DRE → Classificação Gerencial de PE → este motor → PEC/PEF/PEE.
//   Faturamento Bruto = Σ contas de receita (receita de venda + outras receitas)
//   Receita Líquida   = Faturamento Bruto − Deduções da Receita (ISS, PIS…)
//   MC                = Receita Líquida − Custos Variáveis Puros
//   MC%               = MC ÷ Faturamento Bruto (denominador SEMPRE o bruto)
//
// Indicadores (substituem os três PEs da v1.0 — industrial/caixa/financeiro):
//   PEC = Gastos Fixos Operacionais ÷ MC%
//         (não inclui juros, IOF, amortizações, investimentos, lucros)
//   PEF = (Gastos Fixos Operacionais + Obrigações Não Operacionais de Caixa)
//         ÷ MC% — juros, IOF e amortizações; INVESTIMENTOS (máquinas,
//         caminhões/veículos) NUNCA entram automaticamente (papel investment)
//   PEE = (Gastos Fixos Operacionais + Lucro Mínimo Desejado) ÷ MC%
//         — lucro desejado = 0 → PEE = PEC
//
// Regras:
//   • Períodos múltiplos: CONSOLIDAÇÃO POR SOMA (Σ) e depois os indicadores —
//     média aritmética dos pontos de equilíbrio é PROIBIDA.
//   • Subtotais da DRE (Lucro Bruto, EBITDA, Margem de Contribuição…) nunca
//     entram como contas individuais — anti-dupla-contagem.
//   • MC ≤ 0 → PE = null e status "invalid_margin" (nunca Infinity/NaN/0).
//   • Margem de Segurança = (Faturamento − PEC), negativa preservada.
//   • O Simulador de Preços permanece isolado (nenhum dado é gravado).
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

// ── 11. Subtotais da DRE — resultados calculados, NUNCA contas individuais ───
// (anti-dupla-contagem: analíticas + subtotal jamais somadas juntas)
const SUBTOTAL_ACCOUNTS = new Set([
  'receita operacional bruta', 'receita operacional liquida', 'custo de producao',
  'lucro bruto', 'margem de contribuicao', 'ebitda', 'resultado financeiro',
  'lucro/prejuizo', 'lucro ou prejuizo', 'investimentos',
  'resultado financeiro apos investimentos', 'resultado financeiro apos participacoes',
]);
const isSubtotal = (name) => SUBTOTAL_ACCOUNTS.has(normName(name).replace(/^[=\-—\s()+.]+/, ''));

// ── Classificações do Ponto de Equilíbrio (Estrutura da DRE) ────────────────
// fixed_operational é a classificação oficial v1.1; os valores legados
// (fixed_industrial/fixed_cash) continuam válidos e são mapeados pelo motor.
export const BREAK_EVEN_CLASSIFICATIONS = [
  { value: 'revenue', label: 'Receita', description: 'Faturamento Bruto: receita de venda de produtos e outras receitas. Nunca entram como custo ou despesa.' },
  { value: 'variable', label: 'Variável', description: 'Reduz a Margem de Contribuição. O bloco (Deduções da Receita × Custos Variáveis) distingue deduções de impostos/devoluções dos custos variáveis puros.' },
  { value: 'fixed_operational', label: 'Fixo operacional', description: 'Gastos Fixos Operacionais (Fábrica, Pessoal, Estrutura) — base do PEC, PEF e PEE. Classificação oficial do Ponto de Equilíbrio v1.1.' },
  { value: 'fixed_industrial', label: 'Fixo industrial (legado)', description: 'Valor antigo — tratado como Fixo operacional pelo motor v1.1.' },
  { value: 'fixed_cash', label: 'Fixo caixa (legado)', description: 'Valor antigo — tratado como Fixo operacional pelo motor v1.1.' },
  { value: 'fixed_non_cash', label: 'Fixo não caixa', description: 'Custos fixos sem desembolso imediato: depreciação, amortização, provisões. Não entram no PEC/PEF/PEE.' },
  { value: 'financial_cash', label: 'Financeiro caixa', description: 'Obrigações Não Operacionais de Caixa: juros, IOF e amortizações entram no PEF. Investimentos (papel "investment") NUNCA entram automaticamente.' },
  { value: 'financial_non_cash', label: 'Financeiro não caixa', description: 'Itens financeiros sem desembolso imediato — fora do PEC, PEF e PEE.' },
  { value: 'excluded', label: 'Excluir do PE', description: 'Não participa do cálculo do Ponto de Equilíbrio.' },
];
export const BREAK_EVEN_LABELS = Object.fromEntries(BREAK_EVEN_CLASSIFICATIONS.map((c) => [c.value, c.label]));
BREAK_EVEN_LABELS.subtotal = 'Subtotal da DRE';

export const CASH_EFFECTS = [
  { value: 'cash_in', label: 'Entrada', description: 'Entrada de caixa (recebimento).' },
  { value: 'cash_out', label: 'Saída', description: 'Saída de caixa (desembolso).' },
  { value: 'non_cash', label: 'Não caixa', description: 'Sem desembolso imediato (depreciação, amortização, provisões).' },
  { value: 'none', label: 'Nenhum', description: 'Sem efeito de caixa definido.' },
];
export const CASH_EFFECT_LABELS = Object.fromEntries(CASH_EFFECTS.map((c) => [c.value, c.label]));

// Blocos gerenciais da composição auditável (v1.1)
export const BLOCK_LABELS = {
  revenue: 'Faturamento Bruto (Receita)',
  revenue_deduction: 'Deduções da Receita',
  variable_costs: 'Custos Variáveis Puros',
  factory: 'Fixos — Fábrica',
  personnel: 'Fixos — Pessoal / RH',
  structure: 'Fixos — Estrutura e Administração',
  financial_obligations: 'Obrigações Não Operacionais de Caixa',
  investment: 'Investimentos — não incorporados ao PEF operacional',
  other: 'Sem bloco definido',
};
export const BLOCK_ORDER = [
  'revenue', 'revenue_deduction', 'variable_costs', 'factory',
  'personnel', 'structure', 'financial_obligations', 'investment', 'other',
];

export const ROLE_LABELS = {
  interest: 'Juros',
  iof: 'IOF',
  amortization: 'Amortizações',
  investment: 'Investimento',
  financial_other: 'Financeiro',
};

// Como a conta participa do cálculo (coluna de auditoria)
export const PARTICIPATES_LABELS = {
  revenue: '—',
  variable: 'MC',
  fixed_operational: 'Sim (PEC/PEE)',
  fixed_industrial: 'Sim (PEC/PEE)',
  fixed_cash: 'Sim (PEC/PEE)',
  financial_cash: 'Sim (PEF)',
  fixed_non_cash: 'Não',
  financial_non_cash: 'Não',
  excluded: 'Não',
  subtotal: 'Subtotal',
};

// ── Sugestão automática (default EDITÁVEL — não é verdade contábil) ──────────
const CLASSIFICATION_SUGGESTION = {
  material_direct: 'variable',
  mold: 'variable',
  energy: 'fixed_operational',
  direct_labor: 'fixed_operational',
  maintenance: 'fixed_operational',
  depreciation: 'fixed_non_cash',
  factory_overhead: 'fixed_operational',
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
  fixed_operational: 'cash_out',
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

// ── Taxonomia v1.1: valores legados → buckets novos ──────────────────────────
export const EFFECTIVE_V11 = {
  revenue: 'revenue',
  variable: 'variable',
  fixed_operational: 'fixed_operational',
  fixed_industrial: 'fixed_operational',
  fixed_cash: 'fixed_operational',
  fixed_non_cash: 'fixed_non_cash',
  financial_cash: 'financial_cash',
  financial_non_cash: 'financial_non_cash',
  excluded: 'excluded',
};

// Classificação efetiva de uma conta: contas antigas sem configuração →
// excluded/none (compatibilidade) e marcadas como não configuradas (alerta).
export function resolveBreakEvenAccount(account) {
  const configured = BREAK_EVEN_CLASSIFICATIONS.some((c) => c.value === account?.break_even_classification);
  const cashConfigured = CASH_EFFECTS.some((c) => c.value === account?.cash_effect);
  const classification = configured ? account.break_even_classification : 'excluded';
  const effective = EFFECTIVE_V11[classification] || 'excluded';
  const financialRole = account?.financial_role || (effective === 'financial_cash' ? 'financial_other' : null);
  const block = account?.break_even_block
    || (classification === 'revenue' ? 'revenue'
      : effective === 'variable' ? 'variable_costs'
      : effective === 'financial_cash' ? 'financial_obligations'
      : null);
  return {
    classification,
    effective,
    cashEffect: cashConfigured ? account.cash_effect : 'none',
    configured,
    block,
    financialRole,
  };
}

// ── Fórmulas fundamentais (fonte única do Ponto de Equilíbrio) ──────────────
export function calculateContributionMargin(netRevenue, variableCosts) {
  const value = num(netRevenue) - num(variableCosts);
  return { value, percent: num(netRevenue) > 0 ? value / num(netRevenue) : null };
}

export function calculateBreakEven(fixedCosts, contributionMarginPercent) {
  if (contributionMarginPercent == null || !(contributionMarginPercent > 0)) return null;
  const value = num(fixedCosts) / contributionMarginPercent;
  return Number.isFinite(value) ? value : null;
}

export function calculateSafetyMargin(revenue, breakEvenRevenue) {
  const r = num(revenue);
  if (!(r > 0) || breakEvenRevenue == null) return { value: null, percent: null };
  const value = r - breakEvenRevenue; // negativo é preservado (nunca vira zero)
  return { value, percent: (value / r) * 100 };
}

export function calculateOperationalResult(netRevenue, variableCosts, ...fixedCosts) {
  return num(netRevenue) - num(variableCosts) - fixedCosts.reduce((s, f) => s + num(f), 0);
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

// ── Soma das contas da DRE do período por classificação v1.1 ─────────────────
function classifyPeriodItems(usedDres, lookup) {
  const buckets = {
    revenue: 0, deductions: 0, variable: 0, fixed_operational: 0, financial_cash: 0,
    investments: 0, fixed_non_cash: 0, financial_non_cash: 0, excluded: 0,
  };
  const byAccount = new Map();
  const variableAccountsDetail = [];
  let unclassifiedCount = 0;
  for (const dre of usedDres) {
    for (const it of dre.items || []) {
      if (!it || !it.account_name) continue;
      // Subtotais da DRE nunca entram como contas individuais
      if (isSubtotal(it.account_name)) continue;
      const value = num(it.actual_value);
      const account = (it.account_id && lookup.byId[it.account_id]) || lookup.byName[normName(it.account_name)] || null;
      const cls = account
        ? resolveBreakEvenAccount(account)
        : { classification: 'excluded', effective: 'excluded', cashEffect: 'none', configured: false, block: null, financialRole: null };
      if (!cls.configured) unclassifiedCount += 1;

      if (cls.effective === 'revenue') {
        buckets.revenue += value;
      } else if (cls.effective === 'variable') {
        if (cls.block === 'revenue_deduction') buckets.deductions += value;
        else buckets.variable += value;
      } else if (cls.effective === 'fixed_operational') {
        buckets.fixed_operational += value;
      } else if (cls.effective === 'financial_cash') {
        // Investimentos (papel investment) ficam FORA do PEF operacional —
        // só entram com configuração explícita (enabled_for_pef = true).
        if (cls.financialRole === 'investment' && !(account && account.enabled_for_pef === true)) {
          buckets.investments += value;
        } else {
          buckets.financial_cash += value;
        }
      } else if (cls.effective === 'fixed_non_cash') {
        buckets.fixed_non_cash += value;
      } else if (cls.effective === 'financial_non_cash') {
        buckets.financial_non_cash += value;
      } else {
        buckets.excluded += value;
      }
      // Custos variáveis puros alimentam o mix por produto (deduções não)
      if (cls.effective === 'variable' && cls.block !== 'revenue_deduction' && account) {
        variableAccountsDetail.push({ account, value });
      }

      const key = account?.id || `n:${normName(it.account_name)}`;
      let row = byAccount.get(key);
      if (!row) {
        row = {
          account_name: it.account_name,
          account_id: account?.id || null,
          classification: cls.classification,
          effective: cls.effective,
          block: cls.block || 'other',
          financialRole: cls.financialRole,
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
// Cada mês é calculado individualmente para a evolução — o resultado do PERÍODO
// nunca é média destes valores (consolidação é sempre por soma).
function monthlyBreakEven(dre, lookup, desiredProfit = 0) {
  const { buckets } = classifyPeriodItems([dre], lookup);
  const gross = buckets.revenue > 0 ? buckets.revenue : num(dre.faturamento_actual);
  const net = gross - buckets.deductions;
  const cm = calculateContributionMargin(net, buckets.variable);
  const mcPercent = gross > 0 ? cm.percent : null;
  return {
    month: dre.month_label,
    revenue: gross,
    deductions: buckets.deductions,
    netRevenue: net,
    variable: buckets.variable,
    fixedOperational: buckets.fixed_operational,
    financial: buckets.financial_cash,
    pec: calculateBreakEven(buckets.fixed_operational, mcPercent),
    pef: calculateBreakEven(buckets.fixed_operational + buckets.financial_cash, mcPercent),
    pee: calculateBreakEven(buckets.fixed_operational + num(desiredProfit), mcPercent),
  };
}

// ── ANÁLISE COMPLETA (v1.1) ──────────────────────────────────────────────────
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
  desiredProfit = 0,
}) {
  const lookup = buildAccountLookup(accounts);
  const { used, periodLabel } = selectPeriodDres(dres, financialPeriod, selectedMonth, excludedMonths);

  const warnings = [];
  if (!used.length) warnings.push('Dados insuficientes para calcular o Ponto de Equilíbrio.');

  const { buckets, composition, unclassifiedCount, variableAccountsDetail } = classifyPeriodItems(used, lookup);
  if (unclassifiedCount > 0) {
    warnings.push('Existem contas da DRE sem classificação para o Ponto de Equilíbrio. Revise a Estrutura da DRE.');
  }

  // Faturamento Bruto: Σ contas de receita (receita de venda + outras receitas);
  // fallback: linha de faturamento das DREs do período.
  const revenueFromAccounts = buckets.revenue;
  const revenueFromDre = used.reduce((s, d) => s + num(d.faturamento_actual), 0);
  const grossRevenue = revenueFromAccounts > 0 ? revenueFromAccounts : revenueFromDre;
  const revenueSource = revenueFromAccounts > 0 ? 'contas de receita (Faturamento Bruto)' : 'linha de faturamento';

  const deductions = buckets.deductions;
  const netRevenue = grossRevenue - deductions; // Receita Líquida
  const variableCosts = buckets.variable;

  if (grossRevenue > 0 && deductions <= 0) {
    warnings.push('Nenhuma Dedução da Receita classificada — a Receita Líquida equivale ao Faturamento Bruto.');
  }
  if (grossRevenue > 0 && variableCosts <= 0) {
    warnings.push('Nenhuma conta da DRE classificada como custo variável — a Margem de Contribuição assume praticamente 100% da receita. Revise a Estrutura da DRE.');
  }
  if (!(grossRevenue > 0)) warnings.push('Não existe faturamento válido no período selecionado.');

  const cm = calculateContributionMargin(netRevenue, variableCosts);
  const mcValue = cm.value;
  const mcPercent = grossRevenue > 0 ? mcValue / grossRevenue : null;

  const fixedOperationalCosts = buckets.fixed_operational;
  const financialCashCosts = buckets.financial_cash;
  const investments = buckets.investments;
  const fixedNonCashCosts = buckets.fixed_non_cash;
  const financialNonCashCosts = buckets.financial_non_cash;

  // MC zero/negativa: nunca Infinity/NaN/0 como PE válido
  const profit = num(desiredProfit);
  const pecValue = calculateBreakEven(fixedOperationalCosts, mcPercent);
  const pefValue = calculateBreakEven(fixedOperationalCosts + financialCashCosts, mcPercent);
  const peeValue = calculateBreakEven(fixedOperationalCosts + profit, mcPercent);

  if (grossRevenue > 0 && !(mcPercent > 0)) {
    warnings.push('Não é possível calcular um Ponto de Equilíbrio válido enquanto a Margem de Contribuição for zero ou negativa.');
  }

  // Ordens do período financeiro (mesma regra do motor) e bases produtivas
  const usedRefs = new Set(used.map((d) => d.reference_month));
  const periodOrders = (orders || []).filter((o) => usedRefs.has(String(o.production_date || '').slice(0, 7)));
  const bases = periodBases(periodOrders, productTypes);

  // Modelo v2.2 — fonte única do custeio (componentes por produto) — só leitura
  const model = buildCostModel({
    dres, orders, productTypes, lines, accounts, insumoCosts,
    financialPeriod, excludedMonths, selectedMonth,
  });

  const mix = calculateSalesMix({ periodOrders, productTypes, salesByProduct, model, variableAccountsDetail, bases });
  warnings.push(...mix.warnings);

  const unitsFor = (be) => (be != null && mix.weightedPrice > 0 ? be / mix.weightedPrice : null);

  const safety = calculateSafetyMargin(grossRevenue, pecValue); // base: PEC

  const monthlySeries = used.map((dre) => monthlyBreakEven(dre, lookup, profit));

  // Referencial mensal (média das DREs: total do período ÷ nº de meses).
  // Apenas informativo — os PEs oficiais do período continuam consolidados
  // por SOMA e nenhum cálculo existente é alterado.
  const monthCount = used.length;
  const monthlyAverage = monthCount > 1
    ? {
        months: monthCount,
        revenue: grossRevenue / monthCount,
        pec: pecValue != null ? pecValue / monthCount : null,
        pef: pefValue != null ? pefValue / monthCount : null,
        pee: peeValue != null ? peeValue / monthCount : null,
      }
    : null;

  const calculationStatus = !used.length
    ? 'insufficient'
    : !(grossRevenue > 0)
      ? 'no_revenue'
      : !(mcPercent > 0)
        ? 'invalid_margin'
        : 'ok';

  return {
    calculationVersion: '1.1',
    costingEngineVersion: model.calculation_version,
    period: {
      label: periodLabel,
      dreCount: used.length,
      months: used.map((d) => d.month_label),
    },
    revenue: { gross: grossRevenue, deductions, net: netRevenue, source: revenueSource },
    variableCosts: { total: variableCosts, percent: grossRevenue > 0 ? variableCosts / grossRevenue : null },
    contributionMargin: { value: mcValue, percent: mcPercent },
    fixedOperationalCosts,
    financialCashCosts,
    investments,
    fixedNonCashCosts,
    financialNonCashCosts,
    pec: {
      fixedCosts: fixedOperationalCosts,
      breakEvenRevenue: pecValue,
      breakEvenUnits: unitsFor(pecValue),
    },
    pef: {
      fixedCosts: fixedOperationalCosts,
      financialCashCosts,
      breakEvenRevenue: pefValue,
      breakEvenUnits: unitsFor(pefValue),
    },
    pee: {
      fixedCosts: fixedOperationalCosts,
      desiredProfit: profit,
      breakEvenRevenue: peeValue,
      breakEvenUnits: unitsFor(peeValue),
    },
    results: {
      operational: netRevenue - variableCosts - fixedOperationalCosts,
      financial: netRevenue - variableCosts - fixedOperationalCosts - financialCashCosts,
    },
    safetyMargin: {
      revenue: grossRevenue,
      breakEven: pecValue,
      value: safety.value,
      percent: safety.percent,
    },
    mix,
    monthlySeries,
    monthlyAverage,
    composition,
    warnings,
    calculationStatus,
  };
}