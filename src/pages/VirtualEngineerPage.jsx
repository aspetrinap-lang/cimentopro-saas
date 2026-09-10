import { useEffect, useState } from 'react';
import { scopedFilter } from '@/lib/companyScope';
import { base44 } from '@/api/base44Client';
import { Printer } from 'lucide-react';
import { useInsumoNames } from '@/hooks/useInsumoNames';
import { useInsumoCosts } from '@/hooks/useInsumoCosts';
import VirtualEngineer from '@/components/analysis/VirtualEngineer';
import VirtualEngineerReport from '@/components/reports/VirtualEngineerReport';
import OrderAnalysis from '@/components/analysis/OrderAnalysis';
import QualityAnalysis from '@/components/analysis/QualityAnalysis';

export default function VirtualEngineerPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showReport, setShowReport] = useState(false);
  const { names } = useInsumoNames();
  const { costs } = useInsumoCosts();

  useEffect(() => {
    base44.entities.ProductionOrder.filter(scopedFilter({ status: 'Concluída' }), '-production_date', 500)
      .then(data => { setOrders(data); setLoading(false); });
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Engenheiro Virtual</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Análise inteligente de eficiência, consumo, custos, paradas e produção</p>
        </div>
        <button onClick={() => setShowReport(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
          <Printer className="w-4 h-4" /> Relatório
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : orders.length > 0 ? (
        <>
          <VirtualEngineer orders={orders} costs={costs} names={names} />
          <OrderAnalysis orders={orders} costs={costs} names={names} />
          <QualityAnalysis orders={orders} />
        </>
      ) : (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground text-sm">
          Nenhuma ordem concluída encontrada para análise.
        </div>
      )}

      {showReport && (
        <VirtualEngineerReport orders={orders} costs={costs} names={names} onClose={() => setShowReport(false)} />
      )}
    </div>
  );
}