import { useEffect, useState } from 'react';
import { scopedFilter } from '@/lib/companyScope';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, Bell, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { differenceInDays, parseISO, format } from 'date-fns';
import { getActiveIntervals } from '@/lib/machineIntervals';

function maxDate(a, b) {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

export default function MaintenanceAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [expanded, setExpanded] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [resetVersion, setResetVersion] = useState(0);

  useEffect(() => {
    async function load() {
      const [machines, maintenances] = await Promise.all([
        base44.entities.Machine.filter(scopedFilter({ active: true }), 'name'),
        base44.entities.PreventiveMaintenance.filter(scopedFilter({}), '-date', 1000),
      ]);

      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      const machineAlerts = [];

      machines.forEach(machine => {
        const intervals = getActiveIntervals(machine);
        const resetDate = machine.alerts_reset_date || null;

        Object.entries(intervals).forEach(([type, intervalDays]) => {
          if (!intervalDays || intervalDays <= 0) return;
          const machineTypeMaint = maintenances.filter(
            m => m.machine_id === machine.id && m.maintenance_type === type
          );

          let lastDateStr = null;
          if (machineTypeMaint.length > 0) {
            lastDateStr = machineTypeMaint.reduce((a, b) => (a.date > b.date ? a : b)).date;
          }

          // Data-base efetiva: a maior entre a última manutenção e a data de zerar
          const effectiveDateStr = maxDate(lastDateStr, resetDate);

          if (!effectiveDateStr) {
            // Sem manutenção e sem reset: nunca realizada
            machineAlerts.push({
              machineId: machine.id,
              machineName: machine.name,
              maintenanceType: type,
              lastDate: null,
              intervalDays,
              daysOverdue: intervalDays,
              status: 'overdue',
            });
            return;
          }

          const effectiveDate = parseISO(effectiveDateStr);
          const daysSinceLast = differenceInDays(today, effectiveDate);
          const daysOverdue = daysSinceLast - intervalDays;

          let status = 'ok';
          if (daysOverdue >= 0) status = 'overdue';
          else if (daysOverdue >= -7) status = 'warning';

          if (status !== 'ok') {
            machineAlerts.push({
              machineId: machine.id,
              machineName: machine.name,
              maintenanceType: type,
              lastDate: lastDateStr,
              intervalDays,
              daysOverdue,
              status,
              fromReset: resetDate && (!lastDateStr || resetDate > lastDateStr),
            });
          }
        });
      });

      machineAlerts.sort((a, b) => b.daysOverdue - a.daysOverdue);
      setAlerts(machineAlerts);
    }

    load();
  }, [resetVersion]);

  async function handleReset() {
    if (!window.confirm('Zerar todos os alertas de manutenção? A contagem passará a iniciar a partir de hoje para todas as máquinas.')) return;
    setResetting(true);
    const machines = await base44.entities.Machine.filter(scopedFilter({ active: true }), 'name');
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    await base44.entities.Machine.bulkUpdate(
      machines.map(m => ({ id: m.id, alerts_reset_date: todayStr }))
    );
    setResetting(false);
    setResetVersion(v => v + 1);
  }

  const overdueCount = alerts.filter(a => a.status === 'overdue').length;
  const warningCount = alerts.filter(a => a.status === 'warning').length;

  return (
    <div className="rounded-xl border border-border overflow-hidden shadow-sm">
      <div className="flex items-center justify-between bg-amber-50 border-b border-amber-200">
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-3 px-5 py-3.5 hover:bg-amber-100 transition-colors flex-1"
        >
          <Bell className="w-4 h-4 text-amber-600" />
          <span className="font-semibold text-sm text-amber-800">Alertas de Manutenção Preventiva</span>
          <div className="flex gap-2">
            {overdueCount > 0 && (
              <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {overdueCount} vencida{overdueCount > 1 ? 's' : ''}
              </span>
            )}
            {warningCount > 0 && (
              <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {warningCount} próxima{warningCount > 1 ? 's' : ''}
              </span>
            )}
            {alerts.length === 0 && (
              <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">Tudo em dia</span>
            )}
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-amber-600 ml-auto" /> : <ChevronDown className="w-4 h-4 text-amber-600 ml-auto" />}
        </button>
        <button
          onClick={handleReset}
          disabled={resetting}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50 border-l border-amber-200"
          title="Zerar alertas e contar a partir de hoje"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
          {resetting ? 'Zerando...' : 'Zerar alertas'}
        </button>
      </div>

      {expanded && alerts.length > 0 && (
        <div className="bg-card divide-y divide-border">
          {alerts.map((alert, idx) => (
            <div key={idx} className="flex items-center gap-4 px-5 py-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                alert.status === 'overdue' ? 'bg-red-100' : 'bg-amber-100'
              }`}>
                <AlertTriangle className={`w-4 h-4 ${
                  alert.status === 'overdue' ? 'text-red-600' : 'text-amber-600'
                }`} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{alert.machineName}</p>
                <p className="text-xs text-muted-foreground">{alert.maintenanceType} · a cada {alert.intervalDays} dias</p>
              </div>

              <div className="text-right shrink-0">
                {alert.lastDate ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Última: {new Date(alert.lastDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </p>
                    <p className={`text-xs font-semibold mt-0.5 ${
                      alert.status === 'overdue' ? 'text-red-600' : 'text-amber-600'
                    }`}>
                      {alert.status === 'overdue'
                        ? `Vencida há ${alert.daysOverdue} dia${alert.daysOverdue > 1 ? 's' : ''}`
                        : `Vence em ${Math.abs(alert.daysOverdue)} dia${Math.abs(alert.daysOverdue) > 1 ? 's' : ''}`}
                    </p>
                  </>
                ) : (
                  <p className="text-xs font-semibold text-red-600">Nunca realizada</p>
                )}
              </div>

              <div className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${
                alert.status === 'overdue'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {alert.status === 'overdue' ? 'VENCIDA' : 'ATENÇÃO'}
              </div>
            </div>
          ))}
        </div>
      )}

      {expanded && alerts.length === 0 && (
        <div className="bg-card px-5 py-6 text-center text-sm text-muted-foreground">
          Nenhum alerta de manutenção. Todos os intervalos estão em dia.
        </div>
      )}
    </div>
  );
}