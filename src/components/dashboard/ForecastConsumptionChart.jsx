import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useInsumoNames } from '@/hooks/useInsumoNames';
import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';

const BLUE = '#2563eb';
const COLORS = ['#2563eb', '#0ea5e9', '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#f97316'];

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs space-y-1 min-w-[160px]">
      <p className="font-semibold text-slate-800">{d.name}</p>
      <div className="flex justify-between gap-4"><span className="text-slate-500">Consumo previsto:</span><span className="font-semibold">{(d.qty || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} {d.unit}</span></div>
      <div className="flex justify-between gap-4"><span className="text-slate-500">Ordens:</span><span className="font-semibold">{d.orders}</span></div>
      {d.products.length > 0 && (
        <div className="flex justify-between gap-4"><span className="text-slate-500">Produtos:</span><span className="font-semibold truncate max-w-[120px]">{d.products.join(', ')}</span></div>
      )}
    </div>
  );
}

// Consumo previsto das ordens em andamento: (planejado - produzido) × consumo
// teórico por unidade (ProductType.cement_per_unit etc.). Reutiliza a lógica
// padrão de traço cadastrado no artefato — sem fórmula paralela.
export default function ForecastConsumptionChart({ orders, ptMap }) {
  const { names } = useInsumoNames();
  const { data, insufficient, orderCount } = useMemo(() => {
    const inProgress = orders.filter((o) => o.status === 'Em Andamento');
    const byInsumo = {};
    let insufficient = 0;

    inProgress.forEach((o) => {
      const pt = ptMap[o.product_type_id];
      const remaining = Math.max((Number(o.planned_quantity) || 0) - (Number(o.actual_quantity) || 0), 0);
      const hasStandard = pt && INSUMO_KEYS.some((k) => Number(pt[INSUMO_FIELDS[k].pt_field]) > 0);
      if (!pt || !hasStandard || remaining <= 0) {
        insufficient += 1;
        return;
      }
      INSUMO_KEYS.forEach((k) => {
        const perUnit = Number(pt[INSUMO_FIELDS[k].pt_field]) || 0;
        if (perUnit <= 0) return;
        if (!byInsumo[k]) byInsumo[k] = { qty: 0, orders: new Set(), products: new Set() };
        byInsumo[k].qty += remaining * perUnit;
        byInsumo[k].orders.add(o.id);
        byInsumo[k].products.add(o.product_type_name || '—');
      });
    });

    const data = INSUMO_KEYS.map((k) => {
      const v = byInsumo[k];
      return {
        key: k,
        name: names[k],
        qty: v ? v.qty : 0,
        unit: INSUMO_FIELDS[k].unit,
        orders: v ? v.orders.size : 0,
        products: v ? Array.from(v.products) : [],
      };
    }).filter((d) => d.qty > 0).sort((a, b) => b.qty - a.qty);

    return { data, insufficient, orderCount: inProgress.length };
  }, [orders, ptMap, names]);

  const detail = (
    <div className="overflow-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-slate-400 border-b border-slate-200">
            <th className="py-2 pr-3 font-semibold">Ordem</th>
            <th className="py-2 px-3 font-semibold">Produto</th>
            <th className="py-2 px-3 font-semibold text-right">Planejado</th>
            <th className="py-2 px-3 font-semibold text-right">Produzido</th>
            <th className="py-2 px-3 font-semibold text-right">Restante</th>
            <th className="py-2 pl-3 font-semibold text-right">Consumo previsto</th>
          </tr>
        </thead>
        <tbody>
          {orders.filter((o) => o.status === 'Em Andamento').map((o) => {
            const pt = ptMap[o.product_type_id];
            const remaining = Math.max((Number(o.planned_quantity) || 0) - (Number(o.actual_quantity) || 0), 0);
            const hasStandard = pt && INSUMO_KEYS.some((k) => Number(pt[INSUMO_FIELDS[k].pt_field]) > 0);
            const forecast = hasStandard ? INSUMO_KEYS.reduce((s, k) => s + remaining * (Number(pt[INSUMO_FIELDS[k].pt_field]) || 0), 0) : null;
            return (
              <tr key={o.id} className="border-b border-slate-100">
                <td className="py-2 pr-3 font-medium text-slate-700">{o.order_number || '—'}</td>
                <td className="py-2 px-3 text-slate-700">{o.product_type_name || '—'}</td>
                <td className="py-2 px-3 text-right text-slate-700">{(Number(o.planned_quantity) || 0).toLocaleString('pt-BR')}</td>
                <td className="py-2 px-3 text-right text-slate-700">{(Number(o.actual_quantity) || 0).toLocaleString('pt-BR')}</td>
                <td className="py-2 px-3 text-right text-slate-700">{remaining.toLocaleString('pt-BR')}</td>
                <td className="py-2 pl-3 text-right text-slate-500">{forecast != null ? `${forecast.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg` : 'Sem dados'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  if (data.length === 0) {
    return (
      <div className="space-y-2">
        <div className="h-48 flex items-center justify-center text-sm text-slate-400">Sem ordens em andamento com dados suficientes</div>
        {orderCount > 0 && insufficient > 0 && (
          <p className="text-[11px] text-slate-400 text-center">{orderCount} ordens em andamento · {insufficient} sem dados suficientes</p>
        )}
        {detail}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => v.toLocaleString('pt-BR')} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} width={90} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
            <Bar dataKey="qty" name="Consumo previsto" radius={[0, 4, 4, 0]}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {insufficient > 0 && (
        <p className="text-[11px] text-slate-400">{orderCount} ordens em andamento · {insufficient} sem dados suficientes</p>
      )}
      {detail}
    </div>
  );
}