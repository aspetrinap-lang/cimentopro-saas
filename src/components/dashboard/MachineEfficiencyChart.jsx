import { useState, useMemo } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
          <span className="font-semibold text-foreground">
            {p.name === 'Eficiência (%)' ? `${p.value}%` : p.value?.toLocaleString('pt-BR')}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function MachineEfficiencyChart({ orders }) {
  const machines = useMemo(() => {
    const set = new Set(orders.filter(o => o.machine_name).map(o => o.machine_name));
    return [...set].sort();
  }, [orders]);

  const [selectedMachine, setSelectedMachine] = useState('');
  const activeMachine = selectedMachine;

  const chartData = useMemo(() => {
    const byDate = {};
    orders
      .filter(o => o.status === 'Concluída' && o.planned_quantity && (activeMachine === '' || o.machine_name === activeMachine))
      .forEach(o => {
        const date = o.production_date;
        if (!byDate[date]) byDate[date] = { date, planned: 0, actual: 0 };
        byDate[date].planned += o.planned_quantity || 0;
        byDate[date].actual += o.actual_quantity || 0;
      });

    return Object.values(byDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        ...d,
        label: format(parseISO(d.date), 'dd/MM', { locale: ptBR }),
        efficiency: d.planned > 0 ? parseFloat(((d.actual / d.planned) * 100).toFixed(1)) : 0,
      }));
  }, [orders, activeMachine]);

  const avgEfficiency = chartData.length
    ? parseFloat((chartData.reduce((s, d) => s + d.efficiency, 0) / chartData.length).toFixed(1))
    : 0;

  const belowTarget = chartData.filter(d => d.efficiency < 95).length;

  if (machines.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground mb-1">Eficiência por Máquina</h3>
        <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
          Nenhuma ordem com máquina vinculada no período.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Eficiência por Máquina — Planejado vs. Real</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Comparativo diário de quantidade produzida</p>
        </div>
        <select
          value={activeMachine}
          onChange={e => setSelectedMachine(e.target.value)}
          className="border border-input rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todas as máquinas</option>
          {machines.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-muted/40 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground">Eficiência Média</p>
          <p className={`text-xl font-bold mt-0.5 ${avgEfficiency >= 98 ? 'text-green-600' : avgEfficiency >= 90 ? 'text-amber-600' : 'text-red-600'}`}>
            {avgEfficiency}%
          </p>
        </div>
        <div className="bg-muted/40 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground">Dias Analisados</p>
          <p className="text-xl font-bold text-foreground mt-0.5">{chartData.length}</p>
        </div>
        <div className="bg-muted/40 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground">Dias abaixo de 95%</p>
          <p className={`text-xl font-bold mt-0.5 ${belowTarget > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {belowTarget}
          </p>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
          Sem ordens concluídas para esta máquina no período.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
            <YAxis yAxisId="qty" tick={{ fontSize: 11, fill: '#64748b' }} />
            <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 11, fill: '#64748b' }} unit="%" domain={[0, 120]} />
            <Tooltip content={<CustomTooltip />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            <Bar yAxisId="qty" dataKey="planned" name="Planejado" fill="#A5B4FC" radius={[3, 3, 0, 0]} />
            <Bar yAxisId="qty" dataKey="actual" name="Produzido" fill="#4F46E5" radius={[3, 3, 0, 0]} />
            <ReferenceLine
              yAxisId="pct" y={95}
              stroke="#F59E0B" strokeDasharray="4 4"
              label={{ value: 'Meta 95%', position: 'insideTopRight', fontSize: 10, fill: '#F59E0B' }}
            />
            <Line
              yAxisId="pct" type="monotone" dataKey="efficiency"
              name="Eficiência (%)" stroke="#F97316" strokeWidth={2}
              dot={{ r: 3, fill: '#F97316' }} activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}