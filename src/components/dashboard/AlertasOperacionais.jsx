import { useMemo } from 'react';
import { AlertTriangle, TrendingDown, TrendingUp, Gauge, Coins, PlayCircle, Clock } from 'lucide-react';
import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';
import { theoreticalForOrder, fmtBRL, fmtNum } from '@/lib/statsUtils';

const SEVERITY = {
  critical: { cls: 'bg-red-50 text-red-700 border-red-200', icon: AlertTriangle },
  high: { cls: 'bg-orange-50 text-orange-700 border-orange-200', icon: TrendingUp },
  medium: { cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: AlertTriangle },
  info: { cls: 'bg-blue-50 text-blue-700 border-blue-200', icon: Clock },
};

// Alertas derivados exclusivamente dos dados reais do período — sem limites
// arbitrários fixos. Cada alerta carrega o dado que o originou.
export default function AlertasOperacionais({ orders, ptMap, traceMap, costs }) {
  const alerts = useMemo(() => {
    const list = [];
    const concluded = orders.filter((o) => o.status === 'Concluída');
    if (concluded.length === 0) return list;

    const planned = concluded.reduce((s, o) => s + (Number(o.planned_quantity) || 0), 0);
    const produced = concluded.reduce((s, o) => s + (Number(o.actual_quantity) || 0), 0);
    const eff = planned > 0 ? (produced / planned) * 100 : null;

    // Eficiência baixa vs. média do período
    const machineEff = {};
    concluded.forEach((o) => {
      if (!o.machine_name) return;
      if (!machineEff[o.machine_name]) machineEff[o.machine_name] = { planned: 0, actual: 0 };
      machineEff[o.machine_name].planned += Number(o.planned_quantity) || 0;
      machineEff[o.machine_name].actual += Number(o.actual_quantity) || 0;
    });
    const effs = Object.entries(machineEff).map(([name, v]) => ({ name, eff: v.planned > 0 ? (v.actual / v.planned) * 100 : null })).filter((m) => m.eff != null);
    const avgEff = effs.length ? effs.reduce((s, m) => s + m.eff, 0) / effs.length : null;
    effs.filter((m) => avgEff != null && m.eff < avgEff - 5).forEach((m) => {
      list.push({ severity: 'high', icon: Gauge, title: 'Eficiência baixa', text: `${m.name}: ${m.eff.toFixed(1)}% (média ${avgEff.toFixed(1)}%)` });
    });

    // Consumo acima do teórico
    INSUMO_KEYS.forEach((k) => {
      let real = 0, theo = 0;
      concluded.forEach((o) => {
        real += Number(o[INSUMO_FIELDS[k].actual]) || 0;
        theo += theoreticalForOrder(o, k, ptMap, traceMap);
      });
      if (theo > 0 && real > theo * 1.05) {
        const dev = ((real - theo) / theo) * 100;
        list.push({ severity: dev > 15 ? 'critical' : 'high', icon: TrendingUp, title: 'Consumo acima do teórico', text: `${k}: +${dev.toFixed(1)}% acima do traço` });
      }
    });

    // Desperdício elevado
    const lost = concluded.reduce((s, o) => s + (Number(o.loss_second_line) || 0) + (Number(o.loss_discarded) || 0), 0);
    const lossPct = produced > 0 ? (lost / produced) * 100 : 0;
    if (lossPct > 3) {
      list.push({ severity: lossPct > 7 ? 'critical' : 'medium', icon: TrendingDown, title: 'Desperdício elevado', text: `${fmtNum(lost)} peças (${lossPct.toFixed(1)}% da produção)` });
    }

    // Grande volume restante nas ordens em andamento
    const inProgress = orders.filter((o) => o.status === 'Em Andamento');
    const remaining = inProgress.reduce((s, o) => s + Math.max((Number(o.planned_quantity) || 0) - (Number(o.actual_quantity) || 0), 0), 0);
    if (inProgress.length > 0 && remaining > produced * 0.5) {
      list.push({ severity: 'medium', icon: PlayCircle, title: 'Volume restante elevado', text: `${fmtNum(remaining)} un. restantes em ${inProgress.length} ordens em andamento` });
    }

    // Consumo futuro elevado
    let forecast = 0;
    inProgress.forEach((o) => {
      const pt = ptMap[o.product_type_id];
      if (!pt) return;
      const rem = Math.max((Number(o.planned_quantity) || 0) - (Number(o.actual_quantity) || 0), 0);
      INSUMO_KEYS.forEach((k) => { forecast += rem * (Number(pt[INSUMO_FIELDS[k].pt_field]) || 0) * (costs[k] || 0); });
    });
    if (forecast > 0) {
      list.push({ severity: 'info', icon: Coins, title: 'Consumo previsto', text: `${fmtBRL(forecast)} em insumos para concluir ordens em andamento` });
    }

    return list;
  }, [orders, ptMap, traceMap, costs]);

  if (alerts.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 text-center text-sm text-slate-400">
        Nenhum alerta operacional no período.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
      {alerts.map((a, i) => {
        const sev = SEVERITY[a.severity] || SEVERITY.info;
        const Icon = a.icon;
        return (
          <div key={i} className="flex items-start gap-3 p-3.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${sev.cls}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-700">{a.title}</p>
              <p className="text-xs text-slate-500 mt-0.5">{a.text}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}