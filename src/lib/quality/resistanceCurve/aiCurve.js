// Curva 3 — PROJEÇÃO IA (motor determinístico híbrido).
// Os valores NÃO são codificados: vêm das relações históricas entre idades
// dos lotes da própria empresa (R28/R7, R14/R7, R28/R14, R56/R28...) e de um
// modelo saturante quando o histórico é robusto. A IA (InvokeLLM) atua apenas
// como camada interpretativa — nunca gera os números.
// Comportamento físico respeitado: ganho maior nas primeiras idades,
// desaceleração progressiva, sem crescimento indefinido.
import { median, quantile, stdDev, round2 } from './stats';
import { REFERENCE_BANDS } from './referenceCurve';

export const STANDARD_AGES = [1, 3, 7, 14, 21, 28, 56, 90];

// Relações Rb/Ra dentro do MESMO lote (comparação tecnicamente válida).
export function ageRatios(results) {
  const byLot = {};
  (results || []).forEach((r) => {
    (byLot[r.lot_key] = byLot[r.lot_key] || []).push(r);
  });
  const pairs = {};
  Object.values(byLot).forEach((lot) => {
    lot.forEach((a) =>
      lot.forEach((b) => {
        if (b.age_days > a.age_days && a.value > 0 && b.value > 0) {
          const k = `${a.age_days}>${b.age_days}`;
          (pairs[k] = pairs[k] || { from: a.age_days, to: b.age_days, values: [] }).values.push(
            b.value / a.value
          );
        }
      })
    );
  });
  return Object.values(pairs)
    .map((p) => ({
      from: p.from,
      to: p.to,
      n: p.values.length,
      median: median(p.values),
      q1: quantile(p.values, 0.25),
      q3: quantile(p.values, 0.75),
    }))
    .filter((p) => p.median != null);
}

// Projeta a idade-alvo a partir das idades observadas, buscando no grafo de
// relações entre idades (cadeias de até 3 ligações, ex.: 7→28, 7→14→28, 28→56→90).
function projectAgeFromRatios(targetAge, observedPoints, ratios) {
  const edges = {};
  ratios.forEach((r) => {
    (edges[r.from] = edges[r.from] || []).push(r);
  });
  const queue = observedPoints.map((o) => ({ age: o.age_days, path: [] }));
  const visited = new Set(queue.map((q) => q.age));
  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur.path.length >= 3) continue;
    for (const r of edges[cur.age] || []) {
      if (visited.has(r.to)) continue;
      const path = [...cur.path, r];
      if (r.to === targetAge) {
        const anchor = observedPoints.find((o) => o.age_days === cur.age);
        const value = path.reduce((v, step) => v * step.median, anchor.average);
        return {
          value,
          lower: path.reduce((v, step) => v * step.q1, anchor.average),
          upper: path.reduce((v, step) => v * step.q3, anchor.average),
          label: `relação ${path.map((s) => `${s.from}→${s.to}`).join('→')}d`,
          n: Math.min(...path.map((s) => s.n)),
        };
      }
      visited.add(r.to);
      queue.push({ age: r.to, path });
    }
  }
  return null;
}

// Fallback POR IDADE (dados limitados): escala a referência histórica pela
// âncora real mais madura — sempre rotulado, nunca apresentado como previsão forte.
function fallbackFromReference(age, anchorPoint) {
  if (!anchorPoint || anchorPoint.average <= 0) return null;
  const pctTarget = REFERENCE_BANDS[age];
  const pctAnchor = REFERENCE_BANDS[anchorPoint.age_days];
  if (!pctTarget || !pctAnchor) return null;
  const scale = anchorPoint.average / ((pctAnchor[0] + pctAnchor[1]) / 2);
  return {
    value: (scale * (pctTarget[0] + pctTarget[1])) / 2,
    lower: scale * pctTarget[0],
    upper: scale * pctTarget[1],
    label: 'escala da referência (dados limitados)',
    n: anchorPoint.count,
  };
}

// Modelo saturante R(t) = k·t/(a+t) — ajuste por grade sobre `a` e k fechado.
// Usado no NÍVEL 3 (histórico robusto). Cresce desacelerando e satura em k.
export function hyperbolicFit(points) {
  if (!points || points.length < 4) return null;
  let best = null;
  for (let a = 0.5; a <= 120; a += 0.5) {
    let num = 0;
    let den = 0;
    points.forEach((p) => {
      const w = p.age_days / (a + p.age_days);
      num += p.value * w;
      den += w * w;
    });
    if (den <= 0) continue;
    const k = num / den;
    const sse = points.reduce((s, p) => {
      const f = (k * p.age_days) / (a + p.age_days);
      return s + Math.pow(p.value - f, 2);
    }, 0);
    if (!best || sse < best.sse) best = { a, k, sse };
  }
  if (!best) return null;
  const residuals = points.map((p) => p.value - (best.k * p.age_days) / (best.a + p.age_days));
  return {
    a: best.a,
    k: best.k,
    resid_sd: stdDev(residuals),
    predict: (t) => (best.k * t) / (best.a + t),
  };
}

// Backtesting temporal: 75% dos lotes mais antigos = treino, demais = teste.
// Simula "se a IA tivesse previsto naquela época, quão próxima do real?"
export function backtestRatios(results) {
  if (!results || results.length === 0) return null;
  const lotDates = {};
  results.forEach((r) => {
    const d = r.date || '';
    if (!lotDates[r.lot_key] || d > lotDates[r.lot_key]) lotDates[r.lot_key] = d;
  });
  const lots = Object.keys(lotDates).sort((x, y) => lotDates[x].localeCompare(lotDates[y]));
  if (lots.length < 6) return null;
  const cut = Math.max(1, Math.floor(lots.length * 0.75));
  const train = results.filter((r) => lots.indexOf(r.lot_key) < cut);
  const test = results.filter((r) => lots.indexOf(r.lot_key) >= cut);
  if (train.length < 4 || test.length < 2) return null;
  const trainRatios = ageRatios(train);
  const byLot = {};
  test.forEach((r) => (byLot[r.lot_key] = byLot[r.lot_key] || []).push(r));
  const errs = [];
  const pctErrs = [];
  const covered = [];
  Object.values(byLot).forEach((lot) => {
    lot.sort((a, b) => a.age_days - b.age_days);
    const first = lot[0];
    // âncora = valor real do próprio lote na primeira idade (cenário prático)
    lot.slice(1).forEach((r) => {
      const proj = projectAgeFromRatios(r.age_days, [{ age_days: first.age_days, average: first.value }], trainRatios);
      if (!proj) return;
      errs.push(r.value - proj.value);
      pctErrs.push(proj.value > 0 ? ((r.value - proj.value) / proj.value) * 100 : null);
      covered.push(proj.lower != null ? r.value >= proj.lower && r.value <= proj.upper : null);
    });
  });
  return metrics('ratios', errs, pctErrs, covered);
}

export function backtestFit(results) {
  if (!results || results.length === 0) return null;
  const lotDates = {};
  results.forEach((r) => {
    const d = r.date || '';
    if (!lotDates[r.lot_key] || d > lotDates[r.lot_key]) lotDates[r.lot_key] = d;
  });
  const lots = Object.keys(lotDates).sort((x, y) => lotDates[x].localeCompare(lotDates[y]));
  if (lots.length < 6) return null;
  const cut = Math.max(1, Math.floor(lots.length * 0.75));
  const train = results.filter((r) => lots.indexOf(r.lot_key) < cut);
  const test = results.filter((r) => lots.indexOf(r.lot_key) >= cut);
  if (train.length < 4 || test.length < 2) return null;
  const fit = hyperbolicFit(train.map((r) => ({ age_days: r.age_days, value: r.value })));
  if (!fit) return null;
  const errs = [];
  const pctErrs = [];
  const covered = [];
  test.forEach((r) => {
    const pred = fit.predict(r.age_days);
    errs.push(r.value - pred);
    pctErrs.push(pred > 0 ? ((r.value - pred) / pred) * 100 : null);
    covered.push(fit.resid_sd != null ? Math.abs(r.value - pred) <= 1.96 * fit.resid_sd : null);
  });
  return metrics('curve_fit', errs, pctErrs, covered);
}

function metrics(method, errs, pctErrs, covered) {
  const n = errs.length;
  if (n === 0) return null;
  const abs = errs.map((e) => Math.abs(e));
  const mae = abs.reduce((a, b) => a + b, 0) / n;
  const rmse = Math.sqrt(errs.reduce((s, e) => s + e * e, 0) / n);
  const pe = pctErrs.filter((v) => v != null);
  const coverageVals = covered.filter((v) => v != null);
  return {
    method,
    n,
    mae: round2(mae),
    rmse: round2(rmse),
    mape: pe.length ? round2(pe.reduce((a, b) => a + b, 0) / pe.length) : null,
    bias: round2(errs.reduce((a, b) => a + b, 0) / n),
    coverage_pct: coverageVals.length
      ? Math.round((coverageVals.filter(Boolean).length / coverageVals.length) * 100)
      : null,
  };
}

// Constrói a curva IA para as idades padrão SEM dados reais (até 90 dias).
export function buildAiCurve(results, realPoints) {
  const observed = realPoints || [];
  if (observed.length === 0) {
    return { available: false, mode: null, method: null, points: [], ratios: [], backtest: null, note: 'Sem resultados reais para projetar.' };
  }
  const ratios = ageRatios(results || []);
  const btRatios = backtestRatios(results || []);
  const btFit = backtestFit(results || []);
  // Seleção de método por validação retrospectiva (quando houver dados):
  // menor erro percentual médio absoluto vence; sem backtest suficiente,
  // usa relações entre idades; sem relações, fallback na referência (confiança baixa).
  let method = 'ratios';
  if (btRatios && btFit && btRatios.n >= 5 && btFit.n >= 5) {
    method = (btFit.mape ?? Infinity) < (btRatios.mape ?? Infinity) ? 'curve_fit' : 'ratios';
  } else if (ratios.length === 0) {
    method = 'reference_fallback';
  }
  const chosenBt = method === 'curve_fit' ? btFit : btRatios || btFit;

  const fit = method === 'curve_fit' ? hyperbolicFit((results || []).map((r) => ({ age_days: r.age_days, value: r.value }))) : null;
  const maxRealAge = Math.max(...observed.map((o) => o.age_days));
  const projAges = STANDARD_AGES.filter(
    (age) => !observed.some((o) => o.age_days === age) && age <= 90
  );
  const points = [];
  let usedFallback = false;
  projAges.forEach((age) => {
    let proj = null;
    if (method === 'curve_fit' && fit) {
      const value = fit.predict(age);
      proj = {
        value,
        lower: value - 1.96 * fit.resid_sd,
        upper: value + 1.96 * fit.resid_sd,
        label: 'modelo saturante ajustado',
        n: (results || []).length,
      };
    } else {
      proj = projectAgeFromRatios(age, observed, ratios);
      if (!proj) {
        proj = fallbackFromReference(age, observed[observed.length - 1]);
        if (proj) usedFallback = true;
      }
    }
    if (proj && proj.value > 0) {
      points.push({
        age_days: age,
        value: round2(proj.value),
        lower: proj.lower != null ? round2(Math.max(0, proj.lower)) : null,
        upper: proj.upper != null ? round2(proj.upper) : null,
        method_label: proj.label,
        n: proj.n,
      });
    }
  });
  return {
    available: points.length > 0,
    mode: method === 'reference_fallback' ? 'fallback' : 'historico',
    method,
    points,
    ratios,
    backtest: chosenBt,
    note:
      method === 'reference_fallback' || usedFallback
        ? 'Parte da projeção usa escala da referência histórica (dados limitados) — confiança baixa. Novos ensaios ampliarão a base.'
        : null,
  };
}