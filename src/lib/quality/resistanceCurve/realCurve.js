// Curva 2 — REAL CIMENTOPRO: estatística histórica dos laudos por idade.
// Representa exatamente o que foi medido — SEM suavização, SEM ajuste para
// encaixar na referência, SEM substituição por valores estimados.
import { mean, median, stdDev, round2 } from './stats';

export function realCurve(results) {
  const byAge = {};
  (results || []).forEach((r) => {
    (byAge[r.age_days] = byAge[r.age_days] || []).push(r);
  });
  return Object.entries(byAge)
    .map(([age, group]) => {
      const vals = group.map((g) => g.value);
      const sd = stdDev(vals);
      const avg = mean(vals);
      return {
        age_days: Number(age),
        count: vals.length,
        lots: new Set(group.map((g) => g.lot_key)).size,
        average: round2(avg),
        median: round2(median(vals)),
        min: round2(Math.min(...vals)),
        max: round2(Math.max(...vals)),
        sd: round2(sd),
        cv: avg > 0 ? +((sd / avg) * 100).toFixed(1) : null,
        outlier_count: group.filter((g) => g.outlier).length,
      };
    })
    .sort((a, b) => a.age_days - b.age_days);
}