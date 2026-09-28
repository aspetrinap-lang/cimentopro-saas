import { Trophy } from 'lucide-react';
import { useRankingsData } from '@/hooks/useRankingsData';
import RankingList from '@/components/stats/RankingList';

export default function MostStableProducts({ orders, ptMap, traceMap, costs, limit }) {
  const { mostStable } = useRankingsData(orders, ptMap, traceMap, costs);
  return (
    <RankingList
      items={mostStable}
      icon={Trophy}
      title="Produtos mais estáveis (menor CV)"
      render={it => it.avgCV != null ? `${it.avgCV.toFixed(2)}%` : '—'}
      limit={limit}
      emptyText="Sem dados"
    />
  );
}