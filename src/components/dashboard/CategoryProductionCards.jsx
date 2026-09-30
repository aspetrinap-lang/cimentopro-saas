import { useMemo } from 'react';
import { Layers } from 'lucide-react';
import KpiCard from './KpiCard';

const fmtInt = (n) => (Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const fmtKg = (n) => (Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const pctDelta = (cur, prev) => (cur == null || prev == null || prev === 0) ? null : ((cur - prev) / Math.abs(prev)) * 100;

// Peso por peça (kg) — usa weight_kg_per_unit com fallback no legado
// volume_per_unit_m3 (que historicamente armazenou kg).
function unitWeight(pt) {
  if (!pt) return 0;
  return Number(pt.weight_kg_per_unit ?? pt.volume_per_unit_m3) || 0;
}

function summarize(orders, ptMap) {
  const concluded = orders.filter((o) => o.status === 'Concluída');
  const byCat = new Map();
  concluded.forEach((o) => {
    const pt = ptMap[o.product_type_id];
    const cat = pt?.category || 'Sem categoria';
    const qty = Number(o.actual_quantity) || 0;
    const w = qty * unitWeight(pt);
    const cur = byCat.get(cat) || { produced: 0, weight: 0, count: 0 };
    cur.produced += qty;
    cur.weight += w;
    cur.count += 1;
    byCat.set(cat, cur);
  });
  return byCat;
}

// Cards de produção separados por categoria (mesmo visual do card de
// Produção Total). Exibidos quando nenhuma categoria está selecionada —
// ao escolher uma categoria, o dashboard inteiro já fica filtrado.
// Categorias sem produção no período ficam ocultas.
export default function CategoryProductionCards({ orders, prevOrders = [], ptMap, categories = [] }) {
  const cur = useMemo(() => summarize(orders, ptMap), [orders, ptMap]);
  const prev = useMemo(() => summarize(prevOrders, ptMap), [prevOrders, ptMap]);

  const names = useMemo(() => {
    const known = categories.map((c) => c.name).filter((n) => cur.has(n));
    const extra = [...cur.keys()].filter((n) => !known.includes(n) && n !== 'Sem categoria');
    const out = [...known, ...extra];
    if (cur.has('Sem categoria')) out.push('Sem categoria');
    return out;
  }, [categories, cur]);

  if (names.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {names.map((name) => {
        const c = cur.get(name);
        const p = prev.get(name);
        const d = pctDelta(c.produced, p?.produced ?? null);
        return (
          <KpiCard
            key={name}
            icon={Layers}
            label={name}
            value={fmtInt(c.produced)}
            sub={`${fmtKg(c.weight)} kg · ${c.count} ${c.count === 1 ? 'ordem' : 'ordens'}`}
            delta={d != null ? { value: d, unit: '%', goodWhen: 'up' } : null}
          />
        );
      })}
    </div>
  );
}