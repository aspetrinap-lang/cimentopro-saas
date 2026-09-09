import { useEffect, useState } from 'react';
import { scopedFilter } from '@/lib/companyScope';
import { base44 } from '@/api/base44Client';
import { Plus, Pencil, Trash2, RefreshCw, Wrench, Shapes, Printer } from 'lucide-react';
import PreventiveMaintenanceForm from '@/components/settings/PreventiveMaintenanceForm';
import MaintenanceReport from '@/components/reports/MaintenanceReport';
import { usePermissions } from '@/lib/PermissionsContext';

function TypeBadge({ type }) {
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">{type}</span>
  );
}

function ActionButtons({ item, onEdit, onDelete, canEdit = true, canDelete = true }) {
  return (
    <div className="flex items-center gap-2 justify-end">
      {canEdit && (
        <button onClick={() => onEdit(item)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}
      {canDelete && (
        <button onClick={() => onDelete(item)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function MachineTable({ items, onEdit, onDelete, canEdit, canDelete }) {
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border bg-muted/30">
        <Wrench className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Máquinas</h2>
        <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{items.length}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
              <th className="px-5 py-3 text-left font-semibold">Data</th>
              <th className="px-5 py-3 text-left font-semibold">Máquina</th>
              <th className="px-5 py-3 text-left font-semibold">Tipo</th>
              <th className="px-5 py-3 text-left font-semibold">Peça Trocada</th>
              <th className="px-5 py-3 text-left font-semibold">Descrição</th>
              <th className="px-5 py-3 text-left font-semibold">Responsável</th>
              <th className="px-5 py-3 text-right font-semibold">Duração</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-muted-foreground text-sm">
                  Nenhuma manutenção de máquina registrada.
                </td>
              </tr>
            ) : items.map(p => (
              <tr key={p.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                <td className="px-5 py-3 text-muted-foreground whitespace-nowrap">{p.date}</td>
                <td className="px-5 py-3 font-medium text-foreground whitespace-nowrap">{p.machine_name || '—'}</td>
                <td className="px-5 py-3"><TypeBadge type={p.maintenance_type} /></td>
                <td className="px-5 py-3 text-muted-foreground text-xs max-w-[140px] truncate">{p.replaced_part || '—'}</td>
                <td className="px-5 py-3 text-muted-foreground text-xs max-w-xs truncate">{p.description || '—'}</td>
                <td className="px-5 py-3 text-muted-foreground text-xs whitespace-nowrap">{p.technician || '—'}</td>
                <td className="px-5 py-3 text-right text-xs whitespace-nowrap">{p.duration_minutes ? `${p.duration_minutes} min` : '—'}</td>
                <td className="px-5 py-3"><ActionButtons item={p} onEdit={onEdit} onDelete={onDelete} canEdit={canEdit} canDelete={canDelete} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MoldTable({ items, onEdit, onDelete, canEdit, canDelete }) {
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border bg-muted/30">
        <Shapes className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Moldes</h2>
        <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{items.length}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
              <th className="px-5 py-3 text-left font-semibold">Data</th>
              <th className="px-5 py-3 text-left font-semibold">Molde</th>
              <th className="px-5 py-3 text-left font-semibold">Tipo</th>
              <th className="px-5 py-3 text-left font-semibold">Peça Trocada</th>
              <th className="px-5 py-3 text-left font-semibold">Descrição</th>
              <th className="px-5 py-3 text-left font-semibold">Responsável</th>
              <th className="px-5 py-3 text-right font-semibold">Duração</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-muted-foreground text-sm">
                  Nenhuma manutenção de molde registrada.
                </td>
              </tr>
            ) : items.map(p => (
              <tr key={p.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                <td className="px-5 py-3 text-muted-foreground whitespace-nowrap">{p.date}</td>
                <td className="px-5 py-3 font-medium text-foreground whitespace-nowrap">{p.mold_name || '—'}</td>
                <td className="px-5 py-3"><TypeBadge type={p.maintenance_type} /></td>
                <td className="px-5 py-3 text-muted-foreground text-xs max-w-[140px] truncate">{p.replaced_part || '—'}</td>
                <td className="px-5 py-3 text-muted-foreground text-xs max-w-xs truncate">{p.description || '—'}</td>
                <td className="px-5 py-3 text-muted-foreground text-xs whitespace-nowrap">{p.technician || '—'}</td>
                <td className="px-5 py-3 text-right text-xs whitespace-nowrap">{p.duration_minutes ? `${p.duration_minutes} min` : '—'}</td>
                <td className="px-5 py-3"><ActionButtons item={p} onEdit={onEdit} onDelete={onDelete} canEdit={canEdit} canDelete={canDelete} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Maintenance() {
  const { can } = usePermissions();
  const [maintenances, setMaintenances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showReport, setShowReport] = useState(false);

  async function load() {
    setLoading(true);
    const data = await base44.entities.PreventiveMaintenance.filter(scopedFilter({}), '-date', 500);
    setMaintenances(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(item) {
    if (!window.confirm(`Excluir esta manutenção?`)) return;
    await base44.entities.PreventiveMaintenance.delete(item.id);
    load();
  }

  function handleEdit(item) {
    setEditing(item);
    setShowForm(true);
  }

  const machineMaint = maintenances.filter(m => m.machine_id);
  const moldMaint = maintenances.filter(m => m.mold_id);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Manutenção Preventiva</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Registro de manutenções preventivas de máquinas e moldes</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="flex gap-2">
            <button onClick={() => setShowReport(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-border text-muted-foreground hover:bg-muted transition-colors">
              <Printer className="w-4 h-4" /> Relatório
            </button>
            {can('MAINTENANCE_EDIT') && (
              <button onClick={() => { setEditing(null); setShowForm(true); }}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                <Plus className="w-4 h-4" /> Nova Manutenção
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-7 h-7 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <MachineTable items={machineMaint} onEdit={handleEdit} onDelete={handleDelete} canEdit={can('MAINTENANCE_EDIT')} canDelete={can('MAINTENANCE_EDIT')} />
          <MoldTable items={moldMaint} onEdit={handleEdit} onDelete={handleDelete} canEdit={can('MAINTENANCE_EDIT')} canDelete={can('MAINTENANCE_EDIT')} />
        </>
      )}

      {showForm && (
        <PreventiveMaintenanceForm
          item={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); load(); }}
        />
      )}

      {showReport && <MaintenanceReport onClose={() => setShowReport(false)} />}
    </div>
  );
}