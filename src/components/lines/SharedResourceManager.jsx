import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Plus, Pencil, Trash2, Save, Layers } from 'lucide-react';

const emptyForm = {
  name: '',
  description: '',
  resource_type: 'Central Dosadora',
  cost_per_hour: '',
  power_kw: '',
  active: true,
};

const TYPES = ['Central Dosadora', 'Compressor', 'Silo', 'Esteira', 'Outros'];

export default function SharedResourceManager({ onClose, onSaved }) {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await base44.entities.SharedResource.list('name', 200);
      setResources(data);
    } catch {
      setResources([]);
    } finally {
      setLoading(false);
    }
  }

  function set(field, val) {
    setForm((f) => ({ ...f, [field]: val }));
  }

  function startNew() {
    setEditing('new');
    setForm({ ...emptyForm });
  }

  function startEdit(r) {
    setEditing(r.id);
    setForm({ ...r });
  }

  function cancelEdit() {
    setEditing(null);
    setForm({ ...emptyForm });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name,
      description: form.description || '',
      resource_type: form.resource_type,
      cost_per_hour: form.cost_per_hour ? parseFloat(form.cost_per_hour) : null,
      power_kw: form.power_kw ? parseFloat(form.power_kw) : null,
      active: form.active !== false,
    };
    try {
      if (editing === 'new') {
        await base44.entities.SharedResource.create(payload);
      } else {
        await base44.entities.SharedResource.update(editing, payload);
      }
      setEditing(null);
      setForm({ ...emptyForm });
      await load();
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(r) {
    if (!confirm(`Excluir o recurso "${r.name}"?`)) return;
    await base44.entities.SharedResource.delete(r.id);
    load();
    onSaved?.();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border overflow-y-auto max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" /> Recursos Compartilhados
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Cadastre recursos compartilhados entre linhas (ex: central dosadora). O custo é rateado conforme o uso por linha.</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          {editing ? (
            <form onSubmit={handleSubmit} className="border border-border rounded-xl p-4 space-y-3 bg-muted/20">
              <p className="text-xs font-semibold text-foreground">{editing === 'new' ? 'Novo Recurso' : 'Editar Recurso'}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Nome</label>
                  <input className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder="Ex: Central Dosadora 1" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo</label>
                  <select className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    value={form.resource_type} onChange={(e) => set('resource_type', e.target.value)}>
                    {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Custo por Hora (R$/h)</label>
                  <input type="number" min="0" step="0.01" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    value={form.cost_per_hour ?? ''} onChange={(e) => set('cost_per_hour', e.target.value)} placeholder="Ex: 25.00" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Potência (kW)</label>
                  <input type="number" min="0" step="0.0001" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    value={form.power_kw ?? ''} onChange={(e) => set('power_kw', e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Descrição</label>
                  <textarea rows={2} className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    value={form.description || ''} onChange={(e) => set('description', e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={cancelEdit} className="flex-1 border border-border rounded-lg py-2 text-sm font-medium text-muted-foreground hover:bg-muted">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 bg-primary text-primary-foreground rounded-lg py-2 text-sm font-medium hover:bg-primary/90 flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          ) : (
            <button onClick={startNew} className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Novo Recurso
            </button>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8"><div className="w-6 h-6 border-2 border-slate-200 border-t-primary rounded-full animate-spin" /></div>
          ) : resources.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Nenhum recurso cadastrado.</p>
          ) : (
            <div className="space-y-2">
              {resources.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 bg-muted/40 rounded-lg p-3 border border-border">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary mr-1.5">{r.resource_type}</span>
                      {r.cost_per_hour != null && <>R$ {Number(r.cost_per_hour).toFixed(2)}/h</>}
                      {r.power_kw != null && <> • {Number(r.power_kw).toFixed(2)} kW</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => startEdit(r)} className="p-1.5 text-muted-foreground hover:text-primary rounded-lg hover:bg-muted"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(r)} className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-muted"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}