import { useMemo, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts';
import { useInsumoCosts } from '@/hooks/useInsumoCosts';
import { useInsumoNames } from '@/hooks/useInsumoNames';
import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';
import { DollarSign, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const COLORS = ['#4F46E5', '#F59E0B', '#F97316', '#EAB308', '#64748B', '#14B8A6', '#EC4899', '#06B6D4'];

function fmtBRL(val) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <div className="bg-card border border-border rounded-xl shadow-lg p-3 text-xs space-y-1 min-w-[180px]">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload.map((p, i) => p.value > 0 && (
        <div key={i} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.fill }} />
            <span className="text-muted-foreground truncate max-w-[100px]">{p.name}</span>
          </span>
          <span className="font-semibold text-foreground">{fmtBRL(p.value)}</span>
        </div>
      ))}
      <div className="border-t border-border pt-1 flex justify-between font-semibold text-foreground">
        <span>Total</span>
        <span>{fmtBRL(total)}</span>
      </div>
    </div>
  );
}

export default function RawMaterialCostChart({ orders }) {
  const { costs, loading: costsLoading } = useInsumoCosts();
  const { names } = useInsumoNames();
  const [selectedCategory, setSelectedCategory] = useState('');
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
    orders.forEach(o => { if (o.product_type_id && categoryMap[o.product_type_id]) set.add(categoryMap[o.product_type_id]); });
    return Array.from(set).sort();
  }, [orders, categoryMap]);

  const categoryFilteredOrders = useMemo(() => {
    if (!selectedCategory) return orders;
    return orders.filter(o => categoryMap[o.product_type_id] === selectedCategory);
  }, [orders, selectedCategory, categoryMap]);

  const costsConfigured = useMemo(() =>
    Object.values(costs).some(v => v > 0), [costs]);

  const chartData = useMemo(() => {
    const byDate = {};
    categoryFilteredOrders
      .filter(o => o.status === 'Concluída')
      .forEach(o => {
        const date = o.production_date;
        if (!byDate[date]) {
          byDate[date] = { date };
          INSUMO_KEYS.forEach(k => { byDate[date][k] = 0; });
        }
        INSUMO_KEYS.forEach(key => {
          const { actual } = INSUMO_FIELDS[key];
          byDate[date][key] += (o[actual] || 0) * (costs[key] || 0);
        });
      });

    return Object.values(byDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        ...d,
        label: format(parseISO(d.date), 'dd/MM', { locale: ptBR }),
      }));
  }, [categoryFilteredOrders, costs]);

  const totals = useMemo(() => {
    const byInsumo = {};
    INSUMO_KEYS.forEach(k => { byInsumo[k] = 0; });
    chartData.forEach(d => {
      INSUMO_KEYS.forEach(k => { byInsumo[k] += d[k] || 0; });
    });
    const total = Object.values(byInsumo).reduce((s, v) => s + v, 0);
    return { byInsumo, total };
  }, [chartData]);

  const topInsumo = useMemo(() => {
    let topKey = null, topVal = 0;
    INSUMO_KEYS.forEach(k => {
      if (totals.byInsumo[k] > topVal) { topVal = totals.byInsumo[k]; topKey = k; }
    });
    return topKey ? { name: names[topKey], val: topVal, pct: totals.total > 0 ? (topVal / totals.total) * 100 : 0 } : null;
  }, [totals, names]);

  const activeKeys = INSUMO_KEYS.filter(k => costs[k] > 0 && totals.byInsumo[k] > 0);

  if (costsLoading) return null;

  if (!costsConfigured) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Custo Total de Matéria-Prima</h3>
        </div>
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Configure os preços em <strong>Configurações → Custos de Insumos</strong> para visualizar o custo total de matéria-prima consumida.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Custo Total de Matéria-Prima</h3>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 ml-6">Consumo real das ordens concluídas × preço configurado por insumo</p>
        </div>

        {categories.length > 0 && (
        <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-muted-foreground">Filtrar por categoria:</label>
        <select
          className="border border-input rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring max-w-[260px]"
          value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}
        >
          <option value="">Todas as categorias</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {selectedCategory && (
          <button onClick={() => setSelectedCategory('')} className="text-xs text-primary hover:underline">Limpar</button>
        )}
        </div>
        )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-primary/5 rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground">Custo Total no Período</p>
          <p className="text-xl font-bold text-primary mt-0.5">{fmtBRL(totals.total)}</p>
        </div>
        <div className="bg-muted/40 rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground">Ordens Consideradas</p>
          <p className="text-xl font-bold text-foreground mt-0.5">
            {categoryFilteredOrders.filter(o => o.status === 'Concluída').length}
          </p>
        </div>
        {topInsumo && (
          <div className="bg-muted/40 rounded-xl p-3 text-center col-span-2 sm:col-span-1">
            <p className="text-xs text-muted-foreground">Maior Custo</p>
            <p className="text-sm font-bold text-foreground mt-0.5 truncate">{topInsumo.name}</p>
            <p className="text-xs text-muted-foreground">{topInsumo.pct.toFixed(1)}% do total</p>
          </div>
        )}
      </div>

      {/* Composição do custo por insumo */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">Composição do custo total por insumo</p>
        {activeKeys.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">Nenhuma ordem concluída com insumos registrados.</p>
        ) : activeKeys.map((key, i) => {
          const val = totals.byInsumo[key];
          const pct = totals.total > 0 ? (val / totals.total) * 100 : 0;
          return (
            <div key={key} className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground w-28 truncate">{names[key]}</span>
              <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                />
              </div>
              <span className="text-muted-foreground w-8 text-right">{pct.toFixed(0)}%</span>
              <span className="font-semibold text-foreground w-28 text-right">{fmtBRL(val)}</span>
            </div>
          );
        })}
      </div>

      {/* Gráfico diário empilhado */}
      {chartData.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-3">Evolução diária do custo total</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickFormatter={v => v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v.toFixed(0)}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              {activeKeys.map((key, i) => (
                <Bar
                  key={key}
                  dataKey={key}
                  name={names[key]}
                  stackId="cost"
                  fill={COLORS[i % COLORS.length]}
                  radius={i === activeKeys.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}