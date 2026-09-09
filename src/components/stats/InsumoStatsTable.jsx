import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';
import { computeStats, fmtNum } from '@/lib/statsUtils';
import { Sigma } from 'lucide-react';

export default function InsumoStatsTable({ orders, names }) {
  // Consumo por unidade produzida (real / qtd) por ordem, agrupado por insumo
  const rows = INSUMO_KEYS.map(key => {
    const { actual } = INSUMO_FIELDS[key];
    const perUnit = orders
      .filter(o => o.actual_quantity > 0 && (o[actual] || 0) > 0)
      .map(o => o[actual] / o.actual_quantity);
    const s = computeStats(perUnit);
    if (!s) return null;
    return { key, unit: INSUMO_FIELDS[key].unit, ...s };
  }).filter(Boolean);

  if (rows.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-10 text-center text-muted-foreground text-sm">
        Nenhuma ordem concluída com consumo registrado.
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-x-auto">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
        <Sigma className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Indicadores Estatísticos por Matéria-Prima</h3>
        <span className="text-xs text-muted-foreground ml-1">consumo por unidade (kg/un · L/un)</span>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-muted/40 text-muted-foreground uppercase tracking-wide">
            <th className="px-3 py-2 text-left font-semibold">Insumo</th>
            <th className="px-3 py-2 text-right font-semibold">Média</th>
            <th className="px-3 py-2 text-right font-semibold">Desvio Padrão</th>
            <th className="px-3 py-2 text-right font-semibold">Variância</th>
            <th className="px-3 py-2 text-right font-semibold">CV (%)</th>
            <th className="px-3 py-2 text-right font-semibold">Mín.</th>
            <th className="px-3 py-2 text-right font-semibold">Máx.</th>
            <th className="px-3 py-2 text-right font-semibold">Mediana</th>
            <th className="px-3 py-2 text-right font-semibold">Lotes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.key} className="border-b border-border/50 hover:bg-muted/20">
              <td className="px-3 py-2 font-medium text-foreground">{names[r.key]}</td>
              <td className="px-3 py-2 text-right text-foreground">{fmtNum(r.mean, 4)} {r.unit}/un</td>
              <td className="px-3 py-2 text-right text-foreground">{fmtNum(r.stdDev, 4)}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{fmtNum(r.variance, 4)}</td>
              <td className={`px-3 py-2 text-right font-semibold ${r.cv <= 5 ? 'text-green-600' : r.cv <= 10 ? 'text-amber-600' : 'text-red-600'}`}>{fmtNum(r.cv, 2)}%</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{fmtNum(r.min, 4)}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{fmtNum(r.max, 4)}</td>
              <td className="px-3 py-2 text-right text-foreground">{fmtNum(r.median, 4)}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{r.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}