// ─────────────────────────────────────────────────────────────────────────────
// CLASSIFICAÇÃO GERENCIAL OFICIAL DO PONTO DE EQUILÍBRIO (v1.1) — FONTE FIXA.
//
// Este mapa é a única fonte oficial da classificação gerencial. A rotina de
// migração (dreManagement → apply_break_even_classification) aplica estas
// regras às contas DreAccount das empresas — de forma IDEMPOTENTE e sem nunca
// criar classificação nova por conta própria, reclassificar além do mapa ou
// alterar qualquer valor da DRE.
//
// Contas fora deste mapa mantêm a classificação atual (compatibilidade legada:
// fixed_industrial/fixed_cash são tratadas como fixed_operational pelo motor).
// Contas de SUBTOTAL da DRE nunca entram como contas individuais.
// ─────────────────────────────────────────────────────────────────────────────

// Normaliza: minúsculas, sem acentos, sem marcadores de subtotal herdados da
// planilha ("--", "=-", "=--", "( + )"), espaços colapsados.
export function normalizeAccountName(s: string): string {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/^[=\-—\s()+.]+/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export interface OfficialClassification {
  classification: 'revenue' | 'variable' | 'fixed_operational' | 'financial_cash';
  block: string;
  financial_role: string | null;
  break_even_role: 'revenue' | 'variable' | 'operational' | 'financial';
  enabled_for_pec: boolean;
  enabled_for_pef: boolean;
  enabled_for_pee: boolean;
}

const REV: OfficialClassification = {
  classification: 'revenue', block: 'revenue', financial_role: null, break_even_role: 'revenue',
  enabled_for_pec: false, enabled_for_pef: false, enabled_for_pee: false,
};
const DED: OfficialClassification = {
  classification: 'variable', block: 'revenue_deduction', financial_role: null, break_even_role: 'variable',
  enabled_for_pec: true, enabled_for_pef: true, enabled_for_pee: true,
};
const VARC: OfficialClassification = {
  classification: 'variable', block: 'variable_costs', financial_role: null, break_even_role: 'variable',
  enabled_for_pec: true, enabled_for_pef: true, enabled_for_pee: true,
};
const FIX = (block: 'factory' | 'personnel' | 'structure'): OfficialClassification => ({
  classification: 'fixed_operational', block, financial_role: null, break_even_role: 'operational',
  enabled_for_pec: true, enabled_for_pef: true, enabled_for_pee: true,
});
const FIN = (role: 'interest' | 'iof' | 'amortization'): OfficialClassification => ({
  classification: 'financial_cash', block: 'financial_obligations', financial_role: role, break_even_role: 'financial',
  enabled_for_pec: false, enabled_for_pef: true, enabled_for_pee: false,
});
const INV: OfficialClassification = {
  classification: 'financial_cash', block: 'investment', financial_role: 'investment', break_even_role: 'financial',
  enabled_for_pec: false, enabled_for_pef: false, enabled_for_pee: false,
};

export const OFFICIAL_CLASSIFICATION: Record<string, OfficialClassification> = {
  // ── 1. Faturamento Bruto (revenue) ──
  'receita de venda produtos': REV,
  'outras receitas - operacoes com cartoes': REV,
  'receitas operacionais': REV,

  // ── 2. Deduções da Receita (variable / revenue_deduction) ──
  'devolucoes de vendas': DED,
  'iss': DED,
  'simples nacional': DED,
  'pis / vendas': DED,
  'cofins / vendas': DED,
  'icms / vendas': DED,

  // ── 3. Custos Variáveis Puros (variable / variable_costs) ──
  'custos de materia prima e insumos': VARC,
  'revenda': VARC,
  'fretes': VARC,
  'comissoes': VARC,

  // ── 4.1 Gastos Fixos Operacionais — Fábrica ──
  'manutencao e conservacao de maquinas producao': FIX('factory'),
  'almoxarifafo': FIX('factory'),
  'almoxarifado': FIX('factory'),
  'formas e moldes': FIX('factory'),

  // ── 4.2 Gastos Fixos Operacionais — Pessoal / RH ──
  'pro labore': FIX('personnel'),
  'salarios': FIX('personnel'),
  'ferias': FIX('personnel'),
  'rescisao de contrato': FIX('personnel'),
  'uniformes/epis': FIX('personnel'),
  'fgts rescisorio': FIX('personnel'),
  'contribuicao sindical': FIX('personnel'),
  'vale transporte': FIX('personnel'),
  'alimentacao': FIX('personnel'),
  'inss': FIX('personnel'),
  'fgts': FIX('personnel'),
  'cursos e treinamentos': FIX('personnel'),
  'exames admissionais/periodicos e demissionais': FIX('personnel'),

  // ── 4.3 Gastos Fixos Operacionais — Estrutura e Administração ──
  'aluguel': FIX('structure'),
  'assessoria contabil': FIX('structure'),
  'assessoria marketing': FIX('structure'),
  'assessoria informatica': FIX('structure'),
  'associacao e sindicatos': FIX('structure'),
  'energia eletrica': FIX('structure'),
  'iptu': FIX('structure'),
  'telefones': FIX('structure'),
  'telefone celular': FIX('structure'),
  'servicos de limpeza': FIX('structure'),
  'internet': FIX('structure'),
  'taxas para consulta spc serasa': FIX('structure'),
  'taxas consulta spc serasa': FIX('structure'),
  'seguros': FIX('structure'),
  'propaganda e publicidade': FIX('structure'),
  'confraternizacao': FIX('structure'),
  'doacoes/brindes': FIX('structure'),
  'despesas variaveis gerais': FIX('structure'),
  'despesa manutencao predial': FIX('structure'),
  'combustiveis e lubrificantes': FIX('structure'),
  'despesas com estacionamento e pedagio': FIX('structure'),
  'despesas com cartorio': FIX('structure'),
  'despesas com manutencao veiculos': FIX('structure'),
  'material de escritorio': FIX('structure'),
  'material de limpeza': FIX('structure'),
  'medicamentos': FIX('structure'),
  'manutencao informatica': FIX('structure'),
  'ipva- dpvat - licenciamentos de veiculos': FIX('structure'),
  'despesas de viagem': FIX('structure'),
  'tarifas cartao de credito - debito': FIX('structure'),
  'taxas diversas': FIX('structure'),
  'multas de transito': FIX('structure'),

  // ── 5. Obrigações Não Operacionais de Caixa (financial_cash → PEF) ──
  'juros sobre emprestimos': FIN('interest'),
  'juros emprestimos': FIN('interest'),
  'juros empretimos': FIN('interest'),
  'iof': FIN('iof'),
  'emprestimos e financiamentos - amortizacoes': FIN('amortization'),

  // ── 5b. Investimentos (financial_cash, papel investment — FORA do PEF) ──
  'compra de maquinas e equipamentos': INV,
  'caminhoes e veiculos': INV,
};

// ── 11. Subtotais da DRE — NUNCA entram como contas individuais ──
export const SUBTOTAL_ACCOUNTS: string[] = [
  'receita operacional bruta',
  'receita operacional liquida',
  'custo de producao',
  'lucro bruto',
  'margem de contribuicao',
  'ebitda',
  'resultado financeiro',
  'lucro/prejuizo',
  'lucro ou prejuizo',
  'investimentos',
  'resultado financeiro apos investimentos',
  'resultado financeiro apos participacoes',
];

export function isSubtotalAccount(name: string): boolean {
  return SUBTOTAL_ACCOUNTS.includes(normalizeAccountName(name));
}

// Classificação oficial de uma conta: null = fora do mapa (mantém a atual).
export function getOfficialClassification(account: { name: string } | null | undefined): OfficialClassification | null {
  if (!account) return null;
  if (isSubtotalAccount(account.name)) return null;
  return OFFICIAL_CLASSIFICATION[normalizeAccountName(account.name)] || null;
}