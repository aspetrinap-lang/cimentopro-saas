import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';
import { useInsumoCosts } from '@/hooks/useInsumoCosts';
import { useInsumoNames } from '@/hooks/useInsumoNames';
import { AlertTriangle, TrendingDown, Gauge, TrendingUp, DollarSign, PiggyBank, CalendarClock, Siren, ChevronRight, Sparkles, Lightbulb } from 'lucide-react';

const PRIORITY = {
  critical: { label: 'Crítico',  border: 'border-l-red-500',     badge: 'bg-red-100 text-red-700',     accent: 'text-red-600' },
  high:     { label: 'Alto',     border: 'border-l-orange-500',  badge: 'bg-orange-100 text-orange-700', accent: 'text-orange-600' },
  medium:   { label: 'Médio',    border: 'border-l-amber-500',   badge: 'bg-amber-100 text-amber-700', accent: 'text-amber-600' },
  good:     { label: 'Positivo', border: 'border-l-green-500',   badge: 'bg-green-100 text-green-700', accent: 'text-green-600' },
  info:     { label: 'Info',     border: 'border-l-blue-500',   badge: 'bg-blue-100 text-blue-700',  accent: 'text-blue-600' },
};

const fmtBRL = v => v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }) : '—';
const fmtNum = v => v != null ? v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—';
const fmtMin = min => min < 60 ? `${Math.round(min)}min` : `${Math.floor(min / 60)}h ${Math.round(min % 60)}min`;

export default function ExecutiveSummary({ orders, downtimes, machines, period }) {
  const navigate = useNavigate();
  const { costs } = useInsumoCosts();
  const { names } = useInsumoNames();
  const [molds, setMolds] = useState([]);

  useEffect(() => { base44.entities.Mold.list('name').then(setMolds); }, []);

  const concluded = orders.filter(o => o.status === 'Concluída');

  // 1. Principais Problemas
  const catTotals = {};
  downtimes.forEach(d => { const c = d.failure_category || 'Outros'; catTotals[c] = (catTotals[c] || 0) + (d.duration_minutes || 0); });
  const topCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 2);
  const cancelledCount = orders.filter(o => o.status === 'Cancelada').length;
  const problemParts = [];
  if (topCats[0]) problemParts.push(`${topCats[0][0]} lidera paradas (${fmtMin(topCats[0][1])})`);
  if (topCats[1]) problemParts.push(`${topCats[1][0]} (${fmtMin(topCats[1][1])})`);
  if (cancelledCount > 0) problemParts.push(`${cancelledCount} ordem(ns) cancelada(s)`);
  const problemsText = problemParts.length ? problemParts.join('; ') + '.' : 'Nenhum problema relevante no período.';
  const problemsPriority = problemParts.length > 0 ? 'high' : 'good';
  const problemsSolution = topCats[0]
    ? `Investigar causa-raiz de "${topCats[0][0]}": inspecionar componentes e agendar preventiva específica.`
    : 'Manter rotina de manutenção preventiva atual.';

  // 2. Maiores Desperdícios
  const wasteByInsumo = {};
  concluded.forEach(o => {
    INSUMO_KEYS.forEach(key => {
      const { planned, actual } = INSUMO_FIELDS[key];
      const p = o[planned] || 0, a = o[actual] || 0;
      if (a > p && a > 0) {
        const kg = a - p;
        if (!wasteByInsumo[key]) wasteByInsumo[key] = { kg: 0, cost: 0 };
        wasteByInsumo[key].kg += kg;
        wasteByInsumo[key].cost += kg * (costs[key] || 0);
      }
    });
  });
  const topWaste = Object.entries(wasteByInsumo).sort((a, b) => b[1].cost - a[1].cost).slice(0, 3);
  const wasteText = topWaste.length
    ? topWaste.map(([k, w]) => `${names[k]}: ${fmtNum(w.kg)}kg excedente${w.cost > 0 ? ` (${fmtBRL(w.cost)})` : ''}`).join('; ') + '.'
    : 'Sem desperdícios registrados no período.';
  const wastePriority = topWaste.length > 0 ? 'high' : 'good';
  const wasteSolution = topWaste.length
    ? `Revisar calibração do dosador de ${names[topWaste[0][0]]} e conferir o traço cadastrado — maior fonte de perda.`
    : 'Consumo dentro do planejado. Manter monitoramento.';

  // 3. Máquinas Abaixo da Meta
  const TARGET = 85;
  const machineAvail = machines.map(m => {
    const dtMin = downtimes.filter(d => d.machine_id === m.id).reduce((s, d) => s + (d.duration_minutes || 0), 0);
    const prodMin = orders.filter(o => o.machine_id === m.id).reduce((s, o) => s + (o.production_minutes || 0), 0);
    const total = dtMin + prodMin;
    return { name: m.name, avail: total > 0 ? (prodMin / total) * 100 : null };
  }).filter(m => m.avail !== null);
  const belowTarget = machineAvail.filter(m => m.avail < TARGET).sort((a, b) => a.avail - b.avail);
  const machinesText = belowTarget.length
    ? belowTarget.slice(0, 3).map(m => `${m.name}: ${Math.round(m.avail)}% (meta ${TARGET}%)`).join('; ') + '.'
    : 'Todas as máquinas acima da meta de disponibilidade.';
  const machinesPriority = belowTarget.length > 0 ? (belowTarget[0].avail < 60 ? 'critical' : 'high') : 'good';
  const machinesSolution = belowTarget.length
    ? `Priorizar ${belowTarget[0].name}: aplicar plano de manutenção corretiva e reavaliar intervalos preventivos.`
    : 'Disponibilidade saudável. Continuar com o plano preventivo atual.';

  // 4 & 5. Produtos (custo unitário)
  const productStats = {};
  concluded.forEach(o => {
    const name = o.product_type_name; if (!name) return;
    if (!productStats[name]) productStats[name] = { cost: 0, qty: 0 };
    INSUMO_KEYS.forEach(key => {
      const { actual } = INSUMO_FIELDS[key];
      productStats[name].cost += (o[actual] || 0) * (costs[key] || 0);
    });
    productStats[name].qty += o.actual_quantity || 0;
  });
  const productUnitCosts = Object.entries(productStats)
    .map(([name, s]) => ({ name, unitCost: s.qty > 0 ? s.cost / s.qty : 0 }))
    .filter(p => p.unitCost > 0)
    .sort((a, b) => a.unitCost - b.unitCost);
  const mostProfitable = productUnitCosts.slice(0, 2);
  const mostExpensive = [...productUnitCosts].reverse().slice(0, 2);
  const profitText = mostProfitable.length ? mostProfitable.map(p => `${p.name}: ${fmtBRL(p.unitCost)}/un`).join('; ') + '.' : 'Dados insuficientes para análise de lucratividade.';
  const costText = mostExpensive.length ? mostExpensive.map(p => `${p.name}: ${fmtBRL(p.unitCost)}/un`).join('; ') + '.' : 'Dados insuficientes para análise de custo.';
  const profitSolution = mostProfitable.length ? 'Priorizar este(s) produto(s) na carteira de pedidos — melhor margem.' : 'Aguardar mais ordens concluídas para análise.';
  const costSolution = mostExpensive.length ? `Revisar traço/rendimento de ${mostExpensive[0].name} — pode estar acima do ideal.` : 'Aguardar mais ordens concluídas para análise.';

  // 6. Economia Obtida
  let totalSavings = 0, savingsCount = 0;
  concluded.forEach(o => {
    INSUMO_KEYS.forEach(key => {
      const { planned, actual } = INSUMO_FIELDS[key];
      const p = o[planned] || 0, a = o[actual] || 0;
      if (p > a && p > 0) { totalSavings += (p - a) * (costs[key] || 0); savingsCount++; }
    });
  });
  const savingsText = savingsCount > 0
    ? `${fmtBRL(totalSavings)} economizados — ${savingsCount} insumo(s) abaixo do planejado.`
    : 'Nenhuma economia registrada no período.';
  const savingsSolution = savingsCount > 0 ? 'Padronizar a prática atual como referência de consumo eficiente.' : 'Buscar otimização de traços e calibração para gerar economia.';

  // 7. Previsão de Consumo (7 dias)
  const dailyConsumption = {};
  concluded.forEach(o => {
    INSUMO_KEYS.forEach(key => {
      const { actual } = INSUMO_FIELDS[key];
      dailyConsumption[key] = (dailyConsumption[key] || 0) + (o[actual] || 0);
    });
  });
  const forecast = Object.entries(dailyConsumption)
    .map(([key, total]) => ({ key, name: names[key], forecast7d: period > 0 ? (total / period) * 7 : 0 }))
    .filter(f => f.forecast7d > 0)
    .sort((a, b) => b.forecast7d - a.forecast7d)
    .slice(0, 3);
  const forecastText = forecast.length ? forecast.map(f => `${f.name}: ${fmtNum(f.forecast7d)}kg`).join('; ') + '.' : 'Dados insuficientes para previsão.';
  const forecastSolution = forecast.length ? `Prever reposição de ${forecast[0].name} para evitar ruptura de estoque.` : 'Sem histórico suficiente para prever consumo.';

  // 8. Alertas Críticos
  const alerts = [];
  molds.forEach(m => {
    if (m.max_cycles && m.cycles_used) {
      const pct = (m.cycles_used / m.max_cycles) * 100;
      if (pct >= 80) alerts.push({ text: `Molde ${m.name}: ${Math.round(pct)}% da vida útil`, to: '/molds', priority: pct >= 95 ? 'critical' : 'high' });
    }
    if (m.status === 'Em Manutenção') alerts.push({ text: `Molde ${m.name} em manutenção`, to: '/molds', priority: 'medium' });
  });
  machineAvail.filter(m => m.avail < 60).forEach(m => alerts.push({ text: `${m.name}: ${Math.round(m.avail)}% disponibilidade`, to: '/machines', priority: 'critical' }));
  const catCount = {};
  downtimes.forEach(d => { const c = d.failure_category || 'Outros'; catCount[c] = (catCount[c] || 0) + 1; });
  Object.entries(catCount).forEach(([cat, count]) => { if (count >= 3) alerts.push({ text: `Falhas recorrentes: ${cat} (${count}x)`, to: '/maintenance', priority: 'high' }); });
  if (orders.length === 0) alerts.push({ text: 'Nenhuma ordem no período', to: '/orders', priority: 'critical' });
  if (alerts.length === 0) alerts.push({ text: 'Nenhum alerta crítico no período.', to: '/machines', priority: 'good' });
  const pOrder = { critical: 0, high: 1, medium: 2, good: 3, info: 4 };
  const sortedAlerts = [...alerts].sort((a, b) => pOrder[a.priority] - pOrder[b.priority]);
  const alertsText = sortedAlerts.slice(0, 4).map(a => a.text).join(' · ');
  const alertsPriority = sortedAlerts[0]?.priority || 'good';
  const alertsTo = sortedAlerts[0]?.to || '/machines';
  const alertsSolution = sortedAlerts[0] && sortedAlerts[0].priority !== 'good'
    ? 'Ação imediata recomendada — resolver o item crítico antes de novas ordens.'
    : 'Nenhuma ação urgente necessária.';

  const insights = [
    { icon: AlertTriangle, priority: problemsPriority, title: 'Principais Problemas', text: problemsText, solution: problemsSolution, to: '/maintenance', btnLabel: 'Manutenção' },
    { icon: TrendingDown,  priority: wastePriority,    title: 'Maiores Desperdícios',  text: wasteText,    solution: wasteSolution,    to: '/history',    btnLabel: 'Histórico' },
    { icon: Gauge,         priority: machinesPriority, title: 'Máquinas Abaixo da Meta', text: machinesText, solution: machinesSolution, to: '/machines',  btnLabel: 'Máquinas' },
    { icon: TrendingUp,    priority: mostProfitable.length ? 'good' : 'info', title: 'Produtos Mais Lucrativos', text: profitText, solution: profitSolution, to: '/analysis', btnLabel: 'Análise' },
    { icon: DollarSign,    priority: mostExpensive.length ? 'medium' : 'info', title: 'Produtos com Maior Custo', text: costText, solution: costSolution, to: '/analysis', btnLabel: 'Análise' },
    { icon: PiggyBank,     priority: savingsCount > 0 ? 'good' : 'info', title: 'Economia Obtida', text: savingsText, solution: savingsSolution, to: '/history', btnLabel: 'Histórico' },
    { icon: CalendarClock, priority: 'info',           title: 'Previsão de Consumo (7 dias)', text: forecastText, solution: forecastSolution, to: '/analysis', btnLabel: 'Análise' },
    { icon: Siren,         priority: alertsPriority,   title: 'Alertas Críticos',    text: alertsText,   solution: alertsSolution,  to: alertsTo,      btnLabel: 'Ver Detalhes' },
  ];

  return (
    <section className="rounded-2xl border border-border p-5 shadow-sm bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Resumo Executivo</h2>
          <p className="text-xs text-muted-foreground">Análise automática dos indicadores do período</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {insights.map((item, i) => {
          const p = PRIORITY[item.priority];
          const isPositive = item.priority === 'good' || item.priority === 'info';
          return (
            <div key={i} className={`bg-card rounded-xl border border-border border-l-4 ${p.border} p-4 flex flex-col gap-2.5 shadow-sm hover:shadow-md transition-shadow`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <item.icon className={`w-4 h-4 shrink-0 ${p.accent}`} />
                  <span className="text-xs font-semibold text-foreground truncate">{item.title}</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${p.badge}`}>{p.label}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.text}</p>
              <div className={`flex items-start gap-2 rounded-lg p-2.5 ${isPositive ? 'bg-green-50 dark:bg-green-950/30' : 'bg-amber-50 dark:bg-amber-950/30'}`}>
                <Lightbulb className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isPositive ? 'text-green-600' : 'text-amber-600'}`} />
                <p className="text-[11px] text-foreground leading-snug">{item.solution}</p>
              </div>
              <button onClick={() => navigate(item.to)}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors self-end mt-auto">
                {item.btnLabel} <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}