// Indicadores de produção — separação definitiva de conceitos:
// PLANEJADO x PRODUZIDO = desempenho (atingimento, déficit, excedente)
// CONSUMO TEÓRICO x CONSUMO REAL = desvio/perda de material
// PRODUZIDO x APROVADO = refugo

// Limiares de status (%) — constantes nomeadas, preparadas para configuração futura
export const PRODUCTION_THRESHOLDS = {
  EXCEDENTE_ACIMA: 105, // acima de 105% → Excedente de produção
  META_MIN: 95,         // de 95% até 105% → Meta atingida
  ABAIXO_MIN: 80,       // de 80% até 94,99% → Abaixo da meta; abaixo de 80% → Produção crítica
};

export const PRODUCTION_STATUS = {
  EXCEDENTE: { key: 'excedente', label: 'Excedente de produção', pill: 'bg-blue-100 text-blue-700', text: 'text-blue-600' },
  META: { key: 'meta', label: 'Meta atingida', pill: 'bg-green-100 text-green-700', text: 'text-green-600' },
  ABAIXO: { key: 'abaixo', label: 'Abaixo da meta', pill: 'bg-amber-100 text-amber-700', text: 'text-amber-600' },
  CRITICA: { key: 'critica', label: 'Produção crítica', pill: 'bg-red-100 text-red-700', text: 'text-red-600' },
};

// Desempenho da produção: atingimento da meta, déficit/excedente e status
export function productionMetrics(order) {
  const planned = Number(order?.planned_quantity) || 0;
  const produced = Number(order?.actual_quantity) || 0;
  if (planned <= 0) {
    return { planned, produced, achievementPct: null, deviation: null, status: null };
  }
  const achievementPct = (produced / planned) * 100;

  let status;
  if (achievementPct > PRODUCTION_THRESHOLDS.EXCEDENTE_ACIMA) status = PRODUCTION_STATUS.EXCEDENTE;
  else if (achievementPct >= PRODUCTION_THRESHOLDS.META_MIN) status = PRODUCTION_STATUS.META;
  else if (achievementPct >= PRODUCTION_THRESHOLDS.ABAIXO_MIN) status = PRODUCTION_STATUS.ABAIXO;
  else status = PRODUCTION_STATUS.CRITICA;

  const diff = produced - planned;
  const deviation = diff < 0
    ? { type: 'deficit', label: 'Déficit', value: Math.abs(diff) }
    : diff > 0
      ? { type: 'surplus', label: 'Excedente', value: diff }
      : { type: 'none', label: 'Desvio', value: 0 };

  return { planned, produced, achievementPct, deviation, status };
}

// Refugo: produzido - aprovado (aprovado = produzido - 2ª linha - descartadas)
export function scrapMetrics(order) {
  const produced = Number(order?.actual_quantity) || 0;
  const secondLine = Number(order?.loss_second_line) || 0;
  const discarded = Number(order?.loss_discarded) || 0;
  const refugo = secondLine + discarded;
  const approved = produced - refugo;
  const ratePct = produced > 0 ? (refugo / produced) * 100 : 0;
  return { produced, refugo, approved, ratePct };
}

// Desvio de consumo de um insumo: consumo teórico (produzido x insumo por unidade do
// artefato) vs consumo real. Perda de material (%) apenas sobre o consumo — nunca
// sobre planejado x produzido.
export function consumptionDeviation(order, productType, insumoFields) {
  const produced = Number(order?.actual_quantity) || 0;
  const perUnit = productType ? Number(productType[insumoFields.pt_field]) || 0 : 0;
  if (produced <= 0 || perUnit <= 0) return null;
  const actual = Number(order?.[insumoFields.actual]) || 0;
  if (!actual) return null;
  const theoretical = produced * perUnit;
  const deviation = actual - theoretical;
  const lossPct = theoretical > 0 ? (deviation / theoretical) * 100 : 0;
  return { theoretical, actual, deviation, lossPct };
}