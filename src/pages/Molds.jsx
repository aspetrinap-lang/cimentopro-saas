import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Pencil, Trash2, AlertTriangle, CheckCircle2, Wrench, XCircle, ClipboardList, Printer } from 'lucide-react';
import MoldForm from '@/components/molds/MoldForm';
import MoldsReport from '@/components/reports/MoldsReport';
import MoldLifecycleBar from '@/components/molds/MoldLifecycleBar';
import MoldDetailDrawer from '@/components/molds/MoldDetailDrawer';
import { usePermissions } from '@/lib/PermissionsContext';

const STATUS_CONFIG = {
  'Ativo':          { color: 'bg-green-100 text-green-700',   icon: CheckCircle2 },
  'Em Manutenção':  { color: 'bg-amber-100 text-amber-700',   icon: Wrench },
  'Descartado':     { color: 'bg-slate-100 text-slate-500',   icon: XCircle },
};

export default function Molds() {
  const { can } = usePermissions();
  const [molds, setMolds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detailMold, setDetailMold] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [filterStatus, setFilterStatus] = useState('todos');

  async function load() {
    setLoading(true);
    const data = await base44.entities.Mold.list('name');
    setMolds(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(mold) {
    if (!window.confirm(`Excluir o molde "${mold.name}"?`)) return;
    await base44.entities.Mold.delete(mold.id);
    load();
  }

  const filtered = filterStatus === 'todos'
    ? molds
    : molds.filter(m => m.status === filterStatus);

  const criticalCount = molds.filter(m => {
    if (!m.max_cycles || m.status === 'Descartado') return false;
    return (m.cycles_used / m.max_cycles) >= 0.9;
  }).length;

  const attentionCount = molds.filter(m => {
    if (!m.max_cycles || m.status === 'Descartado') return false;
    const pct = m.cycles_used / m.max_cycles;
    return pct >= 0.7 && pct < 0.9;
  }).length;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Controle de Moldes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Cadastro e vida útil dos moldes de produção</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowReport(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-border text-muted-foreground hover:bg-muted transition-colors">
            <Printer className="w-4 h-4" /> Relatório
          </button>
          {can('MACHINES_CREATE') && (
            <button
              onClick={() => { setEditing(null); setShowForm(true); }}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" /> Novo Molde
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <SummaryCard label="Total de Moldes" value={molds.length} color="text-foreground" />
          <SummaryCard label="Ativos" value={molds.filter(m => m.status === 'Ativo').length} color="text-green-600" />
          <SummaryCard label="Críticos (≥90%)" value={criticalCount} color="text-red-600"
            icon={criticalCount > 0 ? <AlertTriangle className="w-4 h-4 text-red-500" /> : null} />
          <SummaryCard label="Em Atenção (≥70%)" value={attentionCount} color="text-amber-600" />
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-1 bg-muted rounded-xl p-1 w-fit flex-wrap">
        {['todos', 'Ativo', 'Em Manutenção', 'Descartado'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${filterStatus === s ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {s === 'todos' ? 'Todos' : s}
          </button>
        ))}
      </div>

      {/* Mold cards */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-7 h-7 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground text-sm">
          Nenhum molde encontrado.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(mold => {
            const cfg = STATUS_CONFIG[mold.status] || STATUS_CONFIG['Ativo'];
            const StatusIcon = cfg.icon;
            const pct = mold.max_cycles ? (mold.cycles_used || 0) / mold.max_cycles * 100 : null;
            const isCritical = pct !== null && pct >= 90;

            return (
              <div key={mold.id}
                className={`bg-card border rounded-xl p-5 shadow-sm space-y-4 ${isCritical ? 'border-red-300' : 'border-border'}`}>
                {/* Title row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground truncate">{mold.name}</span>
                      {isCritical && <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{mold.code}{mold.supplier_code ? <span className="ml-2 text-muted-foreground/60">· Forn: {mold.supplier_code}</span> : ''}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
                      <StatusIcon className="w-3 h-3" /> {mold.status}
                    </span>
                  </div>
                </div>

                {/* Artefatos */}
                {mold.product_type_names?.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    <span>Artefatos: </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {mold.product_type_names.map((n, i) => (
                        <span key={i} className="bg-muted px-2 py-0.5 rounded-full font-medium text-foreground">{n}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Peças por ciclo */}
                {mold.units_per_cycle && (
                  <p className="text-xs text-muted-foreground">
                    Peças/ciclo: <span className="font-semibold text-foreground">{mold.units_per_cycle}</span>
                  </p>
                )}

                {/* Lifecycle bar */}
                <MoldLifecycleBar cyclesUsed={mold.cycles_used || 0} maxCycles={mold.max_cycles} />

                {/* Dates */}
                {(mold.acquisition_date || mold.last_maintenance_date) && (
                  <div className="flex gap-4 text-xs text-muted-foreground border-t border-border pt-3">
                    {mold.acquisition_date && <span>Aquisição: {mold.acquisition_date}</span>}
                    {mold.last_maintenance_date && <span>Últ. Manut.: {mold.last_maintenance_date}</span>}
                  </div>
                )}

                {/* Notes */}
                {mold.notes && <p className="text-xs text-muted-foreground italic">{mold.notes}</p>}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1 border-t border-border">
                  <button onClick={() => setDetailMold(mold)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors">
                    <ClipboardList className="w-3.5 h-3.5" /> Histórico
                  </button>
                  {can('MACHINES_EDIT') && (
                    <button onClick={() => { setEditing(mold); setShowForm(true); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors">
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </button>
                  )}
                  {can('MACHINES_DELETE') && (
                    <button onClick={() => handleDelete(mold)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors ml-auto">
                      <Trash2 className="w-3.5 h-3.5" /> Excluir
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <MoldForm item={editing} onClose={() => setShowForm(false)} onSaved={load} />
      )}

      {detailMold && (
        <MoldDetailDrawer
          mold={detailMold}
          onClose={() => setDetailMold(null)}
          onMoldUpdated={load}
        />
      )}

      {showReport && <MoldsReport onClose={() => setShowReport(false)} />}
    </div>
  );
}

function SummaryCard({ label, value, color, icon }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2 mt-1">
        {icon}
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
      </div>
    </div>
  );
}