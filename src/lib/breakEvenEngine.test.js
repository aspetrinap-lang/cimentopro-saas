// TESTE TEMPORÁRIO do motor de Ponto de Equilíbrio (validação do PRD §26).
import { describe, it, expect } from 'vitest';
import {
  buildBreakEvenAnalysis, calculateBreakEven, calculateContributionMargin,
  suggestBreakEvenClassification, cashEffectSuggestion,
} from '@/lib/breakEvenEngine';

const accounts = [
  { id: 'a-rec', name: 'Receitas Operacionais', break_even_classification: 'revenue', cash_effect: 'cash_in' },
  { id: 'a-tax', name: 'Impostos sobre Vendas', break_even_classification: 'variable', rate_basis: 'none' },
  { id: 'a-mat', name: 'Matéria-Prima', break_even_classification: 'variable', rate_basis: 'kg', already_included_in_direct_material: true },
  { id: 'a-mnt', name: 'Manutenção Fixa', break_even_classification: 'fixed_industrial' },
  { id: 'a-dep', name: 'Depreciação', break_even_classification: 'fixed_non_cash' },
  { id: 'a-ren', name: 'Aluguéis', break_even_classification: 'fixed_cash' },
  { id: 'a-jur', name: 'Juros Pagos', break_even_classification: 'financial_cash' },
  { id: 'a-cmb', name: 'Variação Cambial', break_even_classification: 'financial_non_cash' },
  { id: 'a-unc', name: 'Conta Diversa' }, // sem classificação (conta antiga)
];

const items1 = [
  { account_id: 'a-tax', account_name: 'Impostos sobre Vendas', actual_value: 20000, category: 'Custo Direto', apportionment_method: 'none' },
  { account_id: 'a-mat', account_name: 'Matéria-Prima', actual_value: 60000, category: 'Custo Direto', apportionment_method: 'volume' },
  { account_id: 'a-mnt', account_name: 'Manutenção Fixa', actual_value: 20000, category: 'Despesa Fixa', apportionment_method: 'machine_hours' },
  { account_id: 'a-dep', account_name: 'Depreciação', actual_value: 10000, category: 'Despesa Fixa', apportionment_method: 'machine_hours' },
  { account_id: 'a-ren', account_name: 'Aluguéis', actual_value: 30000, category: 'Despesa Fixa', apportionment_method: 'none' },
  { account_id: 'a-jur', account_name: 'Juros Pagos', actual_value: 5000, category: 'Despesa Financeira', apportionment_method: 'none' },
  { account_id: 'a-cmb', account_name: 'Variação Cambial', actual_value: 1000, category: 'Despesa Financeira', apportionment_method: 'none' },
  { account_id: 'a-unc', account_name: 'Conta Diversa', actual_value: 2000, category: 'Despesa Fixa', apportionment_method: 'none' },
];

const dre1 = {
  id: 'd1', reference_month: '2025-01', month_label: 'Janeiro/2025',
  faturamento_actual: 200000, items: items1,
};
const dre2 = {
  id: 'd2', reference_month: '2025-02', month_label: 'Fevereiro/2025',
  faturamento_actual: 220000,
  items: items1.map((it) => ({ ...it, actual_value: it.actual_value * 1.1 })),
};

const productTypes = [
  { id: 'p1', name: 'Bloco 14', unit: 'un', weight_kg_per_unit: 10, selling_price: 5, cement_per_unit: 2 },
  { id: 'p2', name: 'Paver', unit: 'un', weight_kg_per_unit: 20, selling_price: 8, cement_per_unit: 4 },
];
const orders = [
  { product_type_id: 'p1', production_date: '2025-01-10', actual_quantity: 1000, production_minutes: 600, status: 'Concluída' },
  { product_type_id: 'p2', production_date: '2025-01-15', actual_quantity: 500, production_minutes: 300, status: 'Concluída' },
];

const base = { dres: [dre1, dre2], orders, productTypes, lines: [], accounts, insumoCosts: { cement: 0.5 } };

function assertFinite(obj, path = 'root') {
  if (typeof obj === 'number') {
    if (!Number.isFinite(obj)) throw new Error(`Valor não finito em ${path}: ${obj}`);
  } else if (obj && typeof obj === 'object') {
    for (const k of Object.keys(obj)) assertFinite(obj[k], `${path}.${k}`);
  }
}

describe('breakEvenEngine', () => {
  it('TESTE 1: MC positiva — PE = Custos Fixos / MC%', () => {
    const r = buildBreakEvenAnalysis({ ...base, financialPeriod: 'selected_month', selectedMonth: '2025-01' });
    expect(r.calculationStatus).toBe('ok');
    expect(r.revenue.current).toBe(200000);
    expect(r.variableCosts.total).toBe(80000);
    expect(r.contributionMargin.percent).toBeCloseTo(0.6, 10);
    expect(r.industrial.breakEvenRevenue).toBeCloseTo(20000 / 0.6, 4); // 33.333,33
    expect(r.cash.breakEvenRevenue).toBeCloseTo(30000 / 0.6, 4); // 50.000
    expect(r.financial.breakEvenRevenue).toBeCloseTo(35000 / 0.6, 4); // 58.333,33
    expect(r.operatingResults.industrial).toBe(100000);
    expect(r.operatingResults.cash).toBe(90000);
    expect(r.operatingResults.financial).toBe(85000);
    assertFinite(r);
  });

  it('TESTES 2/3/24: MC zero e negativa — PE não calculável', () => {
    const zero = { account_id: 'a-tax', account_name: 'Impostos sobre Vendas', actual_value: 200000, category: 'Custo Direto', apportionment_method: 'none' };
    const r0 = buildBreakEvenAnalysis({
      ...base, dres: [{ ...dre1, items: [zero] }], orders: [], productTypes: [],
      financialPeriod: 'selected_month', selectedMonth: '2025-01',
    });
    expect(r0.industrial.breakEvenRevenue).toBeNull();
    expect(r0.calculationStatus).toBe('no_margin');
    expect(r0.warnings.some((w) => w.includes('Margem de Contribuição zero ou negativa'))).toBe(true);

    const neg = { ...zero, actual_value: 250000 };
    const r1 = buildBreakEvenAnalysis({
      ...base, dres: [{ ...dre1, items: [neg] }], orders: [], productTypes: [],
      financialPeriod: 'selected_month', selectedMonth: '2025-01',
    });
    expect(r1.industrial.breakEvenRevenue).toBeNull();
    expect(r1.calculationStatus).toBe('no_margin');
    assertFinite(r1);
  });

  it('TESTE 4: empresa sem DRE — não quebra, status/warning', () => {
    const r = buildBreakEvenAnalysis({ ...base, dres: [], orders, productTypes });
    expect(r.calculationStatus).toBe('insufficient');
    expect(r.industrial.breakEvenRevenue).toBeNull();
    expect(r.warnings.some((w) => w.includes('Dados insuficientes'))).toBe(true);
    assertFinite(r);
  });

  it('TESTE 4b: sem faturamento válido', () => {
    const r = buildBreakEvenAnalysis({
      ...base, dres: [{ ...dre1, faturamento_actual: 0, items: items1.filter((i) => i.account_id !== 'a-rec') }],
      financialPeriod: 'selected_month', selectedMonth: '2025-01',
    });
    expect(r.calculationStatus).toBe('no_revenue');
    expect(r.industrial.breakEvenRevenue).toBeNull();
    expect(r.warnings.some((w) => w.includes('Não existe faturamento válido'))).toBe(true);
  });

  it('TESTE 5: depreciação (não caixa) fora do PE de Caixa', () => {
    const r = buildBreakEvenAnalysis({ ...base, financialPeriod: 'selected_month', selectedMonth: '2025-01' });
    expect(r.fixedNonCashCosts).toBe(10000);
    expect(r.cash.fixedCosts).toBe(30000); // só aluguéis
  });

  it('TESTES 6/7: financial_cash só no PE Financeiro; non_cash fora', () => {
    const r = buildBreakEvenAnalysis({ ...base, financialPeriod: 'selected_month', selectedMonth: '2025-01' });
    expect(r.financialCashCosts).toBe(5000);
    expect(r.financialNonCashCosts).toBe(1000);
    // PE Caixa não inclui juros nem variação cambial
    expect(r.cash.breakEvenRevenue).toBeCloseTo(30000 / 0.6, 4);
    // PE Financeiro = (caixa + juros) / MC% — variação cambial de fora
    expect(r.financial.breakEvenRevenue).toBeCloseTo((30000 + 5000) / 0.6, 4);
  });

  it('TESTE 8: conta sem classificação gera warning e fica fora do cálculo', () => {
    const r = buildBreakEvenAnalysis({ ...base, financialPeriod: 'selected_month', selectedMonth: '2025-01' });
    expect(r.warnings.some((w) => w.includes('sem classificação para o Ponto de Equilíbrio'))).toBe(true);
    // Conta Diversa (2.000) não entrou em nenhum bucket de custo
    expect(r.fixedCashCosts).toBe(30000);
    expect(r.fixedIndustrialCosts).toBe(20000);
  });

  it('TESTES 9/10/11: múltiplos produtos, mix de produção com warning, mix de vendas sem warning', () => {
    const r = buildBreakEvenAnalysis({ ...base, financialPeriod: 'selected_month', selectedMonth: '2025-01' });
    expect(r.mix.source).toBe('production');
    expect(r.mix.products).toHaveLength(2);
    expect(r.mix.products[0].share).toBeCloseTo(1000 / 1500, 6);
    expect(r.warnings.some((w) => w.includes('mix de produção como aproximação'))).toBe(true);
    // Mix ponderado: MC% = Σ MC / Σ receita estimada
    // p1: MC/un = 5 − var; p2: MC/un = 8 − var — engine usa componentes do v2.2
    expect(r.mix.weightedPrice).toBeCloseTo(9000 / 1500, 6);

    const rs = buildBreakEvenAnalysis({ ...base, financialPeriod: 'selected_month', selectedMonth: '2025-01', salesByProduct: { p1: 800, p2: 200 } });
    expect(rs.mix.source).toBe('sales');
    expect(rs.warnings.some((w) => w.includes('mix de produção'))).toBe(false);
  });

  it('TESTE 12: produto sem produção no período não quebra o cálculo', () => {
    const r = buildBreakEvenAnalysis({
      ...base, orders: [], productTypes,
      financialPeriod: 'selected_month', selectedMonth: '2025-01',
    });
    expect(r.calculationStatus).toBe('ok');
    expect(r.mix.products).toHaveLength(0);
    expect(r.industrial.breakEvenUnits).toBeNull();
    expect(r.warnings.some((w) => w.includes('mix de produtos'))).toBe(true);
  });

  it('TESTES 13-17: períodos agregados usam consolidação Σ/Σ (ponderada)', () => {
    const r = buildBreakEvenAnalysis({ ...base, financialPeriod: 'all_history' });
    expect(r.period.dreCount).toBe(2);
    // Σ receita, Σ variáveis do período consolidado — nunca média de percentuais
    expect(r.revenue.current).toBe(420000);
    expect(r.variableCosts.total).toBe(168000); // 80.000 + 88.000 (×1,1)
    expect(r.contributionMargin.percent).toBeCloseTo(252000 / 420000, 10);
    expect(r.industrial.breakEvenRevenue).toBeCloseTo(38000 / (252000 / 420000), 4);
    // Evolução mensal: cada mês individual, nunca a média no lugar do histórico
    expect(r.monthlySeries).toHaveLength(2);
    expect(r.monthlySeries[0].industrial).toBeCloseTo(20000 / 0.6, 4);
    expect(r.monthlySeries[1].industrial).toBeCloseTo(22000 / 0.6, 4);

    for (const p of ['last_3', 'last_6', 'last_12']) {
      const rp = buildBreakEvenAnalysis({ ...base, financialPeriod: p });
      expect(rp.period.dreCount).toBe(2);
      expect(rp.revenue.current).toBe(420000);
      assertFinite(rp);
    }
  });

  it('TESTES 19-21: nenhum NaN/Infinity/divisão por zero em cenários extremos', () => {
    const cases = [
      { ...base, financialPeriod: 'selected_month', selectedMonth: 'inexistente' },
      { ...base, dres: [], orders: [], productTypes: [], accounts: [] },
    ];
    for (const c of cases) assertFinite(buildBreakEvenAnalysis(c));
    expect(calculateBreakEven(1000, 0)).toBeNull();
    expect(calculateBreakEven(1000, null)).toBeNull();
    expect(calculateBreakEven(1000, -0.5)).toBeNull();
    expect(calculateContributionMargin(0, 500).percent).toBeNull();
  });

  it('TESTE 22: matéria-prima já incluída no custo operacional não é rateada por unidade (anti-dupla-contagem)', () => {
    const r = buildBreakEvenAnalysis({ ...base, financialPeriod: 'selected_month', selectedMonth: '2025-01' });
    // Matéria-Prima (60.000, already_included) está na MC da empresa, mas NÃO no custo variável unitário
    for (const p of r.mix.products) {
      expect(p.variableDre).toBe(0); // Impostos tem rate_basis none; Matéria já incluída — nada rateado
    }
    // O componente operacional veio do motor v2.2 (matéria estimada do cadastro)
    expect(r.mix.products[0].variableOperational).toBeGreaterThan(0);
    expect(r.costingEngineVersion).toBe('2.2');
  });

  it('Sugestões automáticas (default editável)', () => {
    expect(suggestBreakEvenClassification('depreciation')).toBe('fixed_non_cash');
    expect(suggestBreakEvenClassification('financial')).toBe('financial_cash');
    expect(suggestBreakEvenClassification('tax')).toBe('variable');
    expect(suggestBreakEvenClassification('other')).toBe('excluded');
    expect(suggestBreakEvenClassification(null)).toBe('excluded');
    expect(cashEffectSuggestion('fixed_non_cash')).toBe('non_cash');
    expect(cashEffectSuggestion('revenue')).toBe('cash_in');
  });

  it('Margem de segurança (base: PE Financeiro)', () => {
    const r = buildBreakEvenAnalysis({ ...base, financialPeriod: 'selected_month', selectedMonth: '2025-01' });
    expect(r.safetyMargin.breakEven).toBeCloseTo(35000 / 0.6, 4);
    expect(r.safetyMargin.value).toBeCloseTo(200000 - 35000 / 0.6, 4);
    expect(r.safetyMargin.percent).toBeCloseTo(((200000 - 35000 / 0.6) / 200000) * 100, 4);
  });
});