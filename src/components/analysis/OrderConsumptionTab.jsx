import { useMemo, useState } from 'react';
import { analyzeConsumption } from '@/lib/consumptionEngine';
import ConsumptionPanel from './ConsumptionPanel';
import SpecificConsumptionPanel from './SpecificConsumptionPanel';
import TraceProportionsPanel from './TraceProportionsPanel';

const brDate = (d) => (d ? String(d).split('-').reverse().join('/') : '—');

export default function OrderConsumptionTab({ orders, productTypesById, names }) {
  const [selectedId, setSelectedId] = useState(null);

  const order = useMemo(
    () => orders.find((o) => o.id === selectedId) || orders[0] || null,
    [orders, selectedId]
  );

  const analysis = useMemo(
    () => (order ? analyzeConsumption([order], productTypesById?.[order.product_type_id]) : null),
    [order, productTypesById]
  );

  if (!order) {
    return (
      <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground text-sm">
        Nenhuma ordem concluída encontrada para análise.
      </div>
    );
  }

  const meta = [
    { label: 'Artefato', value: order.product_type_name || '—' },
    { label: 'Máquina', value: order.machine_name || '—' },
    { label: 'Turno', value: order.shift || '—' },
    { label: 'Data', value: brDate(order.production_date) },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-2xl border border-border shadow-sm p-5 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">Ordem específica</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Selecione uma ordem concluída para a análise de consumo normalizada
          </p>
        </div>
        <select
          value={order.id}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full sm:w-96 rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground"
        >
          {orders.map((o) => (
            <option key={o.id} value={o.id}>
              {o.order_number} — {o.product_type_name} · {brDate(o.production_date)}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {meta.map((m) => (
            <div key={m.label} className="bg-muted/50 rounded-xl px-4 py-3">
              <p className="text-[11px] font-medium text-muted-foreground">{m.label}</p>
              <p className="text-sm font-bold text-foreground mt-0.5">{m.value}</p>
            </div>
          ))}
        </div>
      </div>

      {analysis && analysis.rows.length > 0 ? (
        <>
          <ConsumptionPanel
            key={`consumption-${order.id}`}
            analysis={analysis}
            names={names}
            title={`Consumo — Ordem ${order.order_number}`}
          />
          <SpecificConsumptionPanel key={`specific-${order.id}`} analysis={analysis} names={names} />
          <TraceProportionsPanel key={`proportions-${order.id}`} analysis={analysis} />
        </>
      ) : (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground text-sm">
          Nenhum consumo real registrado nesta ordem.
        </div>
      )}
    </div>
  );
}