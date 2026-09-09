import { useState } from 'react';
import { ChevronDown, ChevronUp, CircleOff, Layers, Gauge } from 'lucide-react';

const fmt0 = (v) => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const fmt1 = (v) =>
  v == null || !isFinite(v) ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Comparação período atual vs. período anterior (seta + %)
function Trend({ value, avg }) {
  if (!value || !avg) {
    return <span className="text-[10px] text-muted-foreground/60">vs. período anterior: —</span>;
  }
  const pct = ((value - avg) / avg) * 100;
  const up = pct >= 0;
  return (
    <span className={`text-[10px] font-medium ${up ? 'text-green-600' : 'text-red-600'}`}>
      {up ? '↑' : '↓'} {Math.abs(pct).toFixed(0)}% vs. período anterior
    </span>
  );
}

function perfClass(p) {
  if (p == null) return 'bg-muted text-muted-foreground';
  if (p >= 95) return 'bg-green-100 text-green-700';
  if (p >= 80) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

function Metric({ label, value, hint }) {
  return (
    <div className="rounded-lg bg-muted/40 border border-border p-2.5 text-center">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold leading-none">{label}</p>
      <p className="text-base font-bold text-foreground leading-tight mt-1">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

// Mini-gráfico de barras: peças/hora no período (diário ou semanal)
function PeriodChart({ series }) {
  const max = Math.max(...series.map((s) => s.piecesPerHour), 0);
  if (!max) {
    return <p className="text-xs text-muted-foreground text-center py-6">Sem produção no período.</p>;
  }
  const labelEvery = series.length <= 14 ? 1 : Math.ceil(series.length / 8);
  return (
    <div className="flex items-end gap-1.5 h-24 px-1">
      {series.map((s, i) => (
        <div key={s.date} className="flex-1 flex flex-col items-center gap-1 h-full justify-end"
          title={`${s.label}: ${fmt1(s.piecesPerHour)} peças/h`}>
          <span className="text-[9px] font-medium text-muted-foreground leading-none">
            {s.piecesPerHour ? Math.round(s.piecesPerHour) : ''}
          </span>
          <div
            className="w-full rounded-t min-h-[4px] bg-primary/40"
            style={{ height: `${Math.max(4, (s.piecesPerHour / max) * 64)}px` }}
          />
          <span className="text-[9px] text-muted-foreground leading-none">
            {i % labelEvery === 0 ? s.label : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

const STATUS_COLORS = {
  'Em Andamento': 'bg-amber-100 text-amber-700',
  'Concluída': 'bg-green-100 text-green-700',
  'Cancelada': 'bg-slate-100 text-slate-500',
};

export default function MachineCard({ card }) {
  const [open, setOpen] = useState(false);
  const { name, isLine, period, prev, series, hasProduction } = card;
  const Icon = isLine ? Layers : Gauge;
  const prevPPH = prev.piecesPerHour > 0 ? prev.piecesPerHour : null;
  const prevCPH = prev.cyclesPerHour > 0 ? prev.cyclesPerHour : null;

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${hasProduction ? 'bg-green-500' : 'bg-slate-300'}`} />
          <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
          <p className="font-semibold text-foreground truncate">{name}</p>
        </div>
        <button onClick={() => setOpen(!open)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {open ? 'Fechar' : 'Detalhes'}
        </button>
      </div>

      {/* Totais do período */}
      <div className="flex items-center justify-center gap-3 px-4 py-1.5 text-[11px] text-muted-foreground bg-muted/10 border-b border-border/50">
        <span><strong className="text-foreground">{fmt0(period.pieces)}</strong> peças</span>
        <span>·</span>
        <span><strong className="text-foreground">{fmt0(period.cycles)}</strong> ciclos</span>
        <span>·</span>
        <span><strong className="text-foreground">{fmt1(period.hours)}h</strong> prod.</span>
        <span>·</span>
        <span><strong className="text-foreground">{fmt0(period.ordersCount)}</strong> ordens</span>
      </div>

      {!hasProduction && (
        <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground bg-muted/10">
          <CircleOff className="w-4 h-4" /> Sem produção registrada no período
        </div>
      )}

      {/* Indicadores principais */}
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Peças/hora</p>
            <p className="text-2xl font-bold text-foreground leading-tight">{hasProduction ? fmt0(period.piecesPerHour) : '—'}</p>
            {hasProduction && <Trend value={period.piecesPerHour} avg={prevPPH} />}
          </div>
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Ciclos/hora</p>
            <p className="text-2xl font-bold text-foreground leading-tight">{hasProduction ? fmt1(period.cyclesPerHour) : '—'}</p>
            {hasProduction && <Trend value={period.cyclesPerHour} avg={prevCPH} />}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Metric label="Tempo méd. ciclo" value={hasProduction && period.avgCycleMin ? `${fmt1(period.avgCycleMin)} min` : '—'} />
          <Metric label="Desvio padrão peças/h" value={fmt1(card.stdDevPPH)} hint="dias com produção" />
          <Metric
            label="Quebras no período"
            value={card.downtimeCount > 0 ? `${card.downtimeCount} (${fmt0(card.downtimeMinutes)} min)` : '0'}
          />
          <div className="rounded-lg bg-muted/40 border border-border p-2.5 text-center">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold leading-none">Performance</p>
            <span className={`inline-block text-sm font-bold px-2 py-1 rounded-full mt-1 ${perfClass(card.performance)}`}>
              {card.performance != null ? `${fmt0(card.performance)}%` : '—'}
            </span>
            {card.target > 0 && (
              <p className="text-[10px] text-muted-foreground mt-0.5">meta: {fmt0(card.target)} ciclos/h</p>
            )}
          </div>
        </div>

        {/* Detalhe expansível */}
        {open && (
          <div className="space-y-3 pt-1 border-t border-border">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">Peças/hora — período selecionado</p>
              <PeriodChart series={series} />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">Ordens do período</p>
              {card.orders.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma ordem no período.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground border-b border-border">
                        <th className="text-left py-1.5 font-medium">Data</th>
                        <th className="text-left py-1.5 font-medium">Ordem</th>
                        <th className="text-left py-1.5 font-medium">Artefato</th>
                        <th className="text-right py-1.5 font-medium">Peças</th>
                        <th className="text-right py-1.5 font-medium">Ciclos</th>
                        <th className="text-right py-1.5 font-medium">Min.</th>
                        <th className="text-center py-1.5 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {card.orders.map((o) => (
                        <tr key={o.id} className="border-b border-border/50">
                          <td className="py-1.5 text-muted-foreground">{o.production_date ? o.production_date.split('-').reverse().join('/') : '—'}</td>
                          <td className="py-1.5 font-medium text-foreground">{o.order_number}</td>
                          <td className="py-1.5 text-muted-foreground">{o.product_type_name || '—'}</td>
                          <td className="py-1.5 text-right">{fmt0(o.actual_quantity)}</td>
                          <td className="py-1.5 text-right">{fmt0(o.machine_cycles_actual)}</td>
                          <td className="py-1.5 text-right">{fmt0(o.production_minutes)}</td>
                          <td className="py-1.5 text-center">
                            <span className={`px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[o.status] || 'bg-muted text-muted-foreground'}`}>
                              {o.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}