import { useEffect, useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useInsumoNames } from '@/hooks/useInsumoNames';
import { useInsumoCosts } from '@/hooks/useInsumoCosts';
import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';
import { computeStats, iecFromCV } from '@/lib/statsUtils';
import { subDays, format } from 'date-fns';
import { Printer, RefreshCw, Activity } from 'lucide-react';
import IECCard from '@/components/stats/IECCard';
import InsumoStatsTable from '@/components/stats/InsumoStatsTable';
import LimitControlTable from '@/components/stats/LimitControlTable';
import StatsCharts from '@/components/stats/StatsCharts';
import StatsRankings from '@/components/stats/StatsRankings';
import MachineComparison from '@/components/stats/MachineComparison';
import StatsReport from '@/components/reports/StatsReport';

const PERIODS = [
  { label: '30 dias', days: 30 },
  { label: '90 dias', days: 90 },
  { label: '180 dias', days: 180 },
  { label: '1 ano', days: 365 },
];

export default function StatisticalAnalysis() {
  const [orders, setOrders] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [traces, setTraces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(90);
  const [showReport, setShowReport] = useState(false);
  const { names } = useInsumoNames();
  const { costs } = useInsumoCosts();

  async function load() {
    setLoading(true);
    const [data, types, trcs] = await Promise.all([
      base44.entities.ProductionOrder.filter({ status: 'Concluída' }, '-production_date', 500),
      base44.entities.ProductType.list('name'),
      base44.entities.ConcreteTrace.list('name'),
    ]);
    setOrders(data); setProductTypes(types); setTraces(trcs);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const ptMap = useMemo(() => Object.fromEntries(productTypes.map(p => [p.id, p])), [productTypes]);
  const traceMap = useMemo(() => Object.fromEntries(traces.map(t => [t.id, t])), [traces]);

  const cutoff = format(subDays(new Date(), period), 'yyyy-MM-dd');
  const filtered = orders.filter(o => (o.production_date || '').slice(0, 10) >= cutoff);

  // IEC global: CV médio calculado por artefato + insumo (evita distorção entre
  // produtos com consumos absolutos diferentes) e depois agrupado por insumo
  const { iec, avgCV } = useMemo(() => {
    const byProduct = {};
    filtered.forEach(o => {
      if (o.actual_quantity <= 0) return;
      const name = o.product_type_name || 'Desconhecido';
      if (!byProduct[name]) byProduct[name] = {};
      INSUMO_KEYS.forEach(key => {
        const v = o[INSUMO_FIELDS[key].actual] || 0;
        if (v > 0) (byProduct[name][key] ||= []).push(v / o.actual_quantity);
      });
    });
    const byInsumo = {};
    Object.values(byProduct).forEach(prods => {
      INSUMO_KEYS.forEach(key => {
        const s = computeStats(prods[key]);
        if (s && isFinite(s.cv)) (byInsumo[key] ||= []).push(s.cv);
      });
    });
    const cvs = [];
    INSUMO_KEYS.forEach(key => {
      const arr = byInsumo[key];
      if (arr?.length) cvs.push(arr.reduce((a, b) => a + b, 0) / arr.length);
    });
    const avg = cvs.length ? cvs.reduce((a, b) => a + b, 0) / cvs.length : null;
    return { iec: iecFromCV(avg), avgCV: avg };
  }, [filtered]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            Controle Estatístico de Consumo
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            SPC · Indicadores, controle de limites, rankings e Índice de Estabilidade de Consumo (IEC)
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-muted rounded-lg p-1 gap-1">
            {PERIODS.map(p => (
              <button key={p.days} onClick={() => setPeriod(p.days)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${period === p.days ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          <button onClick={() => setShowReport(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            <Printer className="w-4 h-4" /> Relatório
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
          Nenhuma ordem concluída no período selecionado.
        </div>
      ) : (
        <>
          <IECCard score={iec} avgCV={avgCV} />

          <section className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Indicadores Estatísticos</h2>
              <p className="text-xs text-muted-foreground -mt-2">Média, desvio padrão, variância, CV, mín., máx., mediana e nº de lotes por matéria-prima</p>
            </div>
            <InsumoStatsTable orders={filtered} names={names} />
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Controle de Limites</h2>
              <p className="text-xs text-muted-foreground -mt-2">Consumo real vs. ficha técnica (traço) — classificação automática e custo do excesso</p>
            </div>
            <LimitControlTable orders={filtered} ptMap={ptMap} traceMap={traceMap} names={names} costs={costs} />
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Dashboard de Consumo</h2>
              <p className="text-xs text-muted-foreground -mt-2">Evolução por lote, desvio padrão e coeficiente de variação</p>
            </div>
            <StatsCharts orders={filtered} ptMap={ptMap} traceMap={traceMap} names={names} />
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">Comparação entre Máquinas</h2>
            <MachineComparison orders={filtered} names={names} />
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Rankings</h2>
              <p className="text-xs text-muted-foreground -mt-2">Produtos, máquinas e lotes em destaque por consumo e estabilidade</p>
            </div>
            <StatsRankings orders={filtered} ptMap={ptMap} traceMap={traceMap} names={names} costs={costs} />
          </section>
        </>
      )}

      {showReport && <StatsReport onClose={() => setShowReport(false)} />}
    </div>
  );
}