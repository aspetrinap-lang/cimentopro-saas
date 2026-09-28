import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useInsumoNames } from '@/hooks/useInsumoNames';
import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';

const LINE_COLORS = ['#2563eb', '#F59E0B', '#F97316', '#EAB308', '#64748B', '#14B8A6', '#EC4899', '#06B6D4'];

// Consumo de insumos ao longo do tempo: real vs. planejado por insumo.
// `limit` restringe aos N insumos de maior desvio (TOP 5 no compacto);
// sem limite, mostra todos.
export default function TrendChart({ orders, limit }) {
  const { names } = useInsumoNames();

  const { data, keys } = useMemo(() => {
    const filtered = orders.filter(o => o.status === 'Concluída' && o.production_date);
    const grouped = {};
    const totals = {};
    INSUMO_KEYS.forEach(key => { totals[key] = { real: 0, theo: 0 }; });

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
        totals[key].real += o[actual] || 0;
        totals[key].theo += o[planned] || 0;
      });
    });

    const sortedKeys = [...INSUMO_KEYS].sort((a, b) => (totals[b].real) - (totals[a].real));
    const selectedKeys = limit ? sortedKeys.slice(0, limit) : sortedKeys;

    const data = Object.values(grouped)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({ ...d, label: format(parseISO(d.date), 'dd/MM', { locale: ptBR }) }));

    return { data, keys: selectedKeys };
  }, [orders, limit]);

  if (data.length === 0) {
    return <div className="h-full min-h-[280px] flex items-center justify-center text-slate-400 text-sm">Nenhum dado no período selecionado</div>;
  }

  return (
    <div className="h-full min-h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
          <Tooltip
            contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 12 }}
            formatter={(val, name) => [`${Number(val).toLocaleString('pt-BR')} kg`, name]}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          {keys.map((key, i) => (
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
    </div>
  );
}