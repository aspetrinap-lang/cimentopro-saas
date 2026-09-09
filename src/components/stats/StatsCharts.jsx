import { useMemo } from 'react';
import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';
import { computeStats, theoreticalForOrder } from '@/lib/statsUtils';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const COLORS = ['#4F46E5', '#F59E0B', '#F97316', '#EAB308', '#64748B', '#14B8A6', '#EC4899'];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl shadow-lg p-3 text-xs space-y-1">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p, i) => p.value != null && (
        <div key={i} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color || p.stroke }} />
            {p.name}
          </span>
          <span className="font-semibold text-foreground">{Number(p.value).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}</span>
        </div>
      ))}
    </div>
  );
}

export default function StatsCharts({ orders, ptMap, traceMap, names }) {
  // Consumo médio por unidade por produto
  const byProduct = useMemo(() => {
    const map = {};
    orders.forEach(o => {
      if (o.actual_quantity <= 0) return;
      const name = o.product_type_name || 'Desconhecido';
      if (!map[name]) { map[name] = { name, qty: 0 }; INSUMO_KEYS.forEach(k => map[name][k] = []); }
      map[name].qty += o.actual_quantity;
      INSUMO_KEYS.forEach(k => {
        const v = o[INSUMO_FIELDS[k].actual] || 0;
        if (v > 0) map[name][k].push(v / o.actual_quantity);
      });
    });
    return Object.values(map).map(p => {
      const row = { name: p.name };
      INSUMO_KEYS.forEach(k => {
        const s = computeStats(p[k]);
        row[names[k]] = s ? +s.mean.toFixed(4) : 0;
      });
      return row;
    });
  }, [orders, names]);

  // Evolução do consumo por lote (data) — média por unidade por insumo
  const evolution = useMemo(() => {
    const map = {};
    orders.forEach(o => {
      if (o.actual_quantity <= 0 || !o.production_date) return;
      const d = o.production_date.slice(0, 10);
      if (!map[d]) { map[d] = { d, n: 0 }; INSUMO_KEYS.forEach(k => { map[d][names[k]] = 0; }); }
      map[d].n += 1;
      INSUMO_KEYS.forEach(k => {
        const v = o[INSUMO_FIELDS[k].actual] || 0;
        map[d][names[k]] += v / o.actual_quantity;
      });
    });
    return Object.values(map)
      .sort((a, b) => a.d.localeCompare(b.d))
      .map(r => {
        INSUMO_KEYS.forEach(k => { const nk = names[k]; r[nk] = r.n ? +(r[nk] / r.n).toFixed(4) : 0; });
        return { ...r, label: format(parseISO(r.d), 'dd/MM', { locale: ptBR }) };
      });
  }, [orders, names]);

  // Desvio padrão por insumo (últimos 30 lotes)
  const stdDevData = useMemo(() => {
    const sorted = [...orders].filter(o => o.actual_quantity > 0).slice(-30);
    return INSUMO_KEYS.map(k => {
      const vals = sorted.map(o => (o[INSUMO_FIELDS[k].actual] || 0) / o.actual_quantity).filter(v => v > 0);
      const s = computeStats(vals);
      return { name: names[k], stdDev: s ? +s.stdDev.toFixed(4) : 0, cv: s ? +s.cv.toFixed(2) : 0 };
    });
  }, [orders, names]);

  if (orders.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-10 text-center text-muted-foreground text-sm">
        Nenhuma ordem concluída no período.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground mb-3">Consumo médio por unidade produzida — por artefato</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={byProduct} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
            {INSUMO_KEYS.map((k, i) => (
              <Bar key={k} dataKey={names[k]} stackId="a" fill={COLORS[i % COLORS.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground mb-3">Evolução do consumo por lote (média/un)</h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={evolution} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
            {INSUMO_KEYS.map((k, i) => (
              <Line key={k} type="monotone" dataKey={names[k]} stroke={COLORS[i % COLORS.length]} dot={false} strokeWidth={1.8} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-3">Desvio padrão (últimos 30 lotes)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stdDevData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="stdDev" fill="#4F46E5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-3">Coeficiente de variação (%)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stdDevData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="cv" fill="#F59E0B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}