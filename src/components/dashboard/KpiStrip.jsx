import { useMemo } from 'react';
import { Package, Target, Gauge, Timer, TrendingUp, AlertTriangle, PlayCircle, Coins } from 'lucide-react';
import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';
import { theoreticalForOrder, fmtBRL } from '@/lib/statsUtils';

const fmtInt = (n) => (Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const fmtPct = (v, dec = 1) => v == null || !isFinite(v) ? '—' : `${v.toFixed(dec).replace('.', ',')}%`;

// Faixa de 8 KPIs do Centro de Controle. Deriva tudo dos dados já carregados
// (orders + ptMap + traceMap + costs) — sem novas consultas. Comparações apenas
// contra bases naturais (% meta, real vs. teórico).
export default function KpiStrip({ orders, ptMap, traceMap, costs }) {
  const kpis = useMemo(() => {
    const concluded = orders.filter((o) => o.status === 'Concluída');
    const inProgress = orders.filter((o) => o.status === 'Em Andamento');

    const produced = concluded.reduce((s, o) => s + (Number(o.actual_quantity) || 0), 0);
    const planned = concluded.reduce((s, o) => s + (Number(o.planned_quantity) || 0), 0);
    const efficiency = planned > 0 ? (produced / planned) * 100 : null;

    const minutes = concluded.reduce((s, o) => s + (Number(o.production_minutes) || 0), 0);
    const productivity = minutes > 0 ? (produced / minutes) * 60 : null;

    let sumReal = 0, sumTheo = 0;
    concluded.forEach((o) => {
      INSUMO_KEYS.forEach((k) => {
        sumReal += Number(o[INSUMO_FIELDS[k].actual]) || 0;
        sumTheo += theoreticalForOrder(o, k, ptMap, traceMap);
      });
    });
    const deviation = sumTheo > 0 ? ((sumReal - sumTheo) / sumTheo) * 100 : null;

    const lost = concluded.reduce((s, o) => s + (Number(o.loss_second_line) || 0) + (Number(o.loss_discarded) || 0), 0);
    const lossCost = concluded.reduce((acc, o) => {
      const l = (Number(o.loss_second_line) || 0) + (Number(o.loss_discarded) || 0);
      if (!l) return acc;
      const orderCost = INSUMO_KEYS.reduce((s, k) => s + ((Number(o[INSUMO_FIELDS[k].actual]) || 0) * (costs[k] || 0)), 0);
      const unitCost = o.actual_quantity > 0 ? orderCost / o.actual_quantity : 0;
      return acc + l * unitCost;
    }, 0);
    const lossPct = produced > 0 ? (lost / produced) * 100 : null;

    const ipCount = inProgress.length;
    const ipRemaining = inProgress.reduce((s, o) => {
      const rem = (Number(o.planned_quantity) || 0) - (Number(o.actual_quantity) || 0);
      return s + Math.max(rem, 0);
    }, 0);

    let forecastCost = 0;
    inProgress.forEach((o) => {
      const pt = ptMap[o.product_type_id];
      if (!pt) return;
      const remaining = Math.max((Number(o.planned_quantity) || 0) - (Number(o.actual_quantity) || 0), 0);
      if (remaining <= 0) return;
      INSUMO_KEYS.forEach((k) => {
        const perUnit = Number(pt[INSUMO_FIELDS[k].pt_field]) || 0;
        forecastCost += remaining * perUnit * (costs[k] || 0);
      });
    });

    return [
      { icon: Package, label: 'Produção Total', value: fmtInt(produced), sub: `${concluded.length} ordens concluídas` },
      { icon: Target, label: 'Meta de Produção', value: fmtInt(planned), sub: efficiency != null ? `${fmtPct(efficiency)} da meta` : '—' },
      { icon: Gauge, label: 'Eficiência', value: efficiency != null ? fmtPct(efficiency) : '—', sub: 'produzido ÷ planejado' },
      { icon: Timer, label: 'Produtividade', value: productivity != null ? `${fmtInt(productivity)} un/h` : '—', sub: `${fmtInt(minutes)} min em produção` },
      { icon: TrendingUp, label: 'Desvio de Consumo', value: deviation != null ? `${deviation > 0 ? '+' : ''}${fmtPct(deviation)}` : '—', sub: 'real vs. teórico' },
      { icon: AlertTriangle, label: 'Desperdício', value: fmtInt(lost), sub: `${lossPct != null ? fmtPct(lossPct) : '—'} · ${fmtBRL(lossCost)}` },
      { icon: PlayCircle, label: 'Ordens em Andamento', value: fmtInt(ipCount), sub: `${fmtInt(ipRemaining)} un. restantes` },
      { icon: Coins, label: 'Consumo Previsto', value: fmtBRL(forecastCost), sub: 'ordens em andamento' },
    ];
  }, [orders, ptMap, traceMap, costs]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {kpis.map((k, i) => {
        const Icon = k.icon;
        return (
          <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{k.label}</p>
              <p className="text-xl font-bold text-slate-800 mt-0.5 leading-tight">{k.value}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug truncate">{k.sub}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}