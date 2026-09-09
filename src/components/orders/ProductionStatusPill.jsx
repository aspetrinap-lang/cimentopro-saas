import { productionMetrics } from '@/lib/productionMetrics';

// Pill de desempenho produtivo: Atingimento da Meta (%) + status derivado
// (Excedente de produção / Meta atingida / Abaixo da meta / Produção crítica)
export default function ProductionStatusPill({ order }) {
  const { achievementPct, status } = productionMetrics(order);
  if (achievementPct == null || !status) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const pct = achievementPct.toFixed(1).replace('.', ',');
  return (
    <div className="flex flex-col items-start gap-0.5">
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${status.pill}`}>
        {pct}%
      </span>
      <span className={`text-[10px] font-medium whitespace-nowrap ${status.text}`}>
        {status.label}
      </span>
    </div>
  );
}