import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useInsumoNames } from '@/hooks/useInsumoNames';
import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';

const BLUE = '#2563eb';

// Evolução do custo por unidade: consumo real × custos atuais de insumo,
// ao longo do tempo. Nota: custos atuais (sem histórico de preços).
export default function CostEvolutionChart({ orders, costs }) {
  const { names } = useInsumoNames();
  const data = useMemo(() => {
    const byDate = {};
    orders.filter((o) => o.status === 'Concluída' && o.actual_quantity > 0).forEach((o) => {
      const d = o.production_date;
      if (!byDate[d]) byDate[d] = { date: d, cost: 0, qty: 0 };
      INSUMO_KEYS.forEach((k) => {
        byDate[d].cost += (Number(o[INSUMO_FIELDS[k].actual]) || 0) * (costs[k] || 0);
      });
      byDate[d].qty += Number(o.actual_quantity) || 0;
    });
    return Object.values(byDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({ label: format(parseISO(d.date), 'dd/MM', { locale: ptBR }), costPerUnit: d.qty > 0 ? d.cost / d.qty : 0 }));
  }, [orders, costs]);

  if (data.length === 0) {
    return <div className="h-64 flex items-center justify-center text-sm text-slate-400">Sem dados</div>;
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-slate-400 italic">Custo por unidade (R$/un) — consumo real × custos atuais de insumo</p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `R$${v.toFixed(2)}`} />
            <Tooltip formatter={(v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 4 })} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
            <Line type="monotone" dataKey="costPerUnit" name="Custo/un" stroke={BLUE} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}