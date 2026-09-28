import { useEffect, useState, useMemo, useCallback } from 'react';
import { scopedFilter } from '@/lib/companyScope';
import { base44 } from '@/api/base44Client';
import { useInsumoCosts } from '@/hooks/useInsumoCosts';
import { Printer, RefreshCw, Factory } from 'lucide-react';
import { subDays, format } from 'date-fns';
import DashboardReport from '@/components/reports/DashboardReport';
import DashboardFilters from '@/components/dashboard/DashboardFilters';
import KpiStrip from '@/components/dashboard/KpiStrip';
import ChartCard, { TOP_PREVIEW } from '@/components/dashboard/ChartCard';
import ProductionEvolutionChart from '@/components/dashboard/ProductionEvolutionChart';
import MachinePerformanceChart from '@/components/dashboard/MachinePerformanceChart';
import PlannedVsProducedChart from '@/components/dashboard/PlannedVsProducedChart';
import ProductionMixChart from '@/components/dashboard/ProductionMixChart';
import TrendChart from '@/components/dashboard/TrendChart';
import ConsumptionDeviationChart from '@/components/dashboard/ConsumptionDeviationChart';
import ProcessStabilityChart from '@/components/dashboard/ProcessStabilityChart';
import CostEvolutionChart from '@/components/dashboard/CostEvolutionChart';
import ForecastConsumptionChart from '@/components/dashboard/ForecastConsumptionChart';
import ProductivityTable from '@/components/dashboard/ProductivityTable';
import AlertasOperacionais from '@/components/dashboard/AlertasOperacionais';
import TopWasteLotsTable from '@/components/dashboard/TopWasteLotsTable';
import UnitCostCard from '@/components/dashboard/UnitCostCard';
import UnitConsumptionChart from '@/components/dashboard/UnitConsumptionChart';
import RawMaterialCostChart from '@/components/dashboard/RawMaterialCostChart';
import ProductionLossCard from '@/components/dashboard/ProductionLossCard';
import StatsRankings from '@/components/stats/StatsRankings';
import { LineChart as LineChartIcon, Gauge, BarChart3, Layers, DollarSign, Activity, Timer, PlayCircle, Trophy, AlertTriangle, FileText, Boxes } from 'lucide-react';

const fmtDate = (d) => format(d, 'yyyy-MM-dd');

// Carrega todas as ordens do período filtrado, paginando até esgotar (limite
// de 500 por chamada). Evita truncamento silencioso de indicadores.
async function loadAllOrders(start, end) {
  const all = [];
  let skip = 0;
  const pageSize = 500;
  for (;;) {
    const batch = await base44.entities.ProductionOrder.filter(
      scopedFilter({}), '-production_date', pageSize, skip
    );
    all.push(...batch);
    if (batch.length < pageSize) break;
    skip += pageSize;
    if (skip > 5000) break; // salvaguarda
  }
  if (!start && !end) return all;
  return all.filter((o) => {
    if (start && o.production_date < start) return false;
    if (end && o.production_date > end) return false;
    return true;
  });
}

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
      loadAllOrders(appliedFilters.startDate, appliedFilters.endDate),
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
  }, [appliedFilters.startDate, appliedFilters.endDate]);

  useEffect(() => { load(); }, [load]);

  const ptMap = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const traceMap = useMemo(() => Object.fromEntries(traces.map((t) => [t.id, t])), [traces]);

  const filteredOrders = useMemo(() => {
    const { machineId, lineId, productTypeId } = appliedFilters;
    return orders.filter((o) => {
      if (machineId && o.machine_id !== machineId) return false;
      if (lineId && o.production_line_id !== lineId) return false;
      if (productTypeId && o.product_type_id !== productTypeId) return false;
      return true;
    });
  }, [orders, appliedFilters]);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1400px] mx-auto bg-slate-50 min-h-full">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
            <Factory className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Centro de Controle da Fábrica</h1>
            <p className="text-xs text-slate-500">Visão completa da produção, eficiência, consumo e desempenho operacional</p>
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

          {/* Linha 1: Evolução da Produção | Desempenho das Máquinas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ChartCard title="Evolução da Produção" description="Realizada × meta com média móvel" icon={LineChartIcon}
              expandedChart={<ProductionEvolutionChart orders={filteredOrders} />}>
              <ProductionEvolutionChart orders={filteredOrders} />
            </ChartCard>
            <ChartCard title="Desempenho das Máquinas" description="Produção e eficiência por máquina (Top 5)" icon={Gauge}
              expandedChart={<MachinePerformanceChart orders={filteredOrders} />}
              detailView={<MachinePerformanceChart orders={filteredOrders} />}>
              <MachinePerformanceChart orders={filteredOrders} limit={TOP_PREVIEW} />
            </ChartCard>
          </div>

          {/* Linha 2: Planejado × Produzido | Mix de Produção */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ChartCard title="Planejado × Produzido" description="Por máquina (Top 5)" icon={BarChart3}
              expandedChart={<PlannedVsProducedChart orders={filteredOrders} />}>
              <PlannedVsProducedChart orders={filteredOrders} limit={TOP_PREVIEW} />
            </ChartCard>
            <ChartCard title="Mix de Produção" description="Participação por artefato (Top 5)" icon={Layers}
              expandedChart={<ProductionMixChart orders={filteredOrders} />}>
              <ProductionMixChart orders={filteredOrders} limit={TOP_PREVIEW} />
            </ChartCard>
          </div>

          {/* Linha 3: Consumo de Insumos | Desvio de Consumo */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ChartCard title="Consumo de Insumos" description="Real × planejado ao longo do tempo (Top 5)" icon={Activity}
              expandedChart={<TrendChart orders={filteredOrders} />}>
              <TrendChart orders={filteredOrders} limit={TOP_PREVIEW} />
            </ChartCard>
            <ChartCard title="Desvio de Consumo" description="Real vs. teórico por insumo (Top 5)" icon={Activity}
              expandedChart={<ConsumptionDeviationChart orders={filteredOrders} ptMap={ptMap} traceMap={traceMap} />}>
              <ConsumptionDeviationChart orders={filteredOrders} ptMap={ptMap} traceMap={traceMap} limit={TOP_PREVIEW} />
            </ChartCard>
          </div>

          {/* Linha 4: Produtividade | Estabilidade */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ChartCard title="Produtividade por Máquina/Artefato" description="un/h (Top 5)" icon={Timer}
              expandedChart={<ProductivityTable orders={filteredOrders} />}
              detailView={<ProductivityTable orders={filteredOrders} />}>
              <ProductivityTable orders={filteredOrders} limit={TOP_PREVIEW} />
            </ChartCard>
            <ChartCard title="Estabilidade do Processo" description="Coeficiente de variação por insumo (Top 5)" icon={Activity}
              expandedChart={<ProcessStabilityChart orders={filteredOrders} />}>
              <ProcessStabilityChart orders={filteredOrders} limit={TOP_PREVIEW} />
            </ChartCard>
          </div>

          {/* Linha 5: Custo por Unidade | Evolução do Custo */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ChartCard title="Custo de Insumos por Unidade" description="Custo unitário por artefato (Top 5)" icon={DollarSign}
              expandedChart={<UnitCostCard orders={filteredOrders} />}>
              <UnitCostCard orders={filteredOrders} limit={TOP_PREVIEW} />
            </ChartCard>
            <ChartCard title="Evolução do Custo por Unidade" description="R$/un ao longo do tempo" icon={DollarSign}
              expandedChart={<CostEvolutionChart orders={filteredOrders} costs={costs} />}>
              <CostEvolutionChart orders={filteredOrders} costs={costs} />
            </ChartCard>
          </div>

          {/* Consumo Previsto — Largura total */}
          <ChartCard title="Consumo Previsto — Ordens em Andamento" description="Estimativa dos insumos necessários para concluir as ordens atualmente em produção" icon={PlayCircle}
            expandedChart={<ForecastConsumptionChart orders={filteredOrders} ptMap={ptMap} />}
            detailView={<ForecastConsumptionChart orders={filteredOrders} ptMap={ptMap} />}>
            <ForecastConsumptionChart orders={filteredOrders} ptMap={ptMap} limit={TOP_PREVIEW} />
          </ChartCard>

          {/* Linha final: Rankings | Top 5 Lotes | Alertas */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <ChartCard title="Rankings" description="Maiores custos, desvios e desperdícios (Top 5)" icon={Trophy}
              expandedChart={<StatsRankings orders={filteredOrders} ptMap={ptMap} traceMap={traceMap} costs={costs} />}>
              <StatsRankings orders={filteredOrders} ptMap={ptMap} traceMap={traceMap} costs={costs} limit={TOP_PREVIEW} />
            </ChartCard>
            <ChartCard title="Top 5 Lotes com Maior Desperdício" description="Maior impacto financeiro" icon={FileText}
              expandedChart={<TopWasteLotsTable orders={filteredOrders} ptMap={ptMap} traceMap={traceMap} costs={costs} />}>
              <TopWasteLotsTable orders={filteredOrders} ptMap={ptMap} traceMap={traceMap} costs={costs} limit={TOP_PREVIEW} />
            </ChartCard>
            <ChartCard title="Alertas Operacionais" description="Derivados dos dados do período" icon={AlertTriangle}
              expandedChart={<AlertasOperacionais orders={filteredOrders} ptMap={ptMap} traceMap={traceMap} costs={costs} />}>
              <AlertasOperacionais orders={filteredOrders} ptMap={ptMap} traceMap={traceMap} costs={costs} limit={5} />
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