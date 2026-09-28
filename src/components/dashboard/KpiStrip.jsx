import { useMemo } from 'react';
import { Package, Target, Gauge, Timer, TrendingUp, AlertTriangle, PlayCircle, Coins, Factory } from 'lucide-react';
import KpiCard from './KpiCard';
import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';
import { theoreticalForOrder, fmtBRL } from '@/lib/statsUtils';

const fmtInt = (n) => (Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const fmtPct = (v, dec = 1) => v == null || !isFinite(v) ? '—' : `${v.toFixed(dec).replace('.', ',')}%`;

// Métricas de um conjunto de ordens (período atual OU período anterior).
// Deriva tudo dos dados já carregados — sem novas consultas.
function computeMetrics(orders, ptMap, traceMap, costs) {
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
  let forecastCalculated = 0;
  inProgress.forEach((o) => {
    const pt = ptMap[o.product_type_id];
    if (!pt) return;
    const remaining = Math.max((Number(o.planned_quantity) || 0) - (Number(o.actual_quantity) || 0), 0);
    const hasStandard = INSUMO_KEYS.some((k) => Number(pt[INSUMO_FIELDS[k].pt_field]) > 0);
    if (!hasStandard || remaining <= 0) return;
    forecastCalculated += 1;
    INSUMO_KEYS.forEach((k) => {
      const perUnit = Number(pt[INSUMO_FIELDS[k].pt_field]) || 0;
      forecastCost += remaining * perUnit * (costs[k] || 0);
    });
  });

  const machinesInOp = new Set(concluded.filter((o) => o.machine_id).map((o) => o.machine_id)).size;

  return {
    concludedCount: concluded.length, produced, planned, efficiency,
    minutes, productivity, deviation, lost, lossCost, lossPct,
    ipCount, ipRemaining, forecastCost, forecastCalculated, machinesInOp,
  };
}

// Variação % contra o período anterior — só existe com base válida (anterior ≠ 0/nulo).
const pctDelta = (cur, prev) => (cur == null || prev == null || prev === 0) ? null : ((cur - prev) / Math.abs(prev)) * 100;
// Variação em pontos percentuais (indicadores que já são %, como eficiência e desvio).
const ppDelta = (cur, prev) => (cur == null || prev == null) ? null : cur - prev;

// Duas faixas de KPIs do Centro de Controle: produção (5 cartões) e
// operação (4 cartões). Variações comparadas ao período anterior de mesma
// duração (prevOrders), exibidas apenas quando há base de comparação.
export default function KpiStrip({ orders, prevOrders = [], machines = [], ptMap, traceMap, costs }) {
  const cur = useMemo(() => computeMetrics(orders, ptMap, traceMap, costs), [orders, ptMap, traceMap, costs]);
  const prev = useMemo(() => computeMetrics(prevOrders, ptMap, traceMap, costs), [prevOrders, ptMap, traceMap, costs]);
  const noData = cur.concludedCount === 0;

  const dProd = pctDelta(cur.produced, prev.produced);
  const dPlanned = pctDelta(cur.planned, prev.planned);
  const dEff = ppDelta(cur.efficiency, prev.efficiency);
  const dProductivity = pctDelta(cur.productivity, prev.productivity);
  const dDev = ppDelta(cur.deviation, prev.deviation);
  const dLost = pctDelta(cur.lost, prev.lost);
  const dIp = pctDelta(cur.ipCount, prev.ipCount);
  const dForecast = pctDelta(cur.forecastCost, prev.forecastCost);
  const dMach = pctDelta(cur.machinesInOp, prev.machinesInOp);

  const band1 = [
    {
      icon: Package, label: 'Produção Total',
      value: noData ? '—' : fmtInt(cur.produced),
      sub: noData ? 'Sem dados no período' : `${cur.concludedCount} ordens concluídas`,
      delta: dProd != null ? { value: dProd, unit: '%', goodWhen: 'up' } : null,
    },
    {
      icon: Target, label: 'Meta de Produção',
      value: noData ? '—' : fmtInt(cur.planned),
      sub: noData ? 'Sem dados no período' : (cur.efficiency != null ? `${fmtPct(cur.efficiency)} da meta` : '—'),
      delta: dPlanned != null ? { value: dPlanned, unit: '%', goodWhen: 'neutral' } : null,
    },
    {
      icon: Gauge, label: 'Eficiência',
      value: cur.efficiency != null ? fmtPct(cur.efficiency) : '—',
      sub: noData ? 'Sem dados no período' : 'produzido ÷ planejado',
      delta: dEff != null ? { value: dEff, unit: ' pp', goodWhen: 'up' } : null,
    },
    {
      icon: Timer, label: 'Produtividade',
      value: cur.productivity != null ? `${fmtInt(cur.productivity)} un/h` : '—',
      sub: noData ? 'Sem dados no período' : `${fmtInt(cur.minutes)} min em produção`,
      delta: dProductivity != null ? { value: dProductivity, unit: '%', goodWhen: 'up' } : null,
    },
    {
      icon: TrendingUp, label: 'Desvio de Consumo',
      value: cur.deviation != null ? `${cur.deviation > 0 ? '+' : ''}${fmtPct(cur.deviation)}` : '—',
      sub: noData ? 'Sem dados no período' : 'real vs. teórico',
      valueTone: cur.deviation == null ? null : cur.deviation > 0 ? 'bad' : 'good',
      delta: dDev != null ? { value: dDev, unit: ' pp', goodWhen: 'down' } : null,
    },
  ];

  const band2 = [
    {
      icon: AlertTriangle, iconTone: 'amber', label: 'Desperdício',
      value: noData ? '—' : fmtInt(cur.lost),
      sub: noData ? 'Sem dados no período' : `${cur.lossPct != null ? fmtPct(cur.lossPct) : '—'} da produção · ${fmtBRL(cur.lossCost)}`,
      delta: dLost != null ? { value: dLost, unit: '%', goodWhen: 'down' } : null,
    },
    {
      icon: PlayCircle, label: 'Ordens em Andamento',
      value: fmtInt(cur.ipCount),
      sub: cur.ipCount > 0 ? `${fmtInt(cur.ipRemaining)} un. restantes` : 'Nenhuma ordem em produção',
      delta: dIp != null ? { value: dIp, unit: '%', goodWhen: 'neutral' } : null,
    },
    {
      icon: Coins, label: 'Consumo Previsto',
      value: fmtBRL(cur.forecastCost),
      sub: cur.ipCount > 0 ? `${fmtInt(cur.ipRemaining)} un. restantes · ${cur.forecastCalculated} ordens` : 'Sem ordens em andamento',
      delta: dForecast != null ? { value: dForecast, unit: '%', goodWhen: 'neutral' } : null,
    },
    {
      icon: Factory, label: 'Máquinas em Operação',
      value: noData ? '—' : fmtInt(cur.machinesInOp),
      sub: noData ? 'Sem dados no período' : `de ${machines.length} ativas`,
      delta: dMach != null ? { value: dMach, unit: '%', goodWhen: 'neutral' } : null,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {band1.map((k, i) => <KpiCard key={i} {...k} />)}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {band2.map((k, i) => <KpiCard key={i} {...k} />)}
      </div>
    </div>
  );
}