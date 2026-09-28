import { TrendingUp } from 'lucide-react';
import { fmtBRL } from '@/lib/statsUtils';
import { useRankingsData } from '@/hooks/useRankingsData';
import RankingList from '@/components/stats/RankingList';

export default function TopCostProducts({ orders, ptMap, traceMap, costs, limit }) {
  const { topConsumers } = useRankingsData(orders, ptMap, traceMap, costs);
  return (
    <RankingList
      items={topConsumers}
      icon={TrendingUp}
      title="Produtos com maior custo/un"
      render={it => fmtBRL(it.avgCostPerUnit)}
      limit={limit}
      emptyText="Sem dados"
    />
  );
}