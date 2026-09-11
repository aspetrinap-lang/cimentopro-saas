import { useEffect, useMemo, useState } from 'react';
import { scopedFilter } from '@/lib/companyScope';
import { base44 } from '@/api/base44Client';
import { Printer } from 'lucide-react';
import { useInsumoNames } from '@/hooks/useInsumoNames';
import { useInsumoCosts } from '@/hooks/useInsumoCosts';
import { analyzeConsumptionByArtifact, mergeAnalyses } from '@/lib/consumptionEngine';
import VirtualEngineer from '@/components/analysis/VirtualEngineer';
import VirtualEngineerReport from '@/components/reports/VirtualEngineerReport';
import OrderAnalysis from '@/components/analysis/OrderAnalysis';
import QualityAnalysis from '@/components/analysis/QualityAnalysis';
import ConsumptionPanel from '@/components/analysis/ConsumptionPanel';
import SpecificConsumptionPanel from '@/components/analysis/SpecificConsumptionPanel';
import OrderConsumptionTab from '@/components/analysis/OrderConsumptionTab';

const MODES = [
  { key: 'period', label: 'Período' },
  { key: 'order', label: 'Ordem específica' },
];

export default function VirtualEngineerPage() {
  const [orders, setOrders] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showReport, setShowReport] = useState(false);
  const [mode, setMode] = useState('period');
  const { names } = useInsumoNames();
  const { costs } = useInsumoCosts();

  useEffect(() => {
    Promise.all([
      base44.entities.ProductionOrder.filter(scopedFilter({ status: 'Concluída' }), '-production_date', 500),
      base44.entities.ProductType.filter(scopedFilter({}), 'name', 500),
    ]).then(([orderData, productTypeData]) => {
      setOrders(orderData);
      setProductTypes(productTypeData);
      setLoading(false);
    });
  }, []);

  const productTypesById = useMemo(
    () => Object.fromEntries(productTypes.map((p) => [p.id, p])),
    [productTypes]
  );

  const periodAnalysis = useMemo(
    () => (orders.length > 0 ? mergeAnalyses(analyzeConsumptionByArtifact(orders, productTypesById)) : null),
    [orders, productTypesById]
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Engenheiro Virtual</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Consumo esperado para a produção real, consumo específico, proporções do traço e análise inteligente
          </p>
        </div>
        <button
          onClick={() => setShowReport(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Printer className="w-4 h-4" /> Relatório
        </button>
      </div>

      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors ${
              mode === m.key
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground text-sm">
          Nenhuma ordem concluída encontrada para análise.
        </div>
      ) : mode === 'period' ? (
        <>
          <VirtualEngineer orders={orders} costs={costs} names={names} productTypesById={productTypesById} />
          {periodAnalysis && <ConsumptionPanel analysis={periodAnalysis} names={names} />}
          {periodAnalysis && <SpecificConsumptionPanel analysis={periodAnalysis} names={names} />}
          <OrderAnalysis orders={orders} costs={costs} names={names} />
          <QualityAnalysis orders={orders} />
        </>
      ) : (
        <OrderConsumptionTab orders={orders} productTypesById={productTypesById} names={names} />
      )}

      {showReport && (
        <VirtualEngineerReport
          orders={orders}
          costs={costs}
          names={names}
          productTypesById={productTypesById}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}