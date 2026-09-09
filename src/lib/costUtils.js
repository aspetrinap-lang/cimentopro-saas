// Funções compartilhadas de cálculo de custos — usadas por CostAnalysis e PricingSimulator.
import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';

// Peso por unidade de venda (kg) — normaliza produtos vendidos em un/m²/m
// un: peso por peça; m²/m: peças por metro × peso por peça
export function weightPerSaleUnit(pt) {
  if (!pt) return 0;
  const w = Number(pt.volume_per_unit_m3) || 0; // peso por peça (kg)
  const unit = String(pt.unit || 'un').toLowerCase();
  if (unit === 'un') return w;
  const ppm = Number(pt.pieces_per_m) || 0;
  return ppm > 0 ? ppm * w : w;
}

// Campos de materiais reais lançados na ordem (kg) — água em L ≈ kg
export const REAL_WEIGHT_FIELDS = [
  'actual_cement', 'actual_sand_artificial', 'actual_sand_medium',
  'actual_sand_fine', 'actual_gravel', 'actual_additive', 'actual_pigment', 'actual_water',
];

// Peso real total consumido numa ordem (kg)
export function orderRealWeightKg(o) {
  if (!o) return 0;
  return REAL_WEIGHT_FIELDS.reduce((s, f) => s + (Number(o[f]) || 0), 0);
}

// Tem lançamento real de materiais na ordem?
export function orderHasRealWeight(o) {
  return REAL_WEIGHT_FIELDS.some((f) => o[f] != null && Number(o[f]) > 0);
}

export function unitLabel(pt) {
  const u = String(pt?.unit || 'un').toLowerCase();
  if (u === 'm2') return 'm²';
  if (u === 'm') return 'm';
  return 'un';
}

// Fator de conversão de custo por peça → custo por unidade de venda
// un → 1; m²/m → pieces_per_m
export function saleFactor(pt) {
  const ppm = Number(pt?.pieces_per_m) || 0;
  return String(pt?.unit || 'un').toLowerCase() !== 'un' && ppm > 0 ? ppm : 1;
}

// Custo direto de matérias-primas por unidade de venda (R$) — usa custos de insumos
export function directMaterialCostPerUnit(pt, insumoCosts) {
  if (!pt) return 0;
  return INSUMO_KEYS.reduce((s, key) => {
    const { pt_field } = INSUMO_FIELDS[key];
    const qty = Number(pt[pt_field]) || 0;
    const cost = Number(insumoCosts?.[key]) || 0;
    return s + qty * cost;
  }, 0);
}

// Custo total de produção por unidade de venda (R$) — direto + indireto
// Reusa a mesma fórmula do CostAnalysis para garantir consistência.
export function totalProductionCostPerUnit(pt, { insumoCosts, avgEnergyPerKg, costPerKg, costPerMachineHour, hoursPerUnit }) {
  if (!pt) return 0;
  const sf = saleFactor(pt);
  const wu = weightPerSaleUnit(pt);
  const direct = (directMaterialCostPerUnit(pt, insumoCosts) + (Number(pt.mold_cost_per_unit) || 0)) * sf + (avgEnergyPerKg * wu);
  const volCost = costPerKg * wu;
  const hoursCost = costPerMachineHour * (hoursPerUnit || 0) * sf;
  return direct + volCost + hoursCost;
}

// Preço de venda sugerido (markup "por dentro") — considera imposto sobre o preço final.
// Preço = (Custo + Frete + Outros) ÷ (1 − Margem% − Comissão% − Imposto%)
// O imposto é aplicado sobre o preço final (base de cálculo), conforme legislação brasileira
// (Simples Nacional sobre faturamento ou carga efetiva de Lucro Real/Presumido).
export function calculateSuggestedPrice(baseCost, { commission, freight, other, margin, taxRate }) {
  const c = Number(commission) || 0;
  const f = Number(freight) || 0;
  const o = Number(other) || 0;
  const m = Number(margin) || 0;
  const t = Number(taxRate) || 0;
  const denom = 1 - m / 100 - c / 100 - t / 100;
  if (denom <= 0) return 0;
  return (Number(baseCost) + f + o) / denom;
}