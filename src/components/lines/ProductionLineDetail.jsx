import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Gauge, Zap, DollarSign, TrendingUp, AlertTriangle, Package, Activity, Layers } from 'lucide-react';
import { fmtBRL, fmtNum } from '@/lib/statsUtils';

export default function ProductionLineDetail({ line, onClose }) {
  const [orders, setOrders] = useState([]);
  const [downtimes, setDowntimes] = useState([]);
  const [sharedResources, setSharedResources] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      base44.entities.ProductionOrder.list('-production_date', 2000),
      base44.entities.MachineDowntime.filter({}, '-date', 500),
      base44.entities.SharedResource.list('name', 200),
    ]).then(([o, d, sr]) => {
      if (!active) return;
      setOrders(o);
      setDowntimes(d);
      setSharedResources(sr);
    }).catch(() => {}).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [line.id]);

  const lineMachineIds = useMemo(() => new Set((line.machines || []).map((m) => m.machine_id)), [line]);

  const lineOrders = useMemo(
    () => orders.filter((o) => o.production_line_id === line.id || (o.machine_id && lineMachineIds.has(o.machine_id))),
    [orders, line.id, lineMachineIds]
  );

  const metrics = useMemo(() => {
    const produced = lineOrders.reduce((s, o) => s + (Number(o.actual_quantity) || 0), 0);
    const planned = lineOrders.reduce((s, o) => s + (Number(o.planned_quantity) || 0), 0);
    const secondLine = lineOrders.reduce((s, o) => s + (Number(o.loss_second_line) || 0), 0);
    const discarded = lineOrders.reduce((s, o) => s + (Number(o.loss_discarded) || 0), 0);
    const prodMinutes = lineOrders.reduce((s, o) => s + (Number(o.production_minutes) || 0), 0);
    const prodHours = prodMinutes / 60;

    // Paradas das máquinas da linha
    const lineDowntimes = downtimes.filter((d) => lineMachineIds.has(d.machine_id));
    const downtimeMinutes = lineDowntimes.reduce((s, d) => s + (Number(d.duration_minutes) || 0), 0);
    const totalMinutes = prodMinutes + downtimeMinutes;
    const efficiency = totalMinutes > 0 ? (prodMinutes / totalMinutes) * 100 : 0;

    // Custo de energia: horas de produção × potência utilizada × custo/kWh
    const usedPower = Number(line.used_power_kw) || 0;
    const energyCost = prodHours * usedPower * (Number(line.energy_cost_per_kwh) || 0);
    const costPerHour = usedPower * (Number(line.energy_cost_per_kwh) || 0);

    // Custo de recursos compartilhados rateado por % de uso
    const sharedCost = (line.shared_resources || []).reduce((s, sr) => {
      const res = sharedResources.find((r) => r.id === sr.resource_id);
      if (!res || res.cost_per_hour == null || sr.usage_pct == null) return s;
      return s + (Number(res.cost_per_hour) * prodHours * (Number(sr.usage_pct) / 100));
    }, 0);

    // Custo da produção: energia + recursos compartilhados rateados
    const productionCost = energyCost + sharedCost;
    const costPerUnit = produced > 0 ? productionCost / produced : 0;

    // Capacidade vs realizado (capacidade da linha em ciclos/hora)
    const capacity = Number(line.production_capacity_per_hour) || 0;
    const totalCycles = lineOrders.reduce((s, o) => s + (Number(o.machine_cycles_actual) || Number(o.machine_cycles_planned) || 0), 0);
    const capacityUsedPct = capacity > 0 && prodHours > 0 ? (totalCycles / (capacity * prodHours)) * 100 : 0;

    return {
      produced, planned, secondLine, discarded, prodHours, downtimeMinutes, efficiency,
      energyCost, costPerHour, productionCost, costPerUnit, capacityUsedPct, sharedCost,
      orderCount: lineOrders.length, downtimeCount: lineDowntimes.length,
    };
  }, [lineOrders, downtimes, lineMachineIds, line, sharedResources]);

  const stat = (icon, label, value, sub, color) => (
    <div className="bg-card rounded-xl p-4 border border-border">
      <div className="flex items-center gap-2 mb-1.5">
        <icon className={`w-4 h-4 ${color || 'text-primary'}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-lg font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="bg-background w-full max-w-md h-full overflow-y-auto shadow-2xl border-l border-border">
        <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="font-semibold text-foreground">{line.name}</h2>
            <p className="text-xs text-muted-foreground">{line.description || 'Sem descrição'}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Equipamentos */}
          <section>
            <h3 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" /> Sequência de Equipamentos
            </h3>
            <div className="space-y-1.5">
              {(line.machines || []).sort((a, b) => (a.sequence_order || 0) - (b.sequence_order || 0)).map((m, i) => (
                <div key={i} className="flex items-center gap-2 bg-muted/40 rounded-lg p-2 border border-border text-xs">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0">{m.sequence_order || i + 1}</span>
                  <span className="flex-1 text-foreground font-medium">{m.machine_name || '—'}</span>
                  <span className="text-muted-foreground">{fmtNum(m.power_kw, 4)} kW</span>
                </div>
              ))}
              {(line.machines || []).length === 0 && <p className="text-xs text-muted-foreground">Nenhuma máquina vinculada.</p>}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
              <div className="bg-muted/40 rounded-lg p-2 border border-border">
                <p className="text-muted-foreground">Potência Instalada</p>
                <p className="font-semibold text-foreground">{fmtNum(line.installed_power_kw, 4)} kW</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-2 border border-border">
                <p className="text-muted-foreground">Potência Utilizada</p>
                <p className="font-semibold text-foreground">{fmtNum(line.used_power_kw, 4)} kW</p>
              </div>
            </div>
          </section>

          {/* Recursos compartilhados */}
          {(line.shared_resources || []).length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" /> Recursos Compartilhados (rateio)
              </h3>
              <div className="space-y-1.5">
                {(line.shared_resources || []).map((sr, i) => {
                  const res = sharedResources.find((r) => r.id === sr.resource_id);
                  const apportioned = res?.cost_per_hour != null && sr.usage_pct != null && metrics.prodHours > 0
                    ? Number(res.cost_per_hour) * metrics.prodHours * (Number(sr.usage_pct) / 100)
                    : 0;
                  return (
                    <div key={i} className="flex items-center justify-between gap-2 bg-muted/40 rounded-lg p-2 border border-border text-xs">
                      <span className="flex-1 text-foreground font-medium">{sr.resource_name || '—'}</span>
                      <span className="text-muted-foreground">{Number(sr.usage_pct || 0)}% uso</span>
                      <span className="font-semibold text-foreground whitespace-nowrap">{fmtBRL(apportioned)}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Métricas de produção */}
          <section>
            <h3 className="text-xs font-semibold text-foreground mb-2">Indicadores de Produção</h3>
            {loading ? (
              <div className="flex items-center justify-center py-8"><div className="w-6 h-6 border-2 border-slate-200 border-t-primary rounded-full animate-spin" /></div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {stat(Package, 'Produção Realizada', fmtNum(metrics.produced, 0), `${metrics.orderCount} ordens`)}
                {stat(TrendingUp, 'Capacidade Utilizada', `${fmtNum(metrics.capacityUsedPct, 1)}%`, `${fmtNum(line.production_capacity_per_hour, 0)} cic/h`)}
                {stat(Gauge, 'Eficiência da Linha', `${fmtNum(metrics.efficiency, 1)}%`, `${fmtNum(metrics.prodHours, 1)} h produzidas`)}
                {stat(Activity, 'Tempo Produção', `${fmtNum(metrics.prodMinutes, 0)} min`, `vs ${fmtNum(metrics.downtimeMinutes, 0)} min paradas`)}
                {stat(Package, '2ª Linha', fmtNum(metrics.secondLine, 0), 'peças')}
                {stat(AlertTriangle, 'Descartadas', fmtNum(metrics.discarded, 0), 'peças')}
                {stat(Zap, 'Custo Energia/h', fmtBRL(metrics.costPerHour), `${fmtNum(line.energy_cost_per_kwh, 2)}/kWh`)}
                {metrics.sharedCost > 0 && stat(Layers, 'Custo Recursos Rateado', fmtBRL(metrics.sharedCost), 'recursos compartilhados')}
                {stat(DollarSign, 'Custo Produção', fmtBRL(metrics.productionCost), `${fmtBRL(metrics.costPerUnit)}/pç`)}
              </div>
            )}
          </section>

          {metrics.downtimeCount > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> Paradas Registradas ({metrics.downtimeCount})
              </h3>
              <p className="text-xs text-muted-foreground">Total de {fmtNum(metrics.downtimeMinutes, 0)} minutos parados nas máquinas da linha.</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}