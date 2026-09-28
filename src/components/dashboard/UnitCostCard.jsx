import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useInsumoCosts } from '@/hooks/useInsumoCosts';
import { useInsumoNames } from '@/hooks/useInsumoNames';
import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';

const COLORS = ['#2563eb', '#0ea5e9', '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#f97316'];
const fmtCurrency = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtCurrency4 = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 });

function abbreviate(name, max = 14) {
  if (!name) return '—';
  return name.length > max ? name.slice(0, max - 1) + '…' : name;
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs space-y-1 min-w-[160px]">
      <p className="font-semibold text-slate-800">{d.fullName}</p>
      <div className="flex justify-between gap-4"><span className="text-slate-500">Custo/un:</span><span className="font-semibold">{fmtCurrency(d.costPerUnit)}</span></div>
      <div className="flex justify-between gap-4"><span className="text-slate-500">Quantidade:</span><span className="font-semibold">{d.totalQty.toLocaleString('pt-BR')} un</span></div>
      <div className="flex justify-between gap-4"><span className="text-slate-500">Custo total:</span><span className="font-semibold">{fmtCurrency(d.totalCost)}</span></div>
    </div>
  );
}

// Compacto: gráfico horizontal TOP 5 do custo unitário por artefato.
// Sem composição detalhada — essa fica no detailView (modal).
export default function UnitCostCard({ orders, limit }) {
  const { costs, loading: costsLoading } = useInsumoCosts();
  const { names } = useInsumoNames();

  const productCosts = useMemo(() => {
    const byProduct = {};
    orders
      .filter((o) => o.status === 'Concluída' && o.actual_quantity > 0)
      .forEach((o) => {
        const name = o.product_type_name || 'Desconhecido';
        if (!byProduct[name]) {
          byProduct[name] = { name, fullName: name, totalQty: 0, totalCost: 0, insumoBreakdown: {} };
          INSUMO_KEYS.forEach((k) => { byProduct[name].insumoBreakdown[k] = 0; });
        }
        byProduct[name].totalQty += o.actual_quantity;
        let orderCost = 0;
        INSUMO_KEYS.forEach((key) => {
          const qty = Number(o[INSUMO_FIELDS[key].actual]) || 0;
          const cost = qty * (costs[key] || 0);
          orderCost += cost;
          byProduct[name].insumoBreakdown[key] += cost;
        });
        byProduct[name].totalCost += orderCost;
      });

    return Object.values(byProduct)
      .map((p) => ({ ...p, costPerUnit: p.totalQty > 0 ? p.totalCost / p.totalQty : 0 }))
      .sort((a, b) => b.costPerUnit - a.costPerUnit);
  }, [orders, costs]);

  if (costsLoading) return null;

  const data = (limit ? productCosts.slice(0, limit) : productCosts).map((p) => ({
    ...p,
    label: abbreviate(p.name),
  }));

  if (data.length === 0) {
    return <div className="h-full min-h-[280px] flex items-center justify-center text-sm text-slate-400">Sem dados</div>;
  }

  return (
    <div className="h-full min-h-[280px] flex flex-col">
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => fmtCurrency(v)} />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} width={90} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
            <Bar dataKey="costPerUnit" name="Custo/un" radius={[0, 4, 4, 0]}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Detalhamento para o modal: tabela com composição de custo por artefato.
export function UnitCostDetail({ orders }) {
  const { costs } = useInsumoCosts();
  const { names } = useInsumoNames();

  const productCosts = useMemo(() => {
    const byProduct = {};
    orders
      .filter((o) => o.status === 'Concluída' && o.actual_quantity > 0)
      .forEach((o) => {
        const name = o.product_type_name || 'Desconhecido';
        if (!byProduct[name]) {
          byProduct[name] = { name, totalQty: 0, totalCost: 0, insumoBreakdown: {} };
          INSUMO_KEYS.forEach((k) => { byProduct[name].insumoBreakdown[k] = 0; });
        }
        byProduct[name].totalQty += o.actual_quantity;
        INSUMO_KEYS.forEach((key) => {
          const qty = Number(o[INSUMO_FIELDS[key].actual]) || 0;
          byProduct[name].insumoBreakdown[key] += qty * (costs[key] || 0);
        });
        byProduct[name].totalCost += INSUMO_KEYS.reduce((s, k) => s + (Number(o[INSUMO_FIELDS[k].actual]) || 0) * (costs[k] || 0), 0);
      });
    return Object.values(byProduct)
      .map((p) => ({ ...p, costPerUnit: p.totalQty > 0 ? p.totalCost / p.totalQty : 0 }))
      .sort((a, b) => b.costPerUnit - a.costPerUnit);
  }, [orders, costs]);

  if (productCosts.length === 0) {
    return <div className="text-sm text-slate-400 text-center py-8">Sem dados</div>;
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-slate-400 border-b border-slate-200">
            <th className="py-2 pr-3 font-semibold">Artefato</th>
            <th className="py-2 px-3 font-semibold text-right">Qtd (un)</th>
            <th className="py-2 px-3 font-semibold text-right">Custo/un</th>
            {INSUMO_KEYS.map((k) => (
              <th key={k} className="py-2 px-3 font-semibold text-right">{names[k]}</th>
            ))}
            <th className="py-2 pl-3 font-semibold text-right">Custo total</th>
          </tr>
        </thead>
        <tbody>
          {productCosts.map((p) => (
            <tr key={p.name} className="border-b border-slate-100">
              <td className="py-2 pr-3 font-medium text-slate-700">{p.name}</td>
              <td className="py-2 px-3 text-right text-slate-700">{p.totalQty.toLocaleString('pt-BR')}</td>
              <td className="py-2 px-3 text-right font-semibold text-slate-800">{fmtCurrency4(p.costPerUnit)}</td>
              {INSUMO_KEYS.map((k) => {
                const cost = p.insumoBreakdown[k] || 0;
                return <td key={k} className="py-2 px-3 text-right text-slate-500">{cost > 0 ? fmtCurrency4(cost / p.totalQty) : '—'}</td>;
              })}
              <td className="py-2 pl-3 text-right font-semibold text-slate-700">{fmtCurrency(p.totalCost)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}