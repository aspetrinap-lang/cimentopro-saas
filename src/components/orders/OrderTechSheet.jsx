import { useEffect } from 'react';
import { X, ArrowUpRight, ArrowDownRight, ClipboardList, Gauge, ShieldCheck, Package } from 'lucide-react';
import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';
import { productionMetrics, scrapMetrics, consumptionDeviation } from '@/lib/productionMetrics';
import ProductionStatusPill from './ProductionStatusPill';

const STATUS_COLORS = {
  'Em Andamento': 'bg-amber-100 text-amber-700',
  'Concluída': 'bg-green-100 text-green-700',
  'Cancelada': 'bg-slate-100 text-slate-500',
};

const fmtInt = (n) => (Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const fmtKg = (n) =>
  Math.abs(Number(n) || 0) >= 100 ? fmtInt(n) : (Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 });

// Ficha técnica da ordem: painel lateral com desempenho, qualidade e
// desvio de matéria-prima por insumo. Fecha com X, clique fora ou ESC.
export default function OrderTechSheet({ order, productType, names, onClose }) {
  const { planned, produced, deviation } = productionMetrics(order);
  const scrap = scrapMetrics(order);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const Section = ({ icon: Icon, title, children }) => (
    <section className="rounded-xl border border-border bg-muted/20 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-primary" />
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</h3>
      </div>
      {children}
    </section>
  );

  const Field = ({ label, value, className = '' }) => (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</p>
      <p className={`text-sm font-medium text-foreground mt-0.5 ${className}`}>{value}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="absolute right-0 top-0 bottom-0 w-full sm:max-w-md bg-card border-l border-border shadow-2xl flex flex-col overflow-hidden rounded-l-2xl">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border bg-muted/30">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary shrink-0" />
              <p className="text-base font-bold text-foreground truncate">Ordem {order.order_number}</p>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {order.production_date?.split('-').reverse().join('/')} · {order.product_type_name || '—'}
            </p>
            <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full mt-1.5 ${STATUS_COLORS[order.status] || 'bg-muted text-muted-foreground'}`}>
              {order.status}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <Section icon={Gauge} title="Desempenho">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Planejado" value={fmtInt(planned)} />
              <Field label="Produzido" value={order.actual_quantity != null ? fmtInt(produced) : '—'} />
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Atingimento</p>
                <div className="mt-0.5"><ProductionStatusPill order={order} /></div>
              </div>
            </div>
            <div className="pt-3 border-t border-border/60 mt-3">
              <Field
                label="Desvio"
                value={
                  !deviation ? '—' :
                  deviation.type === 'deficit' ? <span className="text-red-600">Déficit {fmtInt(deviation.value)}</span> :
                  deviation.type === 'surplus' ? <span className="text-blue-600">Excedente +{fmtInt(deviation.value)}</span> :
                  <span className="text-muted-foreground">0</span>
                }
              />
            </div>
          </Section>

          <Section icon={ShieldCheck} title="Qualidade">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Aprovado" value={order.actual_quantity != null ? fmtInt(scrap.approved) : '—'} />
              <Field
                label="Refugo"
                value={
                  order.actual_quantity == null ? '—' :
                  scrap.refugo > 0
                    ? <span className="text-amber-600">{fmtInt(scrap.refugo)}</span>
                    : '0'
                }
              />
              <Field
                label="Taxa refugo"
                value={
                  order.actual_quantity == null ? '—' :
                  scrap.refugo > 0
                    ? <span className="text-amber-600">{scrap.ratePct.toFixed(1).replace('.', ',')}%</span>
                    : '0%'
                }
              />
            </div>
            {order.loss_reason && (
              <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/60">
                Motivo: <span className="font-medium text-foreground">{order.loss_reason}</span>
              </p>
            )}
          </Section>

          <Section icon={Package} title="Matéria-prima — desvio de consumo">
            <div className="space-y-2">
              {INSUMO_KEYS.map(key => {
                const dev = consumptionDeviation(order, productType, INSUMO_FIELDS[key]);
                return (
                  <div key={key} className="flex items-center justify-between gap-3 py-1.5 border-b border-border/40 last:border-0">
                    <span className="text-xs font-medium text-foreground">{names[key]}</span>
                    {!dev ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {fmtKg(dev.theoretical)} → {fmtKg(dev.actual)} kg{' '}
                        {dev.deviation > 0 ? (
                          <span className="inline-flex items-center gap-0.5 font-semibold text-red-600">
                            <ArrowUpRight className="w-3 h-3" />+{fmtKg(dev.deviation)} kg
                          </span>
                        ) : dev.deviation < 0 ? (
                          <span className="inline-flex items-center gap-0.5 font-medium text-muted-foreground">
                            <ArrowDownRight className="w-3 h-3" />{fmtKg(dev.deviation)} kg
                          </span>
                        ) : (
                          <span className="font-medium text-muted-foreground">0 kg</span>
                        )}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Teórico (produzido × consumo por unidade) → real. Acima do teórico = perda.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}