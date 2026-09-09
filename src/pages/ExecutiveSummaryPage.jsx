import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { subDays, parseISO, isAfter } from 'date-fns';
import { Printer, RefreshCw } from 'lucide-react';
import ExecutiveSummary from '@/components/dashboard/ExecutiveSummary';
import ProblemsReport from '@/components/dashboard/ProblemsReport';

const PERIODS = [
  { label: '7 dias', days: 7 },
  { label: '30 dias', days: 30 },
  { label: '90 dias', days: 90 },
];

export default function ExecutiveSummaryPage() {
  const [orders, setOrders] = useState([]);
  const [downtimes, setDowntimes] = useState([]);
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);
  const [showReport, setShowReport] = useState(false);

  async function load() {
    setLoading(true);
    const [o, d, m] = await Promise.all([
      base44.entities.ProductionOrder.list('-production_date', 500),
      base44.entities.MachineDowntime.list('-date', 500),
      base44.entities.Machine.list('name'),
    ]);
    setOrders(o); setDowntimes(d); setMachines(m);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const cutoff = subDays(new Date(), period);
  const filteredDT = downtimes.filter(d => d.date && isAfter(parseISO(d.date), cutoff));
  const filteredOrders = orders.filter(o => o.production_date && isAfter(parseISO(o.production_date), cutoff));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Resumo Executivo</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Indicadores estratégicos consolidados</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowReport(true)} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
            <Printer className="w-4 h-4" />
            Relatório de Problemas
          </button>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex gap-1 bg-muted rounded-xl p-1 w-fit">
        {PERIODS.map(p => (
          <button key={p.days} onClick={() => setPeriod(p.days)}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${period === p.days ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <ExecutiveSummary orders={filteredOrders} downtimes={filteredDT} machines={machines} period={period} />
      )}
      {showReport && !loading && (
        <ProblemsReport orders={orders} downtimes={downtimes} machines={machines} period={period} onClose={() => setShowReport(false)} />
      )}
    </div>
  );
}