import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const CHART_COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl shadow-lg p-3 text-xs space-y-1.5 min-w-[160px]">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.color }} />
            <span className="text-muted-foreground">{p.name}</span>
          </span>
          <span className="font-semibold text-foreground">{p.value?.toLocaleString('pt-BR')}</span>
        </div>
      ))}
    </div>
  );
}

export default function MachineCyclesChart({ orders }) {
  const machines = useMemo(() => {
    const set = new Set(orders.filter(o => o.machine_name).map(o => o.machine_name));
    return [...set].sort();
  }, [orders]);

  const chartData = useMemo(() => {
    const byMonth = {};
    orders
      .filter(o => o.status === 'Concluída' && o.machine_name && o.machine_cycles_actual > 0)
      .forEach(o => {
        const monthKey = format(parseISO(o.production_date), 'yyyy-MM');
        if (!byMonth[monthKey]) byMonth[monthKey] = { monthKey, totals: {} };
        if (!byMonth[monthKey].totals[o.machine_name]) {
          byMonth[monthKey].totals[o.machine_name] = { total: 0, count: 0 };
        }
        byMonth[monthKey].totals[o.machine_name].total += o.machine_cycles_actual;
        byMonth[monthKey].totals[o.machine_name].count += 1;
      });

    return Object.values(byMonth)
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
      .map(d => {
        const entry = { label: format(parseISO(`${d.monthKey}-01`), 'MMM/yy', { locale: ptBR }) };
        machines.forEach(m => {
          const stats = d.totals[m];
          entry[m] = stats ? Math.round(stats.total / stats.count) : 0;
        });
        return entry;
      });
  }, [orders, machines]);

  if (machines.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground mb-1">Média de Ciclos por Máquina (Mensal)</h3>
        <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
          Nenhuma ordem concluída com ciclos informados no período.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Média de Ciclos por Máquina — Mensal</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Média de ciclos reais por máquina, agrupada por mês</p>
      </div>

      {chartData.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
          Sem ordens concluídas com ciclos informados no período.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            {machines.map((m, i) => (
              <Bar key={m} dataKey={m} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[3, 3, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}