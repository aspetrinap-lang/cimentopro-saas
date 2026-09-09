import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';
import { computeStats } from '@/lib/statsUtils';
import { Gauge } from 'lucide-react';

export default function MachineComparison({ orders, names }) {
  const data = useMemo(() => {
    const map = {};
    orders.forEach(o => {
      if (o.actual_quantity <= 0 || !o.machine_name) return;
      const m = o.machine_name;
      if (!map[m]) { map[m] = { name: m, n: 0 }; INSUMO_KEYS.forEach(k => map[m][k] = []); }
      map[m].n += 1;
      INSUMO_KEYS.forEach(k => {
        const v = (o[INSUMO_FIELDS[k].actual] || 0) / o.actual_quantity;
        if (v > 0) map[m][k].push(v);
      });
    });
    return Object.values(map).map(m => {
      const row = { name: m.name, n: m.n };
      let totalCV = 0, cnt = 0;
      INSUMO_KEYS.forEach(k => {
        const s = computeStats(m[k]);
        row[names[k]] = s ? +s.mean.toFixed(4) : 0;
        if (s) { totalCV += s.cv; cnt += 1; }
      });
      row.avgCV = cnt ? totalCV / cnt : 0;
      return row;
    });
  }, [orders, names]);

  if (data.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-10 text-center text-muted-foreground text-sm">
        Nenhuma ordem com máquina vinculada.
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Gauge className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Comparação de consumo médio/un entre máquinas</h3>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
          <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
          <Tooltip
            contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 12 }}
            formatter={(v) => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
          {INSUMO_KEYS.map((k, i) => (
            <Bar key={k} dataKey={names[k]} fill={['#4F46E5', '#F59E0B', '#F97316', '#EAB308', '#64748B', '#14B8A6', '#EC4899'][i % 7]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}