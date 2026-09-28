import { AlertTriangle } from 'lucide-react';
import { fmtBRL } from '@/lib/statsUtils';
import { useRankingsData } from '@/hooks/useRankingsData';
import RankingList from '@/components/stats/RankingList';

export default function TopWasteLots({ orders, ptMap, traceMap, costs, limit }) {
  const { worstLots } = useRankingsData(orders, ptMap, traceMap, costs);
  return (
    <RankingList
      items={worstLots}
      icon={AlertTriangle}
      title="Lotes com maior desperdício"
      render={it => fmtBRL(it.cost)}
      limit={limit}
      emptyText="Nenhuma perda registrada"
    />
  );
}