// ─────────────────────────────────────────────────────────────────────────────
// BASE PRODUTIVA HISTÓRICA — Simulador de Preços (motor v2.2)
//
// Responsabilidade EXCLUSIVA pela produtividade histórica dos artefatos:
// horas de máquina por peça boa (Σ horas ÷ Σ quantidade boa), calculada sobre
// TODO o histórico de ordens de produção concluídas da empresa — nunca
// limitada pelo período financeiro selecionado nas DREs.
//
// Hierarquia de fallback — nunca inventa valores:
//   1. product      — histórico do próprio artefato
//   2. machine_line — média das máquinas em que o artefato foi produzido
//   3. category     — média histórica da categoria do artefato
//   4. line         — média histórica da(s) linha(s) de produção do artefato
//   5. factory      — média geral da fábrica
// Nenhum nível com dados: hoursPerGoodPiece = 0 + insufficient = true.
// ─────────────────────────────────────────────────────────────────────────────

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const PRODUCTIVITY_SOURCES = {
  product: 'Histórico do produto',
  machine_line: 'Média histórica da máquina/linha',
  category: 'Média histórica da categoria',
  line: 'Média histórica da linha de produção',
  factory: 'Média geral da fábrica',
};

const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function fmtMonthYear(ym) {
  if (!ym) return '—';
  const [y, m] = String(ym).split('-');
  const idx = Number(m) - 1;
  return MONTH_SHORT[idx] ? `${MONTH_SHORT[idx]}/${y}` : String(ym);
}

export function historyRangeLabel(from, to) {
  if (!from || !to) return '—';
  return `${fmtMonthYear(String(from).slice(0, 7))} a ${fmtMonthYear(String(to).slice(0, 7))}`;
}

function emptyAgg() {
  return { hours: 0, good: 0, gross: 0, orders: 0, from: null, to: null };
}

function addTo(agg, hours, good, gross, date) {
  agg.hours += hours;
  agg.good += good;
  agg.gross += gross;
  agg.orders += 1;
  if (date) {
    if (!agg.from || date < agg.from) agg.from = date;
    if (!agg.to || date > agg.to) agg.to = date;
  }
}

function combine(aggs) {
  const out = emptyAgg();
  for (const a of aggs) {
    if (!a) continue;
    out.hours += a.hours;
    out.good += a.good;
    out.gross += a.gross;
    out.orders += a.orders;
    if (a.from && (!out.from || a.from < out.from)) out.from = a.from;
    if (a.to && (!out.to || a.to > out.to)) out.to = a.to;
  }
  return out;
}

const valid = (agg) => agg && agg.hours > 0 && agg.good > 0;

// Agrega TODO o histórico de ordens e resolve, para cada artefato, a fonte de
// produtividade pela hierarquia de fallback. Sem arredondamento intermediário.
export function calculateHistoricalProductivity(orders = [], productTypes = [], lines = []) {
  const machineToLine = new Map();
  (lines || []).forEach((l) => (l.machines || []).forEach((m) => {
    if (m.machine_id) machineToLine.set(m.machine_id, l.id);
  }));
  const ptById = new Map((productTypes || []).map((p) => [p.id, p]));

  const product = new Map(); // ptId -> agg + máquinas/linhas usadas
  const machine = new Map();
  const line = new Map();
  const category = new Map();
  const factory = emptyAgg();

  for (const o of orders || []) {
    const ptId = o?.product_type_id;
    if (!ptId) continue;
    const pt = ptById.get(ptId);
    const hours = num(o.production_minutes) / 60;
    const gross = num(o.actual_quantity);
    const refugo = num(o.loss_second_line) + num(o.loss_discarded);
    const good = Math.max(gross - refugo, 0);
    const date = String(o.production_date || '');
    const lineId = o.production_line_id || machineToLine.get(o.machine_id) || null;

    let p = product.get(ptId);
    if (!p) {
      p = { ...emptyAgg(), machines: new Set(), lines: new Set(), lineHours: new Map() };
      product.set(ptId, p);
    }
    addTo(p, hours, good, gross, date);
    if (o.machine_id) {
      p.machines.add(o.machine_id);
      let m = machine.get(o.machine_id);
      if (!m) { m = emptyAgg(); machine.set(o.machine_id, m); }
      addTo(m, hours, good, gross, date);
    }
    if (lineId) {
      p.lines.add(lineId);
      p.lineHours.set(lineId, (p.lineHours.get(lineId) || 0) + hours);
      let l = line.get(lineId);
      if (!l) { l = emptyAgg(); line.set(lineId, l); }
      addTo(l, hours, good, gross, date);
    }
    if (pt?.category) {
      let c = category.get(pt.category);
      if (!c) { c = emptyAgg(); category.set(pt.category, c); }
      addTo(c, hours, good, gross, date);
    }
    addTo(factory, hours, good, gross, date);
  }

  const products = new Map();
  for (const pt of productTypes || []) {
    const own = product.get(pt.id) || null;
    // Hierarquia: produto → máquinas do produto → categoria → linhas do produto → fábrica
    const levels = [];
    if (own) levels.push({ source: 'product', agg: own });
    if (own && own.machines.size) {
      levels.push({ source: 'machine_line', agg: combine([...own.machines].map((id) => machine.get(id))) });
    }
    if (pt.category) levels.push({ source: 'category', agg: category.get(pt.category) });
    if (own && own.lines.size) {
      levels.push({ source: 'line', agg: combine([...own.lines].map((id) => line.get(id))) });
    }
    levels.push({ source: 'factory', agg: factory });

    const found = levels.find((l) => valid(l.agg));
    let dominantLineId = null;
    let bestHours = -1;
    if (own) {
      for (const [id, h] of own.lineHours) {
        if (h > bestHours) { bestHours = h; dominantLineId = id; }
      }
    }

    products.set(pt.id, {
      // Produtividade usada no cálculo (do nível resolvido)
      hoursPerGoodPiece: found ? found.agg.hours / found.agg.good : 0,
      source: found ? found.source : null,
      sourceLabel: found ? PRODUCTIVITY_SOURCES[found.source] : null,
      usedHours: found ? found.agg.hours : 0,
      usedGood: found ? found.agg.good : 0,
      from: found ? found.agg.from : null,
      to: found ? found.agg.to : null,
      insufficient: !found,
      // Totais do próprio artefato (histórico completo)
      gross: own ? own.gross : 0,
      good: own ? own.good : 0,
      refugo: own ? own.gross - own.good : 0,
      hours: own ? own.hours : 0,
      orders: own ? own.orders : 0,
      dominantLineId,
    });
  }

  return { products, factory };
}