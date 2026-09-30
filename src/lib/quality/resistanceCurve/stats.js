// Estatísticas básicas do motor de curva de resistência.
// Funções puras — sem dependência de SDK (testáveis isoladamente).

export function median(values) {
  if (!values || values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

export function quantile(values, q) {
  if (!values || values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (s[base + 1] !== undefined) return s[base] + rest * (s[base + 1] - s[base]);
  return s[base];
}

export function mean(values) {
  if (!values || values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function stdDev(values) {
  if (!values || values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((s, v) => s + Math.pow(v - m, 2), 0) / (values.length - 1));
}

export function round2(v) {
  if (v == null || Number.isNaN(v)) return null;
  return +Number(v).toFixed(2);
}