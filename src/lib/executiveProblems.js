import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';

const fmtMin = (min) =>
  min < 60 ? `${Math.round(min)} min` : `${Math.floor(min / 60)}h ${Math.round(min % 60)}min`;
const fmtNum = (v) => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const fmtBRL = (v) =>
  v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2 };

// Constrói a lista de principais problemas do período a partir dos mesmos
// cálculos do Resumo Executivo (paradas, desperdícios, disponibilidade,
// moldes, falhas recorrentes e cancelamentos).
export function buildProblemsReportData({ orders, downtimes, machines, molds, costs, names }) {
  const TARGET = 85;
  const problems = [];
  const concluded = orders.filter((o) => o.status === 'Concluída');

  // 1. Paradas de máquina por categoria
  const catTotals = {};
  const catCounts = {};
  downtimes.forEach((d) => {
    const c = d.failure_category || 'Outros';
    catTotals[c] = (catTotals[c] || 0) + (d.duration_minutes || 0);
    catCounts[c] = (catCounts[c] || 0) + 1;
  });
  Object.entries(catTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .forEach(([cat, min], i) => {
      problems.push({
        severity: i === 0 ? 'high' : 'medium',
        category: 'Paradas de Máquina',
        title: i === 0 ? `Falhas de ${cat} lideram as paradas do período` : `Paradas de ${cat} também relevantes`,
        description: `${catCounts[cat]} parada(s) registrada(s), totalizando ${fmtMin(min)} de máquina parada.`,
        action: `Investigar causa-raiz das falhas de ${cat}: inspecionar componentes e agendar manutenção preventiva específica.`,
      });
    });

  // 2. Desperdício de insumos (consumo acima do planejado)
  const wasteByInsumo = {};
  concluded.forEach((o) => {
    INSUMO_KEYS.forEach((key) => {
      const { planned, actual } = INSUMO_FIELDS[key];
      const p = o[planned] || 0;
      const a = o[actual] || 0;
      if (a > p && a > 0) {
        if (!wasteByInsumo[key]) wasteByInsumo[key] = { kg: 0, cost: 0 };
        wasteByInsumo[key].kg += a - p;
        wasteByInsumo[key].cost += (a - p) * (costs[key] || 0);
      }
    });
  });
  Object.entries(wasteByInsumo)
    .sort((a, b) => b[1].cost - a[1].cost)
    .slice(0, 3)
    .forEach(([key, w], i) => {
      const label = names[key] || key;
      problems.push({
        severity: i === 0 ? 'high' : 'medium',
        category: 'Desperdício de Insumos',
        title: `Excesso de consumo de ${label}`,
        description: `${fmtNum(w.kg)}kg acima do planejado${w.cost > 0 ? ` — impacto estimado de ${fmtBRL(w.cost)}` : ''}.`,
        action: `Revisar calibração do dosador de ${label} e conferir o traço cadastrado.`,
      });
    });

  // 3. Máquinas abaixo da meta de disponibilidade
  (machines || []).forEach((m) => {
    const dtMin = downtimes.filter((d) => d.machine_id === m.id).reduce((s, d) => s + (d.duration_minutes || 0), 0);
    const prodMin = orders.filter((o) => o.machine_id === m.id).reduce((s, o) => s + (o.production_minutes || 0), 0);
    const total = dtMin + prodMin;
    if (total <= 0) return;
    const avail = (prodMin / total) * 100;
    if (avail < TARGET) {
      problems.push({
        severity: avail < 60 ? 'critical' : 'high',
        category: 'Disponibilidade de Máquinas',
        title: `${m.name} abaixo da meta de disponibilidade`,
        description: `Disponibilidade de ${Math.round(avail)}% no período (meta ${TARGET}%) — ${fmtMin(dtMin)} de paradas.`,
        action: `Priorizar ${m.name}: aplicar plano de manutenção corretiva e reavaliar intervalos preventivos.`,
      });
    }
  });

  // 4. Moldes: vida útil avançada ou em manutenção
  (molds || []).forEach((m) => {
    if (m.max_cycles && m.cycles_used) {
      const pct = (m.cycles_used / m.max_cycles) * 100;
      if (pct >= 80) {
        problems.push({
          severity: pct >= 95 ? 'critical' : 'high',
          category: 'Vida Útil de Moldes',
          title: `Molde ${m.name} com ${Math.round(pct)}% da vida útil consumida`,
          description: `${m.cycles_used} de ${m.max_cycles} ciclos utilizados.`,
          action: 'Programar substituição/renovação do molde antes que a qualidade das peças seja comprometida.',
        });
      }
    }
    if (m.status === 'Em Manutenção') {
      problems.push({
        severity: 'medium',
        category: 'Vida Útil de Moldes',
        title: `Molde ${m.name} em manutenção`,
        description: 'Molde fora da produção enquanto aguarda conclusão da manutenção.',
        action: 'Acompanhar a conclusão da manutenção e reprogramar a produção que dependia do molde.',
      });
    }
  });

  // 5. Falhas recorrentes da mesma categoria
  Object.entries(catCounts).forEach(([cat, count]) => {
    if (count >= 3) {
      problems.push({
        severity: 'high',
        category: 'Falhas Recorrentes',
        title: `Falhas recorrentes de ${cat} (${count} ocorrências)`,
        description: 'Repetição elevada da mesma categoria de falha dentro do período.',
        action: `Analisar o padrão de falha de ${cat} no histórico e agir na causa (peça, processo ou operação).`,
      });
    }
  });

  // 6. Ordens canceladas
  const cancelled = orders.filter((o) => o.status === 'Cancelada').length;
  if (cancelled > 0) {
    problems.push({
      severity: 'medium',
      category: 'Ordens de Produção',
      title: `${cancelled} ordem(ns) cancelada(s) no período`,
      description: 'Cancelamentos indicam retrabalho, perda de planejamento ou falhas de processo.',
      action: 'Revisar os motivos dos cancelamentos com a equipe de produção.',
    });
  }

  problems.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  return {
    problems,
    summary: {
      total: problems.length,
      critical: problems.filter((p) => p.severity === 'critical').length,
      high: problems.filter((p) => p.severity === 'high').length,
      medium: problems.filter((p) => p.severity === 'medium').length,
    },
  };
}