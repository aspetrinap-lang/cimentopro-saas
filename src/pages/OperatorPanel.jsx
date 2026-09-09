import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { format, subDays } from 'date-fns';
import { Printer, RefreshCw, Timer } from 'lucide-react';
import { buildOperatorPanelData } from '@/lib/operatorMetrics';
import { computeStats } from '@/lib/statsUtils';
import MachineCard from '@/components/operator/MachineCard';
import PeriodSelector from '@/components/operator/PeriodSelector';
import OperatorPanelReport from '@/components/reports/OperatorPanelReport';

function fmtBR(dateStr) {
  return format(new Date(dateStr + 'T12:00:00'), 'dd/MM/yyyy');
}

export default function OperatorPanel() {
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState([]);
  const [showReport, setShowReport] = useState(false);
  // Período padrão: últimos 7 dias (incluindo hoje)
  const [period, setPeriod] = useState(() => ({
    start: format(subDays(new Date(), 6), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd'),
  }));

  async function load(p) {
    setLoading(true);
    const [machines, orders, downtimes, lines] = await Promise.all([
      base44.entities.Machine.filter({ active: true }, 'name'),
      base44.entities.ProductionOrder.list('-production_date', 2000),
      base44.entities.MachineDowntime.list('-date', 2000),
      base44.entities.ProductionLine.list('name'),
    ]);
    const data = buildOperatorPanelData({ machines, orders, downtimes, lines }, computeStats, { startDate: p.start, endDate: p.end });
    setCards(data.cards);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    load(period).finally(() => { if (!active) setLoading(false); });
    return () => { active = false; };
  }, [period.start, period.end]);

  function handlePeriodChange(start, end) {
    setPeriod({ start, end });
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Timer className="w-5 h-5 text-primary" /> Painel do Operador
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Período: {fmtBR(period.start)} até {fmtBR(period.end)} — produção por linha
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <PeriodSelector start={period.start} end={period.end} onChange={handlePeriodChange} />
          <button onClick={() => load(period)} disabled={loading}
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
      ) : cards.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
          Nenhuma máquina ativa de produção cadastrada.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {cards.map((card) => (
            <MachineCard key={card.id} card={card} />
          ))}
        </div>
      )}

      {showReport && (
        <OperatorPanelReport initialStart={period.start} initialEnd={period.end} onClose={() => setShowReport(false)} />
      )}
    </div>
  );
}