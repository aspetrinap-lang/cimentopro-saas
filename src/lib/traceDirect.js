// ============================================================
// Conversão entre os modos de entrada do traço de concreto:
// - 'ratio'   → proporção (ex: 1/16) + peso total
// - 'direct'  → peso direto em kg por material
//
// A composição percentual (materials_composition) é a MESMA nos
// dois modos — agregados: % do peso de agregados (total − cimento);
// aditivos: % do cimento. O modo altera apenas o rótulo e as
// partes de compatibilidade. Assim, o restante do aplicativo
// (ordens, consumo, desvios, custos, relatórios) consome os
// mesmos campos sem conhecer input_mode.
// ============================================================

import { INSUMO_TRACE_PARTS } from '@/lib/insumos';

// Deriva os kg de cada material a partir dos percentuais salvos.
export function deriveDirectWeights(trace) {
  const comp = trace?.materials_composition || {};
  const total = Number(trace?.total_weight_kg) || 0;
  const cementKg = Number(trace?.cement_kg_per_m3) || 0;
  const aggBase = Math.max(0, total - cementKg);
  const weights = {};
  Object.entries(comp).forEach(([key, c]) => {
    const pct = Number(c?.percent) || 0;
    weights[key] = c?.type === 'additive' ? (cementKg * pct) / 100 : (aggBase * pct) / 100;
  });
  return { total, cementKg, weights };
}

// kg digitados → campos persistidos (modo direto).
export function directToTraceFields({ total, cementKg, entries }) {
  const cementN = Number(cementKg) || 0;
  const aggBase = Math.max(0, (Number(total) || 0) - cementN);
  const materials_composition = {};
  const materials_parts = {};
  let aggKg = 0;
  (entries || []).forEach(({ key, kg, type }) => {
    const kgN = Number(kg) || 0;
    if (type === 'additive') {
      materials_composition[key] = { percent: cementN > 0 ? (kgN / cementN) * 100 : 0, type: 'additive' };
    } else {
      aggKg += kgN;
      materials_composition[key] = { percent: aggBase > 0 ? (kgN / aggBase) * 100 : 0, type: 'aggregate' };
    }
    materials_parts[key] = cementN > 0 ? kgN / cementN : 0;
  });
  return {
    materials_composition,
    materials_parts,
    cement_parts: 1,
    aggregate_parts: cementN > 0 ? aggKg / cementN : 0,
  };
}

// Rótulo de proporção aproximado (ex: 1/16,25) a partir das partes de agregado.
export function formatRatioLabel(aggParts) {
  const n = Math.round((Number(aggParts) || 0) * 100) / 100;
  return `1/${String(n).replace('.', ',')}`;
}

// Payload de reconversão de modo (alternância admin): mantém a composição
// percentual, recalcula rótulo/partes e registra o histórico.
export function buildModeSwitchPayload(trace, toMode, userEmail) {
  const { cementKg, weights } = deriveDirectWeights(trace);
  const comp = trace.materials_composition || {};
  const aggKg = Object.keys(comp)
    .filter((k) => comp[k]?.type !== 'additive')
    .reduce((s, k) => s + (weights[k] || 0), 0);
  const aggParts = cementKg > 0 ? aggKg / cementKg : 0;

  const materials_parts = { ...(trace.materials_parts || {}) };
  materials_parts.cement = 1;
  if (toMode === 'direct') {
    Object.keys(comp).forEach((k) => {
      materials_parts[k] = cementKg > 0 ? (weights[k] || 0) / cementKg : 0;
    });
  }

  const compat = {};
  Object.entries(INSUMO_TRACE_PARTS).forEach(([key, field]) => {
    compat[field] = key === 'cement' ? 1 : Number(materials_parts[key]) || 0;
  });

  return {
    input_mode: toMode,
    ratio_label: toMode === 'direct' ? '' : formatRatioLabel(aggParts),
    cement_parts: 1,
    aggregate_parts: aggParts,
    materials_parts,
    ...compat,
    conversion_history: [
      ...(trace.conversion_history || []),
      {
        date: new Date().toISOString(),
        user_email: userEmail || '',
        from_mode: trace.input_mode || 'ratio',
        to_mode: toMode,
      },
    ],
  };
}