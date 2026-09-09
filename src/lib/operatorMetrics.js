import { format, subDays, eachDayOfInterval, startOfWeek, differenceInCalendarDays } from 'date-fns';

// Agregado de uma lista de ordens (peças, ciclos, minutos e taxas horárias)
function dayAgg(orders) {
  const pieces = orders.reduce((s, o) => s + (Number(o.actual_quantity) || 0), 0);
  const cycles = orders.reduce((s, o) => s + (Number(o.machine_cycles_actual) || 0), 0);
  const minutes = orders.reduce((s, o) => s + (Number(o.production_minutes) || 0), 0);
  const hours = minutes / 60;
  return {
    pieces,
    cycles,
    minutes,
    hours,
    piecesPerHour: hours > 0 ? pieces / hours : 0,
    cyclesPerHour: hours > 0 ? cycles / hours : 0,
    avgCycleMin: cycles > 0 ? minutes / cycles : 0,
  };
}

// Monta os dados do Painel do Operador para um período arbitrário (startDate/endDate, YYYY-MM-DD).
// Cards por Linha de Produção (somando máquina principal + secundárias de Produção);
// máquinas de Produção sem linha viram um card individual. Máquinas de Movimentação são excluídas.
// Aceita computeStats injetado para facilitar teste puro.
export function buildOperatorPanelData({ machines, orders, downtimes, lines }, computeStats, { startDate, endDate } = {}) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const end = endDate || today;
  const start = startDate || format(subDays(new Date(), 6), 'yyyy-MM-dd');
  const totalDays = differenceInCalendarDays(new Date(end + 'T00:00:00'), new Date(start + 'T00:00:00')) + 1;

  // Período anterior de mesma duração — base de comparação (Trend)
  const prevEnd = format(subDays(new Date(start + 'T00:00:00'), 1), 'yyyy-MM-dd');
  const prevStart = format(subDays(new Date(prevEnd + 'T00:00:00'), totalDays - 1), 'yyyy-MM-dd');
  const inRange = (d) => !!d && d >= start && d <= end;
  const inPrev = (d) => !!d && d >= prevStart && d <= prevEnd;

  const prodMachines = (machines || []).filter((m) => m.machine_type !== 'Movimentação');
  const prodIds = new Set(prodMachines.map((m) => m.id));

  // Unidades de exibição: uma por linha, mais uma por máquina Produção sem linha
  const units = [];
  const assigned = new Set();
  (lines || []).forEach((line) => {
    const ids = (line.machines || []).map((m) => m.machine_id).filter((id) => id && prodIds.has(id));
    if (!ids.length) return;
    ids.forEach((id) => assigned.add(id));
    units.push({ id: line.id, name: line.name, machineIds: ids, target: Number(line.target_cycles_per_hour) || 0, isLine: true });
  });
  prodMachines.forEach((m) => {
    if (!assigned.has(m.id)) {
      units.push({ id: m.id, name: m.name, machineIds: [m.id], target: 0, isLine: false });
    }
  });

  const dayList = eachDayOfInterval({ start: new Date(start + 'T00:00:00'), end: new Date(end + 'T00:00:00') });
  // Períodos longos (> 31 dias) agregam a série por semana
  const weekly = dayList.length > 31;

  const cards = units.map((unit) => {
    const ids = new Set(unit.machineIds);
    const unitOrders = (orders || []).filter((o) => ids.has(o.machine_id));
    const rangeOrders = unitOrders.filter((o) => inRange(o.production_date));
    const prevOrders = unitOrders.filter((o) => inPrev(o.production_date));

    const period = dayAgg(rangeOrders);
    period.ordersCount = rangeOrders.length;
    const prev = dayAgg(prevOrders);

    // Série para o gráfico: barras diárias (ou semanais em períodos longos)
    let series;
    if (weekly) {
      const buckets = [];
      const byWeek = {};
      dayList.forEach((d) => {
        const ds = format(d, 'yyyy-MM-dd');
        const wk = format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        if (!byWeek[wk]) {
          byWeek[wk] = { date: wk, label: format(new Date(wk + 'T00:00:00'), 'dd/MM'), pieces: 0, minutes: 0 };
          buckets.push(byWeek[wk]);
        }
        const agg = dayAgg(unitOrders.filter((o) => o.production_date === ds));
        byWeek[wk].pieces += agg.pieces;
        byWeek[wk].minutes += agg.minutes;
      });
      series = buckets.map((b) => ({
        date: b.date,
        label: b.label,
        pieces: b.pieces,
        piecesPerHour: b.minutes > 0 ? b.pieces / (b.minutes / 60) : 0,
      }));
    } else {
      series = dayList.map((d) => {
        const ds = format(d, 'yyyy-MM-dd');
        const agg = dayAgg(unitOrders.filter((o) => o.production_date === ds));
        return { date: ds, label: format(d, 'dd/MM'), pieces: agg.pieces, piecesPerHour: agg.piecesPerHour };
      });
    }

    // Desvio padrão das taxas diárias com produção no período
    const stats = computeStats
      ? computeStats(series.filter((s) => s.pieces > 0).map((s) => s.piecesPerHour))
      : null;

    const dt = (downtimes || []).filter((d) => ids.has(d.machine_id) && inRange(d.date));
    const downtimeMinutes = dt.reduce((s, d) => s + (Number(d.duration_minutes) || 0), 0);

    const performance =
      unit.target > 0 && period.cyclesPerHour > 0 ? (period.cyclesPerHour / unit.target) * 100 : null;

    return {
      id: unit.id,
      name: unit.name,
      isLine: unit.isLine,
      period,
      prev,
      series,
      stdDevPPH: stats && stats.count > 1 ? stats.stdDev : 0,
      downtimeCount: dt.length,
      downtimeMinutes,
      target: unit.target,
      performance,
      hasProduction: period.pieces > 0 || period.cycles > 0 || period.minutes > 0,
      orders: rangeOrders.slice(0, 100),
    };
  });

  return { start, end, today, cards };
}