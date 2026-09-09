import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';
import { theoreticalForOrder, classifyDeviation, fmtNum, fmtBRL } from '@/lib/statsUtils';
import { Target } from 'lucide-react';

export default function LimitControlTable({ orders, ptMap, traceMap, names, costs }) {
  const rows = INSUMO_KEYS.map(key => {
    const { actual } = INSUMO_FIELDS[key];
    let sumRealPU = 0, sumTheoPU = 0, totalQty = 0, n = 0;
    orders.forEach(o => {
      if (o.actual_quantity <= 0) return;
      const real = o[actual] || 0;
      const theo = theoreticalForOrder(o, key, ptMap, traceMap);
      if (real <= 0 && theo <= 0) return;
      n += 1;
      sumRealPU += real / o.actual_quantity;
      sumTheoPU += theo > 0 ? theo / o.actual_quantity : 0;
      totalQty += o.actual_quantity;
    });
    if (n === 0) return null;
    const realPU = sumRealPU / n;
    const theoPU = sumTheoPU / n;
    const devPct = theoPU > 0 ? ((realPU - theoPU) / theoPU) * 100 : null;
    const excessKg = devPct != null && devPct > 0 ? (realPU - theoPU) * totalQty : 0;
    const excessCost = excessKg * (costs[key] || 0);
    const cls = classifyDeviation(devPct);
    return { key, unit: INSUMO_FIELDS[key].unit, realPU, theoPU, devPct, excessKg, excessCost, n, cls };
  }).filter(Boolean);

  if (rows.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-10 text-center text-muted-foreground text-sm">
        Vincule traços de concreto aos artefatos para comparar consumo real vs. ficha técnica.
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-x-auto">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
        <Target className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Controle de Limites — Real vs. Ficha Técnica (Traço)</h3>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-muted/40 text-muted-foreground uppercase tracking-wide">
            <th className="px-3 py-2 text-left font-semibold">Insumo</th>
            <th className="px-3 py-2 text-right font-semibold">Meta (traço/un)</th>
            <th className="px-3 py-2 text-right font-semibold">Real médio/un</th>
            <th className="px-3 py-2 text-right font-semibold">Desvio %</th>
            <th className="px-3 py-2 text-right font-semibold">Excesso (kg)</th>
            <th className="px-3 py-2 text-right font-semibold">Custo do excesso</th>
            <th className="px-3 py-2 text-center font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.key} className="border-b border-border/50 hover:bg-muted/20">
              <td className="px-3 py-2 font-medium text-foreground">{names[r.key]}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{r.theoPU > 0 ? `${fmtNum(r.theoPU, 4)} ${r.unit}` : '—'}</td>
              <td className="px-3 py-2 text-right text-foreground">{fmtNum(r.realPU, 4)} {r.unit}</td>
              <td className={`px-3 py-2 text-right font-semibold ${r.devPct == null ? 'text-muted-foreground' : r.cls.cls.split(' ')[0]}`}>
                {r.devPct != null ? `${r.devPct > 0 ? '+' : ''}${r.devPct.toFixed(2)}%` : '—'}
              </td>
              <td className="px-3 py-2 text-right text-foreground">{r.excessKg > 0 ? fmtNum(r.excessKg, 1) : '—'}</td>
              <td className="px-3 py-2 text-right text-foreground">{r.excessCost > 0 ? fmtBRL(r.excessCost) : '—'}</td>
              <td className="px-3 py-2 text-center">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ${r.cls.cls}`}>
                  {r.cls.emoji} {r.cls.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}