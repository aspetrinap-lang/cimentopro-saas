import { useMemo } from 'react';
import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';
import { computeStats, theoreticalForOrder, fmtNum, fmtBRL } from '@/lib/statsUtils';
import { Trophy, TrendingUp, Gauge, AlertTriangle } from 'lucide-react';

export default function StatsRankings({ orders, ptMap, traceMap, names, costs }) {
  const data = useMemo(() => {
    // Por produto
    const byProduct = {};
    // Por máquina
    const byMachine = {};
    // Por lote (ordem) desperdício
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

      if (!byMachine[mname]) {
        byMachine[mname] = { name: mname, n: 0, devs: [] };
      }
      byMachine[mname].n += 1;
      let sumTheo = 0, sumReal = 0;
      INSUMO_KEYS.forEach(k => {
        sumReal += o[INSUMO_FIELDS[k].actual] || 0;
        sumTheo += theoreticalForOrder(o, k, ptMap, traceMap);
      });
      if (sumTheo > 0) byMachine[mname].devs.push(((sumReal - sumTheo) / sumTheo) * 100);

      // desperdício do lote (excesso)
      let excessCost = 0;
      INSUMO_KEYS.forEach(k => {
        const real = o[INSUMO_FIELDS[k].actual] || 0;
        const theo = theoreticalForOrder(o, k, ptMap, traceMap);
        if (theo > 0 && real > theo) excessCost += (real - theo) * (costs[k] || 0);
      });
      if (excessCost > 0) lots.push({ label: `${o.order_number || pname} — ${o.production_date?.slice(8, 10)}/${o.production_date?.slice(5, 7)}`, product: pname, cost: excessCost });
    });

    const products = Object.values(byProduct).map(p => {
      // CV só faz sentido com pelo menos 2 amostras por insumo
      const cvs = [];
      INSUMO_KEYS.forEach(k => { const s = computeStats(p[k]); if (s && s.count >= 2) cvs.push(s.cv); });
      const avgCV = cvs.length ? cvs.reduce((a, b) => a + b, 0) / cvs.length : null;
      // Custo/un = média do custo por unidade entre as ordens (não dividir pela qty total)
      return { name: p.name, avgCostPerUnit: p.n ? p.perUnitSum / p.n : 0, avgCV };
    });

    const machines = Object.values(byMachine).map(m => {
      const s = computeStats(m.devs);
      return { name: m.name, avgDev: s ? s.mean : 0, n: m.n };
    });

    return {
      topConsumers: [...products].sort((a, b) => b.avgCostPerUnit - a.avgCostPerUnit).slice(0, 5),
      mostStable: [...products].filter(p => p.avgCV != null).sort((a, b) => a.avgCV - b.avgCV).slice(0, 5),
      topMachineDev: [...machines].filter(m => m.avgDev !== 0 || m.n > 0).sort((a, b) => Math.abs(b.avgDev) - Math.abs(a.avgDev)).slice(0, 5),
      worstLots: [...lots].sort((a, b) => b.cost - a.cost).slice(0, 5),
    };
  }, [orders, ptMap, traceMap, costs]);

  const Card = ({ title, icon: Icon, items, render, emptyText }) => (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-primary" />
        <h4 className="text-xs font-semibold text-foreground">{title}</h4>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">{emptyText}</p>
      ) : (
        <ol className="space-y-1.5">
          {items.map((it, i) => (
            <li key={i} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-2 min-w-0">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <span className="text-foreground truncate">{it.name || it.label}</span>
              </span>
              <span className="font-semibold text-muted-foreground whitespace-nowrap">{render(it)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <Card title="Produtos com maior custo/un" icon={TrendingUp}
        items={data.topConsumers}
        render={it => fmtBRL(it.avgCostPerUnit)}
        emptyText="Sem dados" />
      <Card title="Produtos mais estáveis (menor CV)" icon={Trophy}
        items={data.mostStable}
        render={it => it.avgCV != null ? `${it.avgCV.toFixed(2)}%` : '—'}
        emptyText="Sem dados" />
      <Card title="Máquinas com maior desvio" icon={Gauge}
        items={data.topMachineDev}
        render={it => `${it.avgDev > 0 ? '+' : ''}${it.avgDev.toFixed(1)}%`}
        emptyText="Sem traços vinculados" />
      <Card title="Lotes com maior desperdício" icon={AlertTriangle}
        items={data.worstLots}
        render={it => fmtBRL(it.cost)}
        emptyText="Nenhum excesso registrado" />
    </div>
  );
}