import { useMemo, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useInsumoCosts } from '@/hooks/useInsumoCosts';
import { useInsumoNames } from '@/hooks/useInsumoNames';
import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';
import { DollarSign, AlertCircle } from 'lucide-react';

function fmt(val) {
  return val.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

function fmtCurrency(val) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 });
}

export default function UnitCostCard({ orders }) {
  const { costs, loading: costsLoading } = useInsumoCosts();
  const { names } = useInsumoNames();
  const [productTypes, setProductTypes] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('all');

  useEffect(() => {
    base44.entities.ProductType.list().then(setProductTypes);
  }, []);

  // Lista de artefatos disponíveis nas ordens concluídas
  const availableProducts = useMemo(() => {
    const set = new Set();
    orders.filter(o => o.status === 'Concluída' && o.actual_quantity > 0)
      .forEach(o => set.add(o.product_type_name || 'Desconhecido'));
    return Array.from(set).sort();
  }, [orders]);

  // Mapa de product_type_id -> mold_cost_per_unit
  const moldCostMap = useMemo(() => {
    const map = {};
    productTypes.forEach(pt => {
      if (pt.mold_cost_per_unit) map[pt.id] = pt.mold_cost_per_unit;
    });
    return map;
  }, [productTypes]);

  const costsConfigured = useMemo(() =>
    Object.values(costs).some(v => v > 0), [costs]);

  // Agrupa ordens concluídas por artefato e calcula custo unitário médio
  const productCosts = useMemo(() => {
    const byProduct = {};

    orders
      .filter(o => o.status === 'Concluída' && o.actual_quantity > 0)
      .forEach(o => {
        const name = o.product_type_name || 'Desconhecido';
        if (!byProduct[name]) {
          byProduct[name] = { name, totalQty: 0, totalCost: 0, moldCost: 0, insumoBreakdown: {} };
          INSUMO_KEYS.forEach(k => { byProduct[name].insumoBreakdown[k] = 0; });
        }
        byProduct[name].totalQty += o.actual_quantity;

        let orderCost = 0;
        INSUMO_KEYS.forEach(key => {
          const { actual } = INSUMO_FIELDS[key];
          const qty = o[actual] || 0;
          const cost = qty * (costs[key] || 0);
          orderCost += cost;
          byProduct[name].insumoBreakdown[key] += cost;
        });

        // Custo do molde por peça × quantidade real
        const moldPerUnit = moldCostMap[o.product_type_id] || 0;
        const moldCost = moldPerUnit * o.actual_quantity;
        byProduct[name].moldCost += moldCost;
        orderCost += moldCost;

        byProduct[name].totalCost += orderCost;
      });

    return Object.values(byProduct)
      .map(p => ({
        ...p,
        costPerUnit: p.totalQty > 0 ? p.totalCost / p.totalQty : 0,
      }))
      .filter(p => selectedProduct === 'all' || p.name === selectedProduct)
      .sort((a, b) => b.costPerUnit - a.costPerUnit);
  }, [orders, costs, moldCostMap, selectedProduct]);

  if (costsLoading) return null;

  if (!costsConfigured) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Custo Unitário por Artefato</h3>
        </div>
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Configure os custos de matéria-prima em <strong>Configurações → Custos de Insumos</strong> para visualizar o custo unitário de cada artefato.</span>
        </div>
      </div>
    );
  }

  if (productCosts.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Custo Unitário por Artefato</h3>
        </div>
        <p className="text-sm text-muted-foreground text-center py-8">Nenhuma ordem concluída no período.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-primary" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Custo Unitário por Artefato</h3>
            <p className="text-xs text-muted-foreground">Baseado no consumo real de matéria-prima das ordens concluídas</p>
          </div>
        </div>
        <select
          value={selectedProduct}
          onChange={e => setSelectedProduct(e.target.value)}
          className="px-3 py-1.5 border border-input rounded-lg text-xs bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring max-w-[220px]"
        >
          <option value="all">Todos os artefatos</option>
          {availableProducts.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {productCosts.map(p => (
          <div key={p.name} className="border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <span className="font-semibold text-sm text-foreground">{p.name}</span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">{p.totalQty.toLocaleString('pt-BR')} un</span>
            </div>

            {/* Custo por unidade em destaque */}
            <div className="bg-primary/5 rounded-lg px-3 py-2 text-center">
              <p className="text-xs text-muted-foreground">Custo por unidade</p>
              <p className="text-2xl font-bold text-primary">{fmtCurrency(p.costPerUnit)}</p>
            </div>

            {/* Breakdown por insumo */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">Composição do custo</p>
              {INSUMO_KEYS.map(key => {
                const costForKey = p.insumoBreakdown[key];
                if (!costForKey || costForKey === 0) return null;
                const pct = p.totalCost > 0 ? (costForKey / p.totalCost) * 100 : 0;
                const perUnit = p.totalQty > 0 ? costForKey / p.totalQty : 0;
                return (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground w-24 truncate">{names[key]}</span>
                    <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                      <div className="h-full bg-primary/60 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-muted-foreground w-16 text-right">{fmtCurrency(perUnit)}/un</span>
                  </div>
                );
              })}
              {p.moldCost > 0 && (
                <div className="flex items-center gap-2 text-xs pt-1 border-t border-border">
                  <span className="text-muted-foreground w-24 truncate">Molde</span>
                  <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                    <div className="h-full bg-amber-500/70 rounded-full" style={{ width: `${p.totalCost > 0 ? (p.moldCost / p.totalCost) * 100 : 0}%` }} />
                  </div>
                  <span className="text-muted-foreground w-16 text-right">
                    {fmtCurrency(p.totalQty > 0 ? p.moldCost / p.totalQty : 0)}/un
                  </span>
                </div>
              )}
            </div>

            <div className="border-t border-border pt-2 flex justify-between text-xs text-muted-foreground">
              <span>Custo total do período</span>
              <span className="font-semibold text-foreground">
                {p.totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}