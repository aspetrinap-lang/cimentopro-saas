import { useEffect, useState, useMemo, useCallback } from 'react';
import { scopedFilter } from '@/lib/companyScope';
import { base44 } from '@/api/base44Client';
import { useInsumoCosts } from '@/hooks/useInsumoCosts';
import { Printer, RefreshCw, Factory } from 'lucide-react';
import { subDays, format } from 'date-fns';
import DashboardReport from '@/components/reports/DashboardReport';
import DashboardFilters from '@/components/dashboard/DashboardFilters';
import KpiStrip from '@/components/dashboard/KpiStrip';
import ChartCard from '@/components/dashboard/ChartCard';
import ProductionEvolutionChart from '@/components/dashboard/ProductionEvolutionChart';
import MachinePerformanceChart from '@/components/dashboard/MachinePerformanceChart';
import PlannedVsProducedChart from '@/components/dashboard/PlannedVsProducedChart';
import ProductionMixChart from '@/components/dashboard/ProductionMixChart';
import ConsumptionDeviationChart from '@/components/dashboard/ConsumptionDeviationChart';
import ProcessStabilityChart from '@/components/dashboard/ProcessStabilityChart';
import CostEvolutionChart from '@/components/dashboard/CostEvolutionChart';
import ForecastConsumptionChart from '@/components/dashboard/ForecastConsumptionChart';
import ProductivityTable from '@/components/dashboard/ProductivityTable';
import AlertasOperacionais from '@/components/dashboard/AlertasOperacionais';
import TopWasteLotsTable from '@/components/dashboard/TopWasteLotsTable';
import TrendChart from '@/components/dashboard/TrendChart';
import UnitConsumptionChart from '@/components/dashboard/UnitConsumptionChart';
import UnitCostCard from '@/components/dashboard/UnitCostCard';
import ProductionLossCard from '@/components/dashboard/ProductionLossCard';
import RawMaterialCostChart from '@/components/dashboard/RawMaterialCostChart';
import DreSummaryCard from '@/components/dashboard/DreSummaryCard';
import StatsRankings from '@/components/stats/StatsRankings';
import { LineChart as LineChartIcon, Gauge, BarChart3, Layers, DollarSign, Activity, Timer, PlayCircle, Trophy, AlertTriangle, FileText, Boxes } from 'lucide-react';

const fmtDate = (d) => format(d, 'yyyy-MM-dd');

export default function Dashboard() {
  const [orders, setOrders] = useState([]);
  const [machines, setMachines] = useState([]);
  const [lines, setLines] = useState([]);
  const [products, setProducts] = useState([]);
  const [traces, setTraces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showReport, setShowReport] = useState(false);

  const { costs } = useInsumoCosts();

  const [filters, setFilters] = useState(() => ({
    startDate: fmtDate(subDays(new Date(), 30)),
    endDate: fmtDate(new Date()),
    machineId: '',
    lineId: '',
    productTypeId: '',
  }));
  const [appliedFilters, setAppliedFilters] = useState(filters);

  const load = useCallback(async () => {
    setLoading(true);
    const [o, m, l, p, t] = await Promise.all([
      base44.entities.ProductionOrder.filter(scopedFilter({}), '-production_date', 500),
      base44.entities.Machine.filter(scopedFilter({ active: true }), 'name', 500),
      base44.entities.ProductionLine.filter(scopedFilter({}), 'name', 500).catch(() => []),
      base44.entities.ProductType.filter(scopedFilter({}), 'name', 500),
      base44.entities.ConcreteTrace.filter(scopedFilter({}), undefined, 500),
    ]);
    setOrders(o);
    setMachines(m);
    setLines(l);
    setProducts(p);
    setTraces(t);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const ptMap = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const traceMap = useMemo(() => Object.fromEntries(traces.map((t) => [t.id, t])), [traces]);

  const filteredOrders = useMemo(() => {
    const { startDate, endDate, machineId, lineId, productTypeId } = appliedFilters;
    return orders.filter((o) => {
      if (startDate && o.production_date < startDate) return false;
      if (endDate && o.production_date > endDate) return false;
      if (machineId && o.machine_id !== machineId) return false;
      if (lineId && o.production_line_id !== lineId) return false;
      if (productTypeId && o.product_type_id !== productTypeId) return false;
      return true;
    });
  }, [orders, appliedFilters]);

  const periodLabel = `${new Date(appliedFilters.startDate + 'T12:00:00').toLocaleDateString('pt-BR')} — ${new Date(appliedFilters.endDate + 'T12:00:00').toLocaleDateString('pt-BR')}`;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1400px] mx-auto bg-slate-50 min-h-full">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
            <Factory className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Indicadores da Fábrica</h1>
            <p className="text-xs text-slate-500">Visão geral da produção, eficiência, consumo, qualidade e custos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowReport(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">
            <Printer className="w-4 h-4" /> Relatório
          </button>
          <button onClick={load} disabled={loading} className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <DashboardFilters
        {...filters}
        machines={machines}
        lines={lines}
        products={products}
        onChange={setFilters}
        onApply={() => setAppliedFilters(filters)}
        onClear={() => {
          const cleared = { startDate: fmtDate(subDays(new Date(), 30)), endDate: fmtDate(new Date()), machineId: '', lineId: '', productTypeId: '' };
          setFilters(cleared);
          setAppliedFilters(cleared);
        }}
      />

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <KpiStrip orders={filteredOrders} ptMap={ptMap} traceMap={traceMap} costs={costs} />

          {/* DRE */}
          <DreSummaryCard />

          {/* Linha 1: Evolução + Desempenho das Máquinas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ChartCard title="Evolução da Produção" description="Realizada × meta com média móvel" icon={LineChartIcon}>
              <ProductionEvolutionChart orders={filteredOrders} />
            </ChartCard>
            <ChartCard title="Desempenho das Máquinas" description="Produção, eficiência e produtividade por máquina" icon={Gauge}
              detailView={<MachinePerformanceChart orders={filteredOrders} />}>
              <MachinePerformanceChart orders={filteredOrders} />
            </ChartCard>
          </div>

          {/* Linha 2: Planejado × Produzido + Mix + Produtividade */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <ChartCard title="Planejado × Produzido" description="Por máquina" icon={BarChart3}>
              <PlannedVsProducedChart orders={filteredOrders} />
            </ChartCard>
            <ChartCard title="Mix de Produção" description="Participação por artefato" icon={Layers}>
              <ProductionMixChart orders={filteredOrders} />
            </ChartCard>
            <ChartCard title="Produtividade por Hora" description="un/h, ciclos/h e un/molde" icon={Timer}
              detailView={<ProductivityTable orders={filteredOrders} />}>
              <ProductivityTable orders={filteredOrders} />
            </ChartCard>
          </div>

          {/* Linha 3: Consumo de Insumos + Desvio + Consumo Real × Teórico */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <ChartCard title="Consumo de Insumos" description="Real × planejado ao longo do tempo" icon={Activity}>
              <TrendChart orders={filteredOrders} />
            </ChartCard>
            <ChartCard title="Desvio de Consumo por Insumo" description="Real vs. teórico (traço)" icon={Activity}>
              <ConsumptionDeviationChart orders={filteredOrders} ptMap={ptMap} traceMap={traceMap} />
            </ChartCard>
            <ChartCard title="Consumo por Unidade" description="Insumo por peça produzida" icon={Boxes}>
              <UnitConsumptionChart orders={filteredOrders} />
            </ChartCard>
          </div>

          {/* Linha 4: Estabilidade + Custo de Insumos + Evolução do Custo */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <ChartCard title="Estabilidade do Processo" description="Coeficiente de variação por insumo" icon={Activity}>
              <ProcessStabilityChart orders={filteredOrders} />
            </ChartCard>
            <ChartCard title="Custo de Insumos por Unidade" description="Custo unitário por artefato" icon={DollarSign}>
              <UnitCostCard orders={filteredOrders} />
            </ChartCard>
            <ChartCard title="Evolução do Custo por Unidade" description="R$/un ao longo do tempo" icon={DollarSign}>
              <CostEvolutionChart orders={filteredOrders} costs={costs} />
            </ChartCard>
          </div>

          {/* Linha 5: Consumo Previsto + Custos + Perdas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ChartCard title="Consumo Previsto — Ordens em Andamento" description="Insumos previstos para concluir ordens em andamento" icon={PlayCircle}
              detailView={<ForecastConsumptionChart orders={filteredOrders} ptMap={ptMap} />}>
              <ForecastConsumptionChart orders={filteredOrders} ptMap={ptMap} />
            </ChartCard>
            <ChartCard title="Custo Total de Matéria-Prima" description="Consumo real × preço configurado" icon={DollarSign}>
              <RawMaterialCostChart orders={filteredOrders} />
            </ChartCard>
          </div>

          <ProductionLossCard orders={filteredOrders} />

          {/* Linha 6: Rankings + Alertas + Top 5 Desperdício */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <ChartCard title="Rankings" description="Maiores custos, desvios e desperdícios" icon={Trophy}>
              <StatsRankings orders={filteredOrders} ptMap={ptMap} traceMap={traceMap} costs={costs} />
            </ChartCard>
            <ChartCard title="Alertas Operacionais" description="Derivados dos dados do período" icon={AlertTriangle}>
              <AlertasOperacionais orders={filteredOrders} ptMap={ptMap} traceMap={traceMap} costs={costs} />
            </ChartCard>
            <ChartCard title="Top 5 Lotes com Maior Desperdício" description="Maior impacto financeiro" icon={FileText}>
              <TopWasteLotsTable orders={filteredOrders} ptMap={ptMap} traceMap={traceMap} costs={costs} />
            </ChartCard>
          </div>
        </>
      )}

      {showReport && (
        <DashboardReport initialStart={appliedFilters.startDate} onClose={() => setShowReport(false)} />
      )}
    </div>
  );
}