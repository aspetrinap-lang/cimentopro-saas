import { INSUMO_KEYS, INSUMO_FIELDS, INSUMO_TRACE_PARTS } from '@/lib/insumos';

// Estatísticas descritivas de uma amostra (desvio padrão populacional)
export function computeStats(values) {
  const arr = (values || []).filter(v => v != null && isFinite(v));
  const N = arr.length;
  if (N === 0) return null;
  const mean = arr.reduce((a, b) => a + b, 0) / N;
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / N;
  const stdDev = Math.sqrt(variance);
  const cv = mean !== 0 ? (stdDev / mean) * 100 : 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const median = N % 2 === 0
    ? (sorted[N / 2 - 1] + sorted[N / 2]) / 2
    : sorted[Math.floor(N / 2)];
  return { mean, stdDev, variance, cv, min: sorted[0], max: sorted[N - 1], median, count: N };
}

// IEC (Índice de Estabilidade de Consumo) 0-100 baseado no CV médio
export function iecFromCV(avgCV) {
  if (avgCV == null || !isFinite(avgCV)) return null;
  let score;
  if (avgCV <= 2) score = 95 + ((2 - avgCV) / 2) * 5;
  else if (avgCV <= 5) score = 90 + ((5 - avgCV) / 3) * 5;
  else if (avgCV <= 10) score = 80 + ((10 - avgCV) / 5) * 10;
  else if (avgCV <= 15) score = 70 + ((15 - avgCV) / 5) * 10;
  else score = Math.max(0, 70 - (avgCV - 15) * 3);
  return Math.round(Math.min(100, Math.max(0, score)));
}

export function iecStatus(score) {
  if (score == null) return { label: 'Sem dados', color: 'text-muted-foreground', bg: 'bg-slate-400', emoji: '⚪' };
  if (score >= 95) return { label: 'Processo excelente', color: 'text-green-600', bg: 'bg-green-500', emoji: '🟢' };
  if (score >= 90) return { label: 'Processo estável', color: 'text-green-600', bg: 'bg-green-400', emoji: '🟢' };
  if (score >= 80) return { label: 'Atenção', color: 'text-amber-600', bg: 'bg-amber-500', emoji: '🟡' };
  if (score >= 70) return { label: 'Processo instável', color: 'text-orange-600', bg: 'bg-orange-500', emoji: '🟠' };
  return { label: 'Ação imediata', color: 'text-red-600', bg: 'bg-red-500', emoji: '🔴' };
}

// Classificação do desvio percentual vs meta (ficha técnica)
export function classifyDeviation(pct) {
  if (pct == null || !isFinite(pct)) return { status: '—', emoji: '⚪', cls: 'text-muted-foreground bg-muted' };
  if (pct <= 0) return { status: 'Dentro da meta', emoji: '🟢', cls: 'text-green-700 bg-green-50' };
  if (pct <= 2) return { status: 'Atenção', emoji: '🟡', cls: 'text-amber-700 bg-amber-50' };
  if (pct <= 5) return { status: 'Alerta', emoji: '🟠', cls: 'text-orange-700 bg-orange-50' };
  return { status: 'Crítico', emoji: '🔴', cls: 'text-red-700 bg-red-50' };
}

// Consumo teórico de uma matéria-prima por ordem, baseado no traço vinculado
export function theoreticalForOrder(o, key, ptMap, traceMap) {
  const pt = ptMap[o.product_type_id];
  if (!pt?.concrete_trace_id) return 0;
  const trace = traceMap[pt.concrete_trace_id];
  if (!trace) return 0;
  const tracesQty = o.actual_traces_produced || 0;
  if (!tracesQty) return 0;
  const cementKg = trace.cement_kg_per_m3 || 0;
  const cementParts = trace.cement_parts || 1;
  if (key === 'cement') return tracesQty * cementKg;
  const partField = INSUMO_TRACE_PARTS[key];
  if (!partField) return 0;
  const partVal = trace[partField] || 0;
  return cementKg ? tracesQty * cementKg * (partVal / cementParts) : 0;
}

export function fmtNum(v, dec = 2) {
  if (v == null || !isFinite(v)) return '—';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export function fmtBRL(v) {
  if (v == null || !isFinite(v)) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
}

// Custo unitário de produção de uma ordem (R$ por peça):
// soma o custo de insumos reais lançados ÷ peças produzidas.
// Sem conversão de unidade — actual_quantity é sempre peças.
export function orderUnitCost(o, costs) {
  const qty = Number(o.actual_quantity) || 0;
  if (qty <= 0) return 0;
  const orderCost = INSUMO_KEYS.reduce(
    (s, k) => s + ((Number(o[INSUMO_FIELDS[k].actual]) || 0) * (Number(costs?.[k]) || 0)),
    0
  );
  return orderCost / qty;
}

// Custo das peças perdidas de uma ordem: (2ª linha + descartadas) × custo unitário.
export function orderLostCost(o, costs) {
  const lost = (Number(o.loss_second_line) || 0) + (Number(o.loss_discarded) || 0);
  if (lost <= 0) return 0;
  return lost * orderUnitCost(o, costs);
}

// Custo do excesso de consumo de insumos (real acima do teórico do traço).
export function orderExcessCost(o, costs, ptMap, traceMap) {
  let excessCost = 0;
  INSUMO_KEYS.forEach((k) => {
    const real = Number(o[INSUMO_FIELDS[k].actual]) || 0;
    const theo = theoreticalForOrder(o, k, ptMap, traceMap);
    if (theo > 0 && real > theo) excessCost += (real - theo) * (Number(costs?.[k]) || 0);
  });
  return excessCost;
}