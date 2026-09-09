import { useEffect, useMemo, useState } from 'react';
import { format, subDays, parseISO, isWithinInterval, startOfDay, endOfDay, differenceInCalendarDays } from 'date-fns';
import { CalendarRange, Printer, X, FileWarning } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { buildProblemsReportData } from '@/lib/executiveProblems';
import { useInsumoCosts } from '@/hooks/useInsumoCosts';
import { useInsumoNames } from '@/hooks/useInsumoNames';

const SEVERITY = {
  critical: { label: 'Crítico', badge: 'border-red-600 text-red-700 bg-red-50', bar: 'bg-red-600' },
  high: { label: 'Alto', badge: 'border-orange-500 text-orange-600 bg-orange-50', bar: 'bg-orange-500' },
  medium: { label: 'Médio', badge: 'border-amber-500 text-amber-600 bg-amber-50', bar: 'bg-amber-500' },
};

// Relatório A4 para impressão com os principais problemas do período,
// com filtro de datas (pré-preenchido com o período atual da página).
export default function ProblemsReport({ orders, downtimes, machines, period, onClose }) {
  const { costs } = useInsumoCosts();
  const { names } = useInsumoNames();
  const [molds, setMolds] = useState([]);
  const [start, setStart] = useState(() => format(subDays(new Date(), period - 1), 'yyyy-MM-dd'));
  const [end, setEnd] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    base44.entities.Mold.list('name').then(setMolds);
  }, []);

  // Filtra ordens e paradas pelo intervalo selecionado
  const { filteredOrders, filteredDowntimes, days } = useMemo(() => {
    const s = startOfDay(parseISO(start + 'T00:00:00'));
    const e = endOfDay(parseISO(end + 'T00:00:00'));
    const inRange = (ds) => !!ds && isWithinInterval(parseISO(ds + 'T00:00:00'), { start: s, end: e });
    return {
      filteredOrders: orders.filter((o) => inRange(o.production_date)),
      filteredDowntimes: downtimes.filter((d) => inRange(d.date)),
      days: differenceInCalendarDays(e, s) + 1,
    };
  }, [orders, downtimes, start, end]);

  const { problems, summary } = useMemo(
    () => buildProblemsReportData({ orders: filteredOrders, downtimes: filteredDowntimes, machines, molds, costs, names }),
    [filteredOrders, filteredDowntimes, machines, molds, costs, names]
  );

  const today = format(new Date(), 'yyyy-MM-dd');
  const isShortcut = (d) => start === format(subDays(new Date(), d - 1), 'yyyy-MM-dd') && end === today;
  const applyShortcut = (d) => {
    setStart(format(subDays(new Date(), d - 1), 'yyyy-MM-dd'));
    setEnd(today);
  };

  const issued = format(new Date(), "dd/MM/yyyy 'às' HH:mm");

  const shortcutBtn = (active) =>
    `text-xs px-3 py-1.5 rounded-lg border transition-colors ${
      active ? 'bg-primary text-primary-foreground border-primary' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
    }`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 overflow-y-auto p-4 md:p-8">
      {/* Barra de ações e filtro de período (fora da área de impressão) */}
      <div className="max-w-[800px] mx-auto mb-3">
        <div className="flex items-center gap-2 flex-wrap rounded-xl bg-white/95 border border-slate-200 shadow px-3 py-2.5">
          <CalendarRange className="w-4 h-4 text-slate-500 shrink-0" />
          <button className={shortcutBtn(isShortcut(7))} onClick={() => applyShortcut(7)}>7 dias</button>
          <button className={shortcutBtn(isShortcut(30))} onClick={() => applyShortcut(30)}>30 dias</button>
          <button className={shortcutBtn(isShortcut(90))} onClick={() => applyShortcut(90)}>90 dias</button>
          <div className="flex items-center gap-1.5 ml-1">
            <input
              type="date"
              value={start}
              max={end}
              onChange={(e) => {
                if (!e.target.value) return;
                setStart(e.target.value);
                if (e.target.value > end) setEnd(e.target.value);
              }}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="text-xs text-slate-500">até</span>
            <input
              type="date"
              value={end}
              min={start}
              onChange={(e) => {
                if (!e.target.value) return;
                setEnd(e.target.value);
                if (e.target.value < start) setStart(e.target.value);
              }}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow"
            >
              <Printer className="w-4 h-4" /> Imprimir
            </button>
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Folha A4 */}
      <div className="print-area bg-white text-slate-900 mx-auto max-w-[800px] p-8 md:p-10 shadow-2xl rounded-lg">
        <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4 mb-5">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Relatório de Problemas</h1>
            <p className="text-xs text-slate-500 mt-0.5">Resumo Executivo — identificação automática de ocorrências do período</p>
          </div>
          <FileWarning className="w-8 h-8 text-slate-300 shrink-0" />
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6 text-xs">
          <div className="border border-slate-200 rounded-lg p-2.5">
            <p className="text-slate-500 font-semibold uppercase tracking-wide text-[10px]">Período analisado</p>
            <p className="font-medium mt-1">
              {format(parseISO(start + 'T00:00:00'), 'dd/MM/yyyy')} a {format(parseISO(end + 'T00:00:00'), 'dd/MM/yyyy')} ({days} {days === 1 ? 'dia' : 'dias'})
            </p>
          </div>
          <div className="border border-slate-200 rounded-lg p-2.5">
            <p className="text-slate-500 font-semibold uppercase tracking-wide text-[10px]">Emissão</p>
            <p className="font-medium mt-1">{issued}</p>
          </div>
          <div className="border border-slate-200 rounded-lg p-2.5">
            <p className="text-slate-500 font-semibold uppercase tracking-wide text-[10px]">Problemas identificados</p>
            <p className="font-medium mt-1">
              {summary.total} ({summary.critical} crítico(s), {summary.high} alto(s), {summary.medium} médio(s))
            </p>
          </div>
        </div>

        {problems.length === 0 ? (
          <p className="text-sm text-slate-600 text-center py-12">
            Nenhum problema relevante identificado no período.
          </p>
        ) : (
          <div className="space-y-4">
            {problems.map((p, i) => {
              const s = SEVERITY[p.severity];
              return (
                <div key={i} className={`border-l-4 ${s.bar} pl-4 py-1`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{p.category}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${s.badge}`}>{s.label}</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5">
                    {i + 1}. {p.title}
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed mt-0.5">{p.description}</p>
                  <p className="text-xs text-slate-800 leading-relaxed mt-1.5">
                    <strong className="font-semibold">Ação recomendada:</strong> {p.action}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-[10px] text-slate-400 text-center border-t border-slate-200 mt-8 pt-3">
          Relatório gerado automaticamente pelo CimentoPro a partir dos registros de produção, manutenção e cadastros.
        </p>
      </div>
    </div>
  );
}