import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useInsumoNames } from '@/hooks/useInsumoNames';
import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';

const BAR_COLORS = ['#4F46E5', '#F59E0B', '#F97316', '#EAB308', '#64748B', '#14B8A6', '#EC4899', '#06B6D4'];

export default function ProductComparison({ orders }) {
  const { names } = useInsumoNames();
  const completed = orders.filter(o => o.status === 'Concluída');

  const grouped = {};
  completed.forEach(o => {
    const name = o.product_type_name || 'Desconhecido';
    if (!grouped[name]) {
      grouped[name] = { name };
      INSUMO_KEYS.forEach(key => { grouped[name][key] = 0; });
    }
    INSUMO_KEYS.forEach(key => {
      const { actual } = INSUMO_FIELDS[key];
      grouped[name][key] += o[actual] || 0;
    });
  });

  const data = Object.values(grouped).map(g => {
    const row = { name: g.name };
    INSUMO_KEYS.forEach(key => { row[names[key]] = Math.round(g[key]); });
    return row;
  });

  return (
    <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="font-semibold text-foreground">Consumo por Tipo de Artefato</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Comparativo acumulado de insumos (kg / L)</p>
      </div>
      {data.length === 0 ? (
        <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">
          Nenhuma ordem concluída para comparar
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
            <Tooltip
              contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 12 }}
              formatter={(val, name) => [`${Number(val).toLocaleString('pt-BR')}`, name]}
            />
            <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 11 }} />
            {INSUMO_KEYS.map((key, i) => (
              <Bar
                key={key}
                dataKey={names[key]}
                fill={BAR_COLORS[i % BAR_COLORS.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}