import { useMemo } from 'react';
import { Filter, X } from 'lucide-react';

// Barra de filtros do Centro de Controle: período De/Até, Máquina, Linha,
// Produto, com botões Aplicar e Limpar. Os dados (máquinas, linhas, produtos)
// já vêm carregados (scopedFilter) — sem novas consultas ao aplicar.
export default function DashboardFilters({
  startDate,
  endDate,
  machineId,
  lineId,
  productTypeId,
  machines = [],
  lines = [],
  products = [],
  onChange,
  onApply,
  onClear,
}) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const set = (patch) => onChange({ startDate, endDate, machineId, lineId, productTypeId, ...patch });

  const fieldCls = 'h-9 rounded-lg border border-slate-200 px-3 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40';
  const labelCls = 'text-[10px] font-semibold uppercase tracking-wide text-slate-400';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
      <div className="flex items-center gap-2 mb-3">
        <Filter className="w-4 h-4 text-blue-600" />
        <span className="text-xs font-semibold text-slate-700">Filtros</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 items-end">
        <div className="space-y-1">
          <label className={labelCls}>De</label>
          <input type="date" max={endDate || today} value={startDate} onChange={(e) => set({ startDate: e.target.value })} className={fieldCls + ' w-full'} />
        </div>
        <div className="space-y-1">
          <label className={labelCls}>Até</label>
          <input type="date" min={startDate} max={today} value={endDate} onChange={(e) => set({ endDate: e.target.value })} className={fieldCls + ' w-full'} />
        </div>
        <div className="space-y-1">
          <label className={labelCls}>Máquina</label>
          <select value={machineId} onChange={(e) => set({ machineId: e.target.value })} className={fieldCls + ' w-full'}>
            <option value="">Todas</option>
            {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className={labelCls}>Linha de Produção</label>
          <select value={lineId} onChange={(e) => set({ lineId: e.target.value })} className={fieldCls + ' w-full'}>
            <option value="">Todas</option>
            {lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className={labelCls}>Produto</label>
          <select value={productTypeId} onChange={(e) => set({ productTypeId: e.target.value })} className={fieldCls + ' w-full'}>
            <option value="">Todos</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 mt-3">
        <button onClick={onClear} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
          <X className="w-3.5 h-3.5" /> Limpar
        </button>
        <button onClick={onApply} className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
          Aplicar Filtros
        </button>
      </div>
    </div>
  );
}