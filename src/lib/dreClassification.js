// ─────────────────────────────────────────────────────────────────────────────
// PROPOSTA DE CLASSIFICAÇÃO DE CUSTEIO — contas da DRE → motor v2.0
//
// Gera, para cada conta da estrutura da DRE sem classificação, uma sugestão de
// componente de custo + base de rateio a partir do NOME da conta. A proposta é
// apresentada ao usuário para revisão/edição antes de ser aplicada — nunca é
// gravada automaticamente no banco.
//
// Convenções do motor v2.0:
//   • Energia da DRE → marcada "já incluída na energia operacional das linhas"
//     (kW × h × tarifa) — não soma novamente.
//   • Matéria-prima da DRE → marcada "já incluída no custo operacional"
//     (traço/produção) — não soma novamente.
//   • Contas de Receita → sem classificação (nunca entram no custo).
//   • rate_basis 'none' → a conta não entra no custo industrial.
// ─────────────────────────────────────────────────────────────────────────────

// Normaliza para REGRA de classificação: minúsculas, sem acentos, sem os
// marcadores de subtotal herdados da planilha ("--", "=-", "( + )").
const ruleNorm = (s) =>
  String(s || '')
    .trim()
    .toLowerCase()
    .replace(/^[=\-—\s()+.]+/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

const LABOR = { cost_component_type: 'direct_labor', rate_basis: 'machine_hours', include_in_product_cost: true };
const MAINT = { cost_component_type: 'maintenance', rate_basis: 'machine_hours', include_in_product_cost: true };
const DEPRE = { cost_component_type: 'depreciation', rate_basis: 'machine_hours', include_in_product_cost: true };
const OVERHEAD = { cost_component_type: 'factory_overhead', rate_basis: 'machine_hours', include_in_product_cost: true };
const OUT = (type) => ({ cost_component_type: type, rate_basis: 'none', include_in_product_cost: false });

// Regras ordenadas — a primeira que casa com o nome define a proposta.
// k = palavras-chave (contém) · x = nome normalizado exato
const RULES = [
  // Energia: mantém o cálculo operacional das linhas (decisão do usuário)
  { k: ['energia eletrica'], p: { cost_component_type: 'energy', rate_basis: 'none', include_in_product_cost: false, already_included_in_energy: true } },
  // Matéria-prima: já calculada pelo traço/consumo das ordens
  { k: ['custos de materia prima e insumos'], p: { cost_component_type: 'material_direct', rate_basis: 'none', include_in_product_cost: false, already_included_in_direct_material: true } },
  { k: ['custos das mercadorias vendidas'], p: { cost_component_type: 'material_direct', rate_basis: 'none', include_in_product_cost: false, already_included_in_direct_material: true }, revisar: true },
  // Formas e moldes: já coberto pelo custo do molde por peça (mold_cost_per_unit)
  { k: ['formas e moldes'], p: { cost_component_type: 'mold', rate_basis: 'none', include_in_product_cost: false }, revisar: true },
  // Mão de obra direta — sugestões de menor certeza primeiro
  { k: ['adiantamento salarial', 'processo trabalhista', 'copa e cozinha', 'servicos de terceiros (pf)'], p: LABOR, revisar: true },
  { k: ['combustiveis', 'servicos de terceiros (pj)'], p: MAINT, revisar: true },
  { k: ['compra de m', 'moveis e utens', 'caminhoes e veiculos'], p: DEPRE, revisar: true },
  // Mão de obra direta (folha e encargos)
  { k: ['salario', 'ferias', 'rescis', 'fgts', 'inss', 'vale transporte', 'alimentacao', 'cesta basica', 'uniformes', 'cursos e treinamentos', 'exames admissionais', 'premiacao', 'medicamentos', 'confraterniza', 'contribuicao sindical'], p: LABOR },
  // Manutenção
  { k: ['manutencao', 'conservacao'], p: MAINT },
  // Tributos — fora do custo industrial (entram como % no preço de venda)
  { k: ['simples nacional', 'retencao csrf', 'irrf folha', 'ipva'], x: ['iss'], p: OUT('tax') },
  // Comercial e financeiro — fora do custo industrial
  { k: ['comissoes'], p: OUT('commission') },
  { k: ['fretes'], p: OUT('freight') },
  { k: ['marketing', 'publicidade', 'propaganda', 'brindes', 'doacoes'], p: OUT('selling_expense') },
  { k: ['clientes'], p: OUT('financial'), revisar: true },
  { k: ['juros', 'tarifas', 'emprestimos', 'amortizacoes', 'spc serasa', 'rendimento aplica'], x: ['iof'], p: OUT('financial') },
  // Administrativo — fora do custo industrial
  { k: ['pro labore', 'assessoria contabil', 'assessoria informatica', 'material de escritorio', 'consultorias', 'viagem', 'correios', 'estacionamento', 'cartorio', 'taxas diversas', 'multas de tr', 'associacao e sindicatos'], p: OUT('other') },
  // Custos fixos industriais (rateio por horas de máquina)
  { k: ['aluguel', 'agua e esgoto', 'iptu', 'telefone', 'internet', 'seguros', 'limpeza', 'material de consumo', 'almoxarif', 'paletes'], p: OVERHEAD },
  { k: ['despesas variaveis gerais'], p: OVERHEAD, revisar: true },
];

const NULL_PROPOSAL = {
  cost_component_type: null,
  rate_basis: 'none',
  include_in_product_cost: false,
  already_included_in_energy: false,
  already_included_in_direct_material: false,
  revisar: true,
};

// Retorna a proposta de classificação para a conta:
//   null → conta de Receita (nunca entra no custo — sem classificação)
//   { cost_component_type: null, revisar: true } → sem sugestão (revisar manualmente)
export function proposeClassification(account) {
  if (!account) return NULL_PROPOSAL;
  if (String(account.category || '') === 'Receita') return null;
  const n = ruleNorm(account.name);
  for (const rule of RULES) {
    const exactOk = rule.x && rule.x.includes(n);
    const keyOk = rule.k && rule.k.some((key) => n.includes(key));
    if (exactOk || keyOk) return { ...rule.p, revisar: rule.revisar === true };
  }
  return { ...NULL_PROPOSAL };
}