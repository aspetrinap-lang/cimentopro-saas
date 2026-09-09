import { useMemo, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useInsumoNames } from '@/hooks/useInsumoNames';
import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';
import { Package } from 'lucide-react';

const BAR_COLORS = ['#4F46E5', '#F59E0B', '#F97316', '#EAB308', '#64748B', '#14B8A6', '#EC4899', '#06B6D4'];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl shadow-lg p-3 text-xs space-y-1 min-w-[180px]">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload.map((p, i) => p.value > 0 && (
        <div key={i} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.fill }} />
            <span className="text-muted-foreground">{p.name}</span>
          </span>
          <span className="font-semibold text-foreground">{p.value.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span>
        </div>
      ))}
    </div>
  );
}

export default function UnitConsumptionChart({ orders }) {
  const { names } = useInsumoNames();
  const [categoryMap, setCategoryMap] = useState({});

  useEffect(() => {
    base44.entities.ProductType.list('name').then(types => {
      const map = {};
      types.forEach(t => { map[t.id] = t.category || 'Sem categoria'; });
      setCategoryMap(map);
    });
  }, []);

  const categories = useMemo(() => {
    const set = new Set();
    orders.forEach(o => {
      if (o.product_type_id && categoryMap[o.product_type_id]) set.add(categoryMap[o.product_type_id]);
    });
    return Array.from(set).sort();
  }, [orders, categoryMap]);

  // Pré-seleciona "Blocos de Concreto" se existir
  const [selectedCategory, setSelectedCategory] = useState('');
  useEffect(() => {
    if (!selectedCategory && categories.length > 0) {
      const blocos = categories.find(c => c.toLowerCase().includes('bloco'));
      if (blocos) setSelectedCategory(blocos);
    }
  }, [categories, selectedCategory]);

  const chartData = useMemo(() => {
    const filtered = orders.filter(o =>
      o.status === 'Concluída' &&
      o.actual_quantity > 0 &&
      (!selectedCategory || categoryMap[o.product_type_id] === selectedCategory)
    );

    const grouped = {};
    filtered.forEach(o => {
      const name = o.product_type_name || 'Desconhecido';
      if (!grouped[name]) {
        grouped[name] = { name, totalQty: 0 };
        INSUMO_KEYS.forEach(k => { grouped[name][k] = 0; });
      }
      grouped[name].totalQty += o.actual_quantity;
      INSUMO_KEYS.forEach(key => {
        const { actual } = INSUMO_FIELDS[key];
        grouped[name][key] += o[actual] || 0;
      });
    });

    return Object.values(grouped).map(g => {
      const row = { name: g.name, totalQty: g.totalQty };
      INSUMO_KEYS.forEach(key => {
        row[names[key]] = g.totalQty > 0
          ? parseFloat((g[key] / g.totalQty).toFixed(3))
          : 0;
      });
      return row;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [orders, selectedCategory, categoryMap, names]);

  const activeKeys = useMemo(() => {
    const keys = [];
    INSUMO_KEYS.forEach(k => {
      const hasData = chartData.some(d => d[names[k]] > 0);
      if (hasData) keys.push(k);
    });
    return keys;
  }, [chartData, names]);

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-primary" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Consumo por Unidade Produzida</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Insumo consumido (kg/L) dividido pela quantidade real produzida</p>
          </div>
        </div>
        {categories.length > 0 && (
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="border border-input rounded-lg px-3 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-ring max-w-[220px]"
          >
            <option value="">Todas as categorias</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {chartData.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
          Nenhuma ordem concluída {selectedCategory ? `na categoria "${selectedCategory}"` : ''} no período.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} angle={-15} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={v => v.toLocaleString('pt-BR')} />
            <Tooltip content={<CustomTooltip />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            {activeKeys.map((key, i) => (
              <Bar
                key={key}
                dataKey={names[key]}
                fill={BAR_COLORS[i % BAR_COLORS.length]}
                radius={[3, 3, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}