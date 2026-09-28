import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useInsumoNames } from '@/hooks/useInsumoNames';
import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';

const LINE_COLORS = ['#2563eb', '#F59E0B', '#F97316', '#EAB308', '#64748B', '#14B8A6', '#EC4899', '#06B6D4'];

export default function TrendChart({ orders }) {
  const { names } = useInsumoNames();

  const filtered = orders.filter(o => o.status === 'Concluída' && o.production_date);

  const grouped = {};
  filtered.forEach(o => {
    const d = o.production_date;
    if (!grouped[d]) {
      grouped[d] = { date: d };
      INSUMO_KEYS.forEach(key => {
        grouped[d][`${key}_real`] = 0;
        grouped[d][`${key}_prev`] = 0;
      });
    }
    INSUMO_KEYS.forEach(key => {
      const { planned, actual } = INSUMO_FIELDS[key];
      grouped[d][`${key}_real`] += o[actual] || 0;
      grouped[d][`${key}_prev`] += o[planned] || 0;
    });
  });

  const data = Object.values(grouped)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(d => ({ ...d, label: format(parseISO(d.date), 'dd/MM', { locale: ptBR }) }));

  return (
    <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="font-semibold text-slate-800">Tendência de Consumo</h3>
        <p className="text-xs text-slate-500 mt-0.5">Real vs. planejado por insumo</p>
      </div>
      {data.length === 0 ? (
        <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">
          Nenhum dado no período selecionado
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
            <Tooltip
              contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 12 }}
              formatter={(val, name) => [`${Number(val).toLocaleString('pt-BR')} kg`, name]}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            {INSUMO_KEYS.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={`${key}_real`}
                name={`${names[key]} Real`}
                stroke={LINE_COLORS[i % LINE_COLORS.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}