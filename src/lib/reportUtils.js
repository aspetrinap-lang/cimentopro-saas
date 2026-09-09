import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';
import { consumptionDeviation } from '@/lib/productionMetrics';

export const inRange = (d, start, end) => !!d && d >= start && d <= end;

export const fmtDur = (min) => {
  const m = Math.round(Number(min) || 0);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}min`;
};

export const pctBR = (v, dec = 1) =>
  v == null || !isFinite(v) ? '—' : `${(Number(v)).toFixed(dec).replace('.', ',')}%`;

export const signedPct = (v, dec = 1) =>
  v == null || !isFinite(v) ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(dec).replace('.', ',')}%`;

// Desvio agregado de consumo por insumo no conjunto de ordens — mesmo critério
// da ficha técnica da ordem (teórico = produzido × consumo por unidade).
// Retorna { key, theoretical, actual, deviation, lossPct, count } por insumo.
export function avgDeviationByInsumo(orders, ptMap) {
  return INSUMO_KEYS.map((key) => {
    const acc = { key, theoretical: 0, actual: 0, count: 0, lossPct: null };
    orders.forEach((o) => {
      const dev = consumptionDeviation(o, ptMap[o.product_type_id], INSUMO_FIELDS[key]);
      if (!dev) return;
      acc.theoretical += dev.theoretical;
      acc.actual += dev.actual;
      acc.count += 1;
    });
    if (acc.count > 0 && acc.theoretical > 0) {
      acc.deviation = acc.actual - acc.theoretical;
      acc.lossPct = (acc.deviation / acc.theoretical) * 100;
    }
    return acc;
  });
}