import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { fmtBRL, orderLostCost } from '@/lib/statsUtils';
import RankingList from '@/components/stats/RankingList';

const fmtInt = (n) => (Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });

// Ranking de produtos por desperdício: peças de 2ª linha + descartadas,
// com o custo financeiro correspondente. Derivado apenas das ordens reais.
export default function TopWasteProducts({ orders, costs, limit }) {
  const items = useMemo(() => {
    const byProduct = {};
    orders.forEach((o) => {
      const lost = (Number(o.loss_second_line) || 0) + (Number(o.loss_discarded) || 0);
      if (!lost) return;
      const name = o.product_type_name || 'Desconhecido';
      if (!byProduct[name]) byProduct[name] = { name, pieces: 0, cost: 0 };
      byProduct[name].pieces += lost;
      byProduct[name].cost += orderLostCost(o, costs);
    });
    return Object.values(byProduct).sort((a, b) => b.cost - a.cost);
  }, [orders, costs]);

  return (
    <RankingList
      items={items}
      icon={AlertTriangle}
      title="Produtos com maior desperdício"
      render={(it) => `${fmtInt(it.pieces)} pç · ${fmtBRL(it.cost)}`}
      limit={limit}
      emptyText="Nenhuma perda registrada"
    />
  );
}