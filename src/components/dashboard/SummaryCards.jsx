import { useState, useEffect, useMemo } from 'react';
import { Layers, TrendingDown, TrendingUp } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useInsumoNames } from '@/hooks/useInsumoNames';
import { useInsumoCosts } from '@/hooks/useInsumoCosts';
import { INSUMO_KEYS, INSUMO_FIELDS, INSUMO_TRACE_PARTS } from '@/lib/insumos';

function DeviationBadge({ deviation }) {
  if (deviation === null || deviation === undefined) return null;
  const isGain = deviation <= 0;
  const Icon = isGain ? TrendingDown : TrendingUp;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
      isGain ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
    }`}>
      <Icon className="w-3 h-3" />
      {isGain ? 'Ganho' : 'Perda'} {Math.abs(deviation).toFixed(1)}%
    </span>
  );
}

const CARD_COLORS = [
  'bg-blue-50 text-blue-600',
  'bg-amber-50 text-amber-600',
  'bg-orange-50 text-orange-600',
  'bg-yellow-50 text-yellow-600',
  'bg-slate-100 text-slate-600',
  'bg-teal-50 text-teal-600',
  'bg-pink-50 text-pink-600',
  'bg-cyan-50 text-cyan-600',
];

const CATEGORY_COLORS = [
  'bg-indigo-50 text-indigo-600',
  'bg-emerald-50 text-emerald-600',
  'bg-rose-50 text-rose-600',
  'bg-violet-50 text-violet-600',
  'bg-sky-50 text-sky-600',
];

function formatKgTon(value, unit, useTon) {
  if (unit === 'kg' && useTon) {
    return { display: (value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 }), unit: 't' };
  }
  return { display: value.toLocaleString('pt-BR'), unit };
}

const fmtBRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });

export default function SummaryCards({ orders, periodLabel }) {
  const { names } = useInsumoNames();
  const { costs } = useInsumoCosts();
  const [useTon, setUseTon] = useState(false);
  const [category, setCategory] = useState('Todas');
  const [productTypes, setProductTypes] = useState([]);
  const [traces, setTraces] = useState([]);
  const [catUnitMode, setCatUnitMode] = useState({}); // { [categoria]: 'm2' | 'pc' }

  useEffect(() => {
    base44.entities.ProductType.list().then(setProductTypes);
    base44.entities.ConcreteTrace.list().then(setTraces);
  }, []);

  const ptMap = useMemo(() => Object.fromEntries(productTypes.map(p => [p.id, p])), [productTypes]);
  const traceMap = useMemo(() => Object.fromEntries(traces.map(t => [t.id, t])), [traces]);

  const categories = useMemo(() => {
    const set = new Set();
    productTypes.forEach(p => { if (p.category) set.add(p.category); });
    return ['Todas', ...Array.from(set).sort()];
  }, [productTypes]);

  const concludedCat = useMemo(() => {
    const c = orders.filter(o => o.status === 'Concluída');
    if (category === 'Todas') return c;
    return c.filter(o => ptMap[o.product_type_id]?.category === category);
  }, [orders, category, ptMap]);

  // Consumo teórico de uma matéria-prima por ordem, baseado no traço
  function theoreticalForOrder(o, key) {
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

  // Total produzido por categoria — calcula m² (via pieces_per_m) e peças (un)
  const totalsByCategory = useMemo(() => {
    const map = {};
    concludedCat.forEach(o => {
      const pt = ptMap[o.product_type_id];
      const cat = pt?.category || 'Outros';
      if (!map[cat]) map[cat] = { un: 0, m2: 0 };
      map[cat].un += (o.actual_quantity || 0);
      const ppm = pt?.pieces_per_m;
      if (ppm > 0) {
        map[cat].m2 += (o.actual_quantity || 0) / ppm;
      }
    });
    return map;
  }, [concludedCat, ptMap]);

  function toggleCatUnit(cat) {
    setCatUnitMode(prev => ({ ...prev, [cat]: prev[cat] === 'm2' ? 'pc' : 'm2' }));
  }

  const categoryCards = Object.entries(totalsByCategory).map(([cat, v], i) => {
    const defaultMode = v.m2 > 0 ? 'm2' : 'pc';
    const mode = catUnitMode[cat] || defaultMode;
    const hasM2 = v.m2 > 0;
    const value = mode === 'm2'
      ? v.m2.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
      : v.un.toLocaleString('pt-BR');
    return {
      label: cat,
      value,
      unit: mode === 'm2' ? 'm²' : 'peças',
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      deviation: null,
      hasCost: false,
      hasTheoretical: false,
      toggleable: hasM2,
      currentMode: mode,
      onToggle: () => toggleCatUnit(cat),
    };
  });

  const insumoCards = INSUMO_KEYS.map((key, i) => {
    const { actual, unit } = INSUMO_FIELDS[key];
    const totalReal = concludedCat.reduce((s, o) => s + (o[actual] || 0), 0);
    const totalTheo = concludedCat.reduce((s, o) => s + theoreticalForOrder(o, key), 0);
    const deviation = totalTheo ? ((totalReal - totalTheo) / totalTheo) * 100 : null;
    const { display, unit: displayUnit } = formatKgTon(totalReal, unit, useTon);
    const { display: displayTheo, unit: displayUnitTheo } = formatKgTon(totalTheo, unit, useTon);
    const unitCost = costs[key] || 0;
    const actualCost = totalReal * unitCost;
    const theoCost = totalTheo * unitCost;
    const savings = theoCost - actualCost; // positivo = economizou (gastou menos que o traço)
    return {
      label: names[key],
      value: display,
      unit: totalTheo > 0 ? `${displayUnit} / teor. ${displayTheo} ${displayUnitTheo}` : displayUnit,
      color: CARD_COLORS[i % CARD_COLORS.length],
      deviation,
      cost: actualCost,
      savings,
      hasCost: unitCost > 0,
      hasTheoretical: totalTheo > 0,
    };
  });

  const allCards = [...categoryCards, ...insumoCards];

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Categoria:</span>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="border border-input rounded-lg px-3 py-1 text-xs bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Unidade:</span>
          <div className="flex bg-muted rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setUseTon(false)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${!useTon ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              kg / L
            </button>
            <button
              onClick={() => setUseTon(true)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${useTon ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              t / L
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {allCards.map((card, idx) => (
          <div
            key={`${card.label}-${idx}`}
            onClick={card.toggleable ? card.onToggle : undefined}
            className={`bg-card rounded-xl border border-border p-4 shadow-sm flex flex-col ${card.toggleable ? 'cursor-pointer hover:border-primary/50 hover:shadow-md transition-all' : ''}`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.color}`}>
                <Layers className="w-4 h-4" />
              </div>
              {card.toggleable ? (
                <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                  {card.currentMode === 'm2' ? 'm²' : 'pç'} ⇄
                </span>
              ) : (
                <DeviationBadge deviation={card.deviation} />
              )}
            </div>
            <p className="text-xl font-bold text-foreground">{card.value}</p>
            <p className="text-xs text-muted-foreground mt-1 font-medium">{card.label}</p>            <p className="text-xs text-muted-foreground/70 mt-0.5 leading-tight">{card.unit}</p>

            {card.hasCost && (
              <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Custo</span>
                  <span className="font-semibold text-foreground">{fmtBRL(card.cost)}</span>
                </div>
                {card.hasTheoretical && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{card.savings >= 0 ? 'Economia' : 'Perda'}</span>
                    <span className={`font-semibold ${card.savings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {fmtBRL(Math.abs(card.savings))}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}