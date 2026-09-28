import { Gauge } from 'lucide-react';
import { useRankingsData } from '@/hooks/useRankingsData';
import RankingList from '@/components/stats/RankingList';

export default function TopMachineDeviation({ orders, ptMap, traceMap, costs, limit }) {
  const { topMachineDev } = useRankingsData(orders, ptMap, traceMap, costs);
  return (
    <RankingList
      items={topMachineDev}
      icon={Gauge}
      title="Máquinas com maior desvio"
      render={it => `${it.avgDev > 0 ? '+' : ''}${it.avgDev.toFixed(1)}%`}
      limit={limit}
      emptyText="Sem traços vinculados"
    />
  );
}