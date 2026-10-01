/**
 * Camada central de nomenclatura de resistência por família normativa do produto.
 *
 * ÚNICA fonte de mapeamento família → grandeza. Todos os consumidores (laudos,
 * relatórios, análise de qualidade, Engenheiro Virtual, cadastro) usam
 * getResistanceMetric() para obter o símbolo correto conforme a família:
 *
 *   CONCRETE_BLOCK (NBR 6136)  → fbk / fbk,est / fb
 *   PAVER          (NBR 9781)  → fpk / fpk,est / fp
 *   GENERIC        (demais)    → sem símbolo (apenas "Resistência característica")
 *
 * Resolução por prioridade: norma do laudo → categoria do produto.
 * Nenhum cálculo normativo é alterado — apenas a nomenclatura de exibição.
 */

export const RESISTANCE_FAMILIES = {
  CONCRETE_BLOCK: 'CONCRETE_BLOCK',
  PAVER: 'PAVER',
  GENERIC: 'GENERIC',
};

const METRICS = {
  CONCRETE_BLOCK: {
    family: 'CONCRETE_BLOCK',
    symbol: 'fbk',
    estimatedSymbol: 'fbk,est',
    individualSymbol: 'fb',
    label: 'Resistência característica à compressão axial',
    estimatedLabel: 'Resistência característica estimada à compressão axial',
    unit: 'MPa',
  },
  PAVER: {
    family: 'PAVER',
    symbol: 'fpk',
    estimatedSymbol: 'fpk,est',
    individualSymbol: 'fp',
    label: 'Resistência característica à compressão',
    estimatedLabel: 'Resistência característica estimada à compressão',
    unit: 'MPa',
  },
  GENERIC: {
    family: 'GENERIC',
    symbol: '',
    estimatedSymbol: '',
    individualSymbol: '',
    label: 'Resistência característica',
    estimatedLabel: 'Resistência característica estimada',
    unit: 'MPa',
  },
};

/**
 * Resolve a família normativa pela prioridade: norma do laudo → categoria do produto.
 * Espelha a lógica existente de inferNorm (qualityNorms), sem alterá-la.
 */
export function resolveFamily({ category, normReference } = {}) {
  const norm = (normReference || '').toUpperCase();
  if (norm.includes('9781')) return 'PAVER';
  if (norm.includes('6136')) return 'CONCRETE_BLOCK';
  const cat = (category || '').toLowerCase();
  if (cat.includes('pavimento') || cat.includes('meio fio') || cat.includes('meio-fio')) return 'PAVER';
  if (cat.includes('bloco')) return 'CONCRETE_BLOCK';
  return 'GENERIC';
}

/**
 * Retorna a grandeza normativa de resistência para a família do produto.
 * @param {{category?: string, normReference?: string}} input
 * @returns {{family: string, symbol: string, estimatedSymbol: string, individualSymbol: string, label: string, estimatedLabel: string, unit: string}}
 */
export function getResistanceMetric(input = {}) {
  const family = resolveFamily(input);
  return { ...METRICS[family] };
}

/** Símbolo curto da grandeza ("fbk", "fpk" ou "" para genéricos). */
export function resistanceSymbol(input = {}) {
  return getResistanceMetric(input).symbol;
}

/** Rótulo completo com símbolo entre parênteses (ou sem, para genéricos). */
export function resistanceLabelWithSymbol(input = {}) {
  const m = getResistanceMetric(input);
  return m.symbol ? `${m.label} (${m.symbol})` : m.label;
}

/** Rótulo da estimada com símbolo entre parênteses (ou sem, para genéricos). */
export function resistanceEstimatedLabelWithSymbol(input = {}) {
  const m = getResistanceMetric(input);
  return m.estimatedSymbol ? `${m.estimatedLabel} (${m.estimatedSymbol})` : m.estimatedLabel;
}