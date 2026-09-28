import { useRankingsData } from '@/hooks/useRankingsData';
import RankingList from '@/components/stats/RankingList';
import { fmtBRL } from '@/lib/statsUtils';
import { TrendingUp, Trophy, Gauge, AlertTriangle } from 'lucide-react';

// Painel compacto com os 4 rankings (2×2). Sem `limit` mostra todos os itens.
export default function RankingsPanel({ orders, ptMap, traceMap, costs, limit }) {
  const { topConsumers, mostStable, topMachineDev, worstLots } = useRankingsData(orders, ptMap, traceMap, costs);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
      <RankingList
        items={topConsumers}
        icon={TrendingUp}
        title="Maior custo/un"
        render={(it) => fmtBRL(it.avgCostPerUnit)}
        limit={limit}
        emptyText="Sem dados"
      />
      <RankingList
        items={mostStable}
        icon={Trophy}
        title="Mais estáveis (menor CV)"
        render={(it) => (it.avgCV != null ? `${it.avgCV.toFixed(2)}%` : '—')}
        limit={limit}
        emptyText="Sem dados"
      />
      <RankingList
        items={topMachineDev}
        icon={Gauge}
        title="Maior desvio (máquinas)"
        render={(it) => `${it.avgDev > 0 ? '+' : ''}${it.avgDev.toFixed(1)}%`}
        limit={limit}
        emptyText="Sem traços vinculados"
      />
      <RankingList
        items={worstLots}
        icon={AlertTriangle}
        title="Maior desperdício (lotes)"
        render={(it) => fmtBRL(it.cost)}
        limit={limit}
        emptyText="Nenhuma perda registrada"
      />
    </div>
  );
}