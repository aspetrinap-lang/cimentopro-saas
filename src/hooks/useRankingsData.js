import { useMemo } from 'react';
import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';
import { computeStats, theoreticalForOrder, orderLostCost } from '@/lib/statsUtils';

// Hook compartilhado: calcula os 4 rankings a partir das ordens concluídas.
// Reaproveita exatamente a lógica que existia em StatsRankings.
export function useRankingsData(orders, ptMap, traceMap, costs) {
  return useMemo(() => {
    const byProduct = {};
    const byMachine = {};
    const lots = [];

    orders.forEach(o => {
      if (o.actual_quantity <= 0) return;
      const qty = o.actual_quantity;
      const pname = o.product_type_name || 'Desconhecido';
      const mname = o.machine_name || 'Sem máquina';

      if (!byProduct[pname]) {
        byProduct[pname] = { name: pname, perUnitSum: 0, n: 0, qty: 0, cvs: [] };
        INSUMO_KEYS.forEach(k => { byProduct[pname][k] = []; });
      }
      byProduct[pname].qty += qty;
      byProduct[pname].n += 1;
      let totalPerUnit = 0;
      INSUMO_KEYS.forEach(k => {
        const v = (o[INSUMO_FIELDS[k].actual] || 0) / qty;
        if (v > 0) { byProduct[pname][k].push(v); totalPerUnit += v * (costs[k] || 0); }
      });
      byProduct[pname].perUnitSum += totalPerUnit;

      if (!byMachine[mname]) byMachine[mname] = { name: mname, n: 0, devs: [] };
      byMachine[mname].n += 1;
      let sumTheo = 0, sumReal = 0;
      INSUMO_KEYS.forEach(k => {
        sumReal += o[INSUMO_FIELDS[k].actual] || 0;
        sumTheo += theoreticalForOrder(o, k, ptMap, traceMap);
      });
      if (sumTheo > 0) byMachine[mname].devs.push(((sumReal - sumTheo) / sumTheo) * 100);

      const lostCost = orderLostCost(o, costs);
      if (lostCost > 0) lots.push({ label: `${o.order_number || pname} — ${o.production_date?.slice(8, 10)}/${o.production_date?.slice(5, 7)}`, product: pname, cost: lostCost });
    });

    const products = Object.values(byProduct).map(p => {
      const cvs = [];
      INSUMO_KEYS.forEach(k => { const s = computeStats(p[k]); if (s && s.count >= 2) cvs.push(s.cv); });
      const avgCV = cvs.length ? cvs.reduce((a, b) => a + b, 0) / cvs.length : null;
      return { name: p.name, avgCostPerUnit: p.n ? p.perUnitSum / p.n : 0, avgCV };
    });

    const machines = Object.values(byMachine).map(m => {
      const s = computeStats(m.devs);
      return { name: m.name, avgDev: s ? s.mean : 0, n: m.n };
    });

    return {
      topConsumers: [...products].sort((a, b) => b.avgCostPerUnit - a.avgCostPerUnit),
      mostStable: [...products].filter(p => p.avgCV != null).sort((a, b) => a.avgCV - b.avgCV),
      topMachineDev: [...machines].filter(m => m.avgDev !== 0 || m.n > 0).sort((a, b) => Math.abs(b.avgDev) - Math.abs(a.avgDev)),
      worstLots: [...lots].sort((a, b) => b.cost - a.cost),
    };
  }, [orders, ptMap, traceMap, costs]);
}