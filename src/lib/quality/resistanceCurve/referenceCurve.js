// Curva 1 — REFERÊNCIA HISTÓRICA (faixa por idade, normalizada em 28 dias).
// Percentuais de ENGENHARIA/ referência histórica geral — NÃO são requisitos
// normativos e NÃO devem ser usados para aprovação/reprovação de produtos.
// Configurável aqui em fonte única.
import { round2 } from './stats';

export const REFERENCE_BANDS = {
  1: [20, 30],
  3: [40, 50],
  7: [60, 70],
  14: [80, 90],
  21: [90, 98],
  28: [100, 100],
  56: [105, 115],
  90: [110, 120],
};

// R28 NUNCA é inventado. Prioridade:
// 1. resistência de referência configurada no produto (fck de projeto);
// 2. média histórica dos resultados de 28 dias;
// 3. resultado real de 28 dias disponível;
// sem nenhum → referência exibida apenas em percentual.
export function resolveR28({ productTarget, historical28, actual28 }) {
  if (productTarget > 0) return { value: productTarget, source: 'product_target' };
  if (historical28 > 0) return { value: historical28, source: 'historical_28' };
  if (actual28 > 0) return { value: actual28, source: 'actual_28' };
  return { value: null, source: null };
}

// Pontos da referência: limite inferior, central e superior por idade.
// Com R28 conhecido, também em MPa; sem R28, apenas percentuais (nunca inventar).
export function buildReferenceCurve(r28) {
  return Object.entries(REFERENCE_BANDS)
    .map(([age, [lo, hi]]) => {
      const p = {
        age_days: Number(age),
        lower_pct: lo,
        center_pct: lo === hi ? lo : +(((lo + hi) / 2)).toFixed(1),
        upper_pct: hi,
      };
      if (r28 && r28.value > 0) {
        p.lower = round2((r28.value * lo) / 100);
        p.center = round2((r28.value * p.center_pct) / 100);
        p.upper = round2((r28.value * hi) / 100);
      }
      return p;
    })
    .sort((a, b) => a.age_days - b.age_days);
}