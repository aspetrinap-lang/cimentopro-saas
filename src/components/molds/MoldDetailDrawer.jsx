import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Plus, Pencil, Trash2, Wrench, Zap, Droplets, Wind, Settings, CheckSquare, RefreshCw, HelpCircle, Calendar, Clock, User, Package } from 'lucide-react';
import MoldLifecycleBar from './MoldLifecycleBar';
import MoldMaintenanceForm from './MoldMaintenanceForm';
import { useBackButtonClose } from '@/hooks/useBackButtonClose';

const TYPE_CONFIG = {
  'Elétrico':       { icon: Zap,          color: 'bg-indigo-100 text-indigo-700' },
  'Mecânico':       { icon: Wrench,        color: 'bg-orange-100 text-orange-700' },
  'Pneumático':     { icon: Wind,          color: 'bg-cyan-100 text-cyan-700' },
  'Hidráulico':     { icon: Droplets,      color: 'bg-teal-100 text-teal-700' },
  'Lubrificação':   { icon: RefreshCw,     color: 'bg-amber-100 text-amber-700' },
  'Inspeção Geral': { icon: CheckSquare,   color: 'bg-violet-100 text-violet-700' },
  'Troca de Peça':  { icon: Settings,      color: 'bg-pink-100 text-pink-700' },
  'Outros':         { icon: HelpCircle,    color: 'bg-slate-100 text-slate-500' },
};

export default function MoldDetailDrawer({ mold, onClose, onMoldUpdated }) {
  const [maintenances, setMaintenances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  useBackButtonClose(onClose);

  async function loadMaintenances() {
    setLoading(true);
    const data = await base44.entities.PreventiveMaintenance.filter({ mold_id: mold.id }, '-date', 200);
    setMaintenances(data);
    setLoading(false);
  }

  useEffect(() => { loadMaintenances(); }, [mold.id]);

  async function handleDelete(m) {
    if (!window.confirm('Excluir este registro de manutenção?')) return;
    await base44.entities.PreventiveMaintenance.delete(m.id);
    loadMaintenances();
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-background shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-border bg-card">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="font-bold text-lg text-foreground truncate">{mold.name}</h2>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{mold.code}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors mt-0.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Info do molde */}
          <div className="px-6 py-4 space-y-4 border-b border-border">
            <MoldLifecycleBar cyclesUsed={mold.cycles_used || 0} maxCycles={mold.max_cycles} />

            <div className="grid grid-cols-2 gap-3 text-sm">
              {mold.units_per_cycle && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Peças/ciclo</p>
                  <p className="font-semibold text-foreground mt-0.5">{mold.units_per_cycle}</p>
                </div>
              )}
              {mold.acquisition_date && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Aquisição</p>
                  <p className="font-semibold text-foreground mt-0.5">{mold.acquisition_date}</p>
                </div>
              )}
              {mold.last_maintenance_date && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Última Manutenção</p>
                  <p className="font-semibold text-foreground mt-0.5">{mold.last_maintenance_date}</p>
                </div>
              )}
              {mold.product_type_names?.length > 0 && (
                <div className="bg-muted/50 rounded-lg p-3 col-span-2">
                  <p className="text-xs text-muted-foreground mb-1">Artefatos</p>
                  <div className="flex flex-wrap gap-1">
                    {mold.product_type_names.map((n, i) => (
                      <span key={i} className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-medium">{n}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {mold.notes && (
              <p className="text-xs text-muted-foreground italic bg-muted/40 rounded-lg px-3 py-2">{mold.notes}</p>
            )}
          </div>

          {/* Histórico de manutenções */}
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-sm text-foreground">Histórico de Manutenções</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{maintenances.length} registro(s)</p>
              </div>
              <button
                onClick={() => { setEditing(null); setShowForm(true); }}
                className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Nova Manutenção
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-24">
                <div className="w-6 h-6 border-4 border-muted border-t-primary rounded-full animate-spin" />
              </div>
            ) : maintenances.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
                <Wrench className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                Nenhuma manutenção registrada para este molde.
              </div>
            ) : (
              <div className="space-y-3">
                {maintenances.map(m => {
                  const cfg = TYPE_CONFIG[m.maintenance_type] || TYPE_CONFIG['Outros'];
                  const Icon = cfg.icon;
                  return (
                    <div key={m.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
                            <Icon className="w-3 h-3" /> {m.maintenance_type}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {m.date}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setEditing(m); setShowForm(true); }}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(m)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {m.replaced_part && (
                        <p className="text-xs text-foreground flex items-center gap-1.5">
                          <Package className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="font-medium">Peça:</span> {m.replaced_part}
                        </p>
                      )}

                      {m.description && (
                        <p className="text-xs text-muted-foreground leading-relaxed">{m.description}</p>
                      )}

                      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t border-border">
                        {m.technician && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" /> {m.technician}
                          </span>
                        )}
                        {m.duration_minutes && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {m.duration_minutes} min
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {showForm && (
        <MoldMaintenanceForm
          item={editing}
          mold={mold}
          onClose={() => setShowForm(false)}
          onSaved={() => { loadMaintenances(); onMoldUpdated(); }}
        />
      )}
    </>
  );
}