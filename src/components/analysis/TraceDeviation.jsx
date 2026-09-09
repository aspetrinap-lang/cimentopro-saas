import { INSUMO_KEYS, INSUMO_FIELDS, INSUMO_TRACE_PARTS } from '@/lib/insumos';

function deviationColor(pct) {
  const a = Math.abs(pct);
  if (a <= 5) return 'text-green-600';
  if (a <= 15) return 'text-amber-600';
  return 'text-red-600';
}

export default function TraceDeviation({ orders, productTypes, traces, names }) {
  const productTypeMap = {};
  productTypes.forEach(pt => { productTypeMap[pt.id] = pt; });
  const traceMap = {};
  traces.forEach(t => { traceMap[t.id] = t; });

  const byProduct = {};
  orders.forEach(o => {
    const pt = productTypeMap[o.product_type_id];
    if (!pt || !pt.concrete_trace_id) return;
    const trace = traceMap[pt.concrete_trace_id];
    if (!trace || !trace.cement_kg_per_m3 || !o.actual_traces_produced) return;
    const name = o.product_type_name || pt.name || 'Desconhecido';
    if (!byProduct[name]) {
      byProduct[name] = { name, ordens: 0, insumos: {} };
      INSUMO_KEYS.forEach(k => {
        if (INSUMO_TRACE_PARTS[k]) byProduct[name].insumos[k] = { theo: 0, actual: 0 };
      });
    }
    byProduct[name].ordens += 1;
    const cementKg = trace.cement_kg_per_m3;
    const cementParts = trace.cement_parts || 1;
    INSUMO_KEYS.forEach(key => {
      const partsField = INSUMO_TRACE_PARTS[key];
      if (!partsField) return;
      const parts = trace[partsField] || 0;
      const theo = o.actual_traces_produced * cementKg * (parts / cementParts);
      const act = o[INSUMO_FIELDS[key].actual] || 0;
      byProduct[name].insumos[key].theo += theo;
      byProduct[name].insumos[key].actual += act;
    });
  });

  const rows = Object.values(byProduct).filter(r => r.ordens > 0);
  if (rows.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground text-sm">
        Nenhuma ordem com traço vinculado e traços produzidos registrados.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {rows.map(p => {
        const insumoEntries = Object.entries(p.insumos).filter(([, v]) => v.theo > 0 || v.actual > 0);
        return (
          <div key={p.name} className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-foreground">{p.name}</span>
              <span className="text-xs text-muted-foreground">{p.ordens} ordem(ns)</span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left font-medium py-1.5">Insumo</th>
                  <th className="text-right font-medium py-1.5">Teórico (traço)</th>
                  <th className="text-right font-medium py-1.5">Real</th>
                  <th className="text-right font-medium py-1.5">Desvio</th>
                </tr>
              </thead>
              <tbody>
                {insumoEntries.map(([key, v]) => {
                  const pct = v.theo > 0 ? ((v.actual - v.theo) / v.theo) * 100 : null;
                  return (
                    <tr key={key} className="border-b border-border/50">
                      <td className="py-1.5 text-muted-foreground">{names[key]}</td>
                      <td className="py-1.5 text-right text-foreground">{v.theo.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg</td>
                      <td className="py-1.5 text-right text-foreground">{v.actual.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg</td>
                      <td className={`py-1.5 text-right font-semibold ${pct !== null ? deviationColor(pct) : 'text-muted-foreground'}`}>
                        {pct !== null ? `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}