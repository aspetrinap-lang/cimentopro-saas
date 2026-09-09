import { Pencil, Trash2, ChevronRight } from 'lucide-react';
import ProductionStatusPill from './ProductionStatusPill';

const STATUS_COLORS = {
  'Em Andamento': 'bg-amber-100 text-amber-700',
  'Concluída': 'bg-green-100 text-green-700',
  'Cancelada': 'bg-slate-100 text-slate-500',
};

const fmtInt = (n) => (Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });

// Linha simplificada: data, artefato, qtde planejada, qtde real e atingimento.
// O clique abre a ficha técnica (OrderTechSheet) com os dados de desvio,
// refugo e matéria-prima.
export default function OrderRow({ order, onEdit, onDelete, onSelect }) {
  const hasProduced = order.actual_quantity != null;

  return (
    <tr
      className="group border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
      onClick={() => onSelect(order)}
    >
      <td className="sticky left-0 z-10 bg-card group-hover:bg-muted/30 px-4 py-3 text-sm font-medium text-foreground shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
        <div className="flex items-center gap-1">
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          {order.order_number}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{order.production_date}</td>
      <td className="px-4 py-3 text-sm text-foreground">{order.product_type_name || '—'}</td>
      <td className="px-4 py-3 text-sm text-right">{fmtInt(order.planned_quantity)}</td>
      <td className="px-4 py-3 text-sm text-right">{hasProduced ? fmtInt(order.actual_quantity) : '—'}</td>
      <td className="px-4 py-3"><ProductionStatusPill order={order} /></td>
      <td className="px-4 py-3 text-center">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status] || 'bg-muted text-muted-foreground'}`}>
          {order.status}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 justify-end">
          <button onClick={(e) => { e.stopPropagation(); onEdit(order); }}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(order); }}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}