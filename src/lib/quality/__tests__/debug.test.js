import { it, expect } from 'vitest';
import { buildResistanceCurve, buildChartSeries } from '../resistanceCurveEngine';
import { normalizeResults } from '../resistanceCurve/dataNormalizer';

const productTypesById = { p1: { id: 'p1', name: 'Bloco 14x19x39', concrete_trace_id: 't1' } };
function report(id, productId, specimens, extra = {}) {
  return { id, report_number: `L-${id}`, product_type_id: productId, test_date: extra.test_date || '2025-01-10', specimens, ...extra };
}

it('debug', () => {
  const reports = [
    report('G1', 'p1', [{ age_days: 7, resistance_mpa: 5 }, { age_days: 28, resistance_mpa: 7 }]),
    report('G2', 'p1', [{ age_days: 7, resistance_mpa: 5.2 }, { age_days: 28, resistance_mpa: 7.1 }]),
    report('G3', 'p1', [{ age_days: 7, resistance_mpa: 4.9 }, { age_days: 28, resistance_mpa: 6.8 }]),
  ];
  const c = buildResistanceCurve({ product_id: 'p1', trace_id: 't1', product_target: 6.3, reports, productTypesById });
  const series = buildChartSeries(c);
  const s90 = series.find((s) => s.age_days === 90);
  console.log('AI POINTS', JSON.stringify(c.ai.points));
  console.log('S90', JSON.stringify(s90));
  console.log('RATIOS', JSON.stringify(c.ai.ratios));
  expect(true).toBe(true);
});