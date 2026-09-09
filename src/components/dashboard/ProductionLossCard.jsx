import { AlertTriangle } from 'lucide-react';
import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';
import { useInsumoCosts } from '@/hooks/useInsumoCosts';

const LOSS_FIELDS = [
  { key: 'loss_second_line', label: '2ª Linha' },
  { key: 'loss_discarded', label: 'Descartadas' },
];

function pct(part, total) {
  if (!total) return 0;
  return (part / total) * 100;
}

const fmtBRL = v => v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }) : '—';

export default function ProductionLossCard({ orders }) {
  const { costs } = useInsumoCosts();
  const concluded = orders.filter(o => o.status === 'Concluída');

  const totals = LOSS_FIELDS.reduce((acc, { key }) => {
    acc[key] = concluded.reduce((s, o) => s + (Number(o[key]) || 0), 0);
    return acc;
  }, {});

  const totalLost = Object.values(totals).reduce((s, v) => s + v, 0);

  const totalPlanned = concluded.reduce((s, o) => s + (o.planned_quantity || 0), 0);
  const totalReal = concluded.reduce((s, o) => s + (o.actual_quantity || 0), 0);

  const lossPct = pct(totalLost, totalReal);

  // Custo financeiro da perda: peças perdidas × custo unitário da ordem
  const lossCost = concluded.reduce((acc, o) => {
    const lost = (Number(o.loss_second_line) || 0) + (Number(o.loss_discarded) || 0);
    if (!lost) return acc;
    const orderCost = INSUMO_KEYS.reduce((s, key) => {
      const { actual } = INSUMO_FIELDS[key];
      return s + ((o[actual] || 0) * (costs[key] || 0));
    }, 0);
    const unitCost = o.actual_quantity > 0 ? orderCost / o.actual_quantity : 0;
    return acc + (lost * unitCost);
  }, 0);

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-5 space-y-5">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-50 text-red-600">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Perdas de Produção</h2>
          <p className="text-xs text-muted-foreground">Indicadas pelas ordens de produção concluídas no período</p>
        </div>
      </div>

      {/* Detalhamento por tipo de perda */}
      <div className="grid grid-cols-2 gap-3">
        {LOSS_FIELDS.map(({ key, label }) => {
          const lost = totals[key] || 0;
          const fieldCost = concluded.reduce((acc, o) => {
            const qty = Number(o[key]) || 0;
            if (!qty) return acc;
            const orderCost = INSUMO_KEYS.reduce((s, k) => {
              const { actual } = INSUMO_FIELDS[k];
              return s + ((o[actual] || 0) * (costs[k] || 0));
            }, 0);
            const unitCost = o.actual_quantity > 0 ? orderCost / o.actual_quantity : 0;
            return acc + (qty * unitCost);
          }, 0);
          return (
            <div key={key} className="bg-muted/40 rounded-lg p-3 border border-border text-center">
              <p className="text-xs text-muted-foreground leading-tight">{label}</p>
              <p className="font-bold text-foreground text-lg mt-0.5">{lost.toLocaleString('pt-BR')}</p>
              <p className="text-xs text-muted-foreground/70">peças ({pct(lost, totalReal).toFixed(2)}%)</p>
              <p className="text-xs font-semibold text-red-600 mt-1">{fmtBRL(fieldCost)}</p>
            </div>
          );
        })}
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
          <p className="text-xs text-muted-foreground">Produção Planejada</p>
          <p className="text-xl font-bold text-blue-700 mt-1">{totalPlanned.toLocaleString('pt-BR')}</p>
          <p className="text-xs text-muted-foreground/70">peças</p>
        </div>
        <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
          <p className="text-xs text-muted-foreground">Produção Real</p>
          <p className="text-xl font-bold text-indigo-700 mt-1">{totalReal.toLocaleString('pt-BR')}</p>
          <p className="text-xs text-muted-foreground/70">peças</p>
        </div>
        <div className="bg-red-50 rounded-lg p-3 border border-red-100">
          <p className="text-xs text-muted-foreground">Total Perdido</p>
          <p className="text-xl font-bold text-red-700 mt-1">{totalLost.toLocaleString('pt-BR')}</p>
          <p className="text-xs text-muted-foreground/70">peças ({lossPct.toFixed(2)}%)</p>
        </div>
        <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
          <p className="text-xs text-muted-foreground">Taxa de Perdas</p>
          <p className="text-xl font-bold text-amber-700 mt-1">{lossPct.toFixed(2)}%</p>
          <p className="text-xs text-muted-foreground/70">sobre a produção real</p>
        </div>
        <div className="bg-rose-50 dark:bg-rose-950/30 rounded-lg p-3 border border-rose-100 dark:border-rose-900">
          <p className="text-xs text-muted-foreground">Custo das Perdas</p>
          <p className="text-xl font-bold text-rose-700 dark:text-rose-400 mt-1">{fmtBRL(lossCost)}</p>
          <p className="text-xs text-muted-foreground/70">impacto financeiro</p>
        </div>
      </div>
    </div>
  );
}