import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Plus, Trash2, ArrowUp, ArrowDown, Save, Layers } from 'lucide-react';

const emptyForm = {
  name: '',
  description: '',
  installed_power_kw: '',
  energy_cost_per_kwh: '',
  production_capacity_per_hour: '',
  machines: [],
  shared_resources: [],
  active: true,
};

export default function ProductionLineForm({ line, onClose, onSaved }) {
  const [form, setForm] = useState(line ? { ...line } : { ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [machines, setMachines] = useState([]);
  const [sharedResources, setSharedResources] = useState([]);

  useEffect(() => {
    base44.entities.Machine.filter({}, 'name').then(setMachines).catch(() => {});
    base44.entities.SharedResource.filter({ active: true }, 'name').then(setSharedResources).catch(() => {});
  }, []);

  const usedPower = (form.machines || []).reduce((s, m) => s + (Number(m.power_kw) || 0), 0);

  function set(field, val) {
    setForm((f) => ({ ...f, [field]: val }));
  }

  function addMachine() {
    setForm((f) => ({
      ...f,
      machines: [...(f.machines || []), { machine_id: '', machine_name: '', sequence_order: (f.machines || []).length + 1, power_kw: '' }],
    }));
  }

  function updateMachine(idx, field, val) {
    setForm((f) => {
      const next = [...(f.machines || [])];
      const m = next[idx];
      if (field === 'machine_id') {
        const found = machines.find((x) => x.id === val);
        next[idx] = { ...m, machine_id: val, machine_name: found ? found.name : '' };
      } else {
        next[idx] = { ...m, [field]: val };
      }
      return { ...f, machines: next };
    });
  }

  function removeMachine(idx) {
    setForm((f) => {
      const next = (f.machines || []).filter((_, i) => i !== idx);
      next.forEach((m, i) => (m.sequence_order = i + 1));
      return { ...f, machines: next };
    });
  }

  function moveMachine(idx, dir) {
    setForm((f) => {
      const arr = [...(f.machines || [])];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return f;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      arr.forEach((m, i) => (m.sequence_order = i + 1));
      return { ...f, machines: arr };
    });
  }

  function addSharedResource() {
    setForm((f) => ({
      ...f,
      shared_resources: [...(f.shared_resources || []), { resource_id: '', resource_name: '', resource_type: '', usage_pct: '' }],
    }));
  }

  function updateSharedResource(idx, field, val) {
    setForm((f) => {
      const next = [...(f.shared_resources || [])];
      const item = next[idx];
      if (field === 'resource_id') {
        const found = sharedResources.find((x) => x.id === val);
        next[idx] = { ...item, resource_id: val, resource_name: found ? found.name : '', resource_type: found ? found.resource_type : '' };
      } else {
        next[idx] = { ...item, [field]: val };
      }
      return { ...f, shared_resources: next };
    });
  }

  function removeSharedResource(idx) {
    setForm((f) => ({ ...f, shared_resources: (f.shared_resources || []).filter((_, i) => i !== idx) }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      installed_power_kw: form.installed_power_kw ? parseFloat(form.installed_power_kw) : null,
      energy_cost_per_kwh: form.energy_cost_per_kwh ? parseFloat(form.energy_cost_per_kwh) : null,
      production_capacity_per_hour: form.production_capacity_per_hour ? parseFloat(form.production_capacity_per_hour) : null,
      target_cycles_per_hour: form.target_cycles_per_hour ? parseFloat(form.target_cycles_per_hour) : null,
      used_power_kw: +usedPower.toFixed(4),
      machines: (form.machines || []).map((m, i) => ({
        ...m,
        sequence_order: i + 1,
        power_kw: m.power_kw ? parseFloat(m.power_kw) : null,
      })),
      shared_resources: (form.shared_resources || []).map((s) => ({
        ...s,
        usage_pct: s.usage_pct ? parseFloat(s.usage_pct) : null,
      })),
    };
    try {
      if (line) {
        await base44.entities.ProductionLine.update(line.id, payload);
      } else {
        await base44.entities.ProductionLine.create(payload);
      }
      onSaved?.();
      onClose?.();
    } finally {
      setSaving(false);
    }
  }

  const machineOptions = machines;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border overflow-y-auto max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="font-semibold text-foreground">{line ? 'Editar Linha' : 'Nova Linha de Produção'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Nome da Linha</label>
              <input className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder="Ex: Linha de Blocos A" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Descrição</label>
              <textarea className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                rows={2} value={form.description || ''} onChange={(e) => set('description', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Potência Instalada (kW)</label>
              <input type="number" min="0" step="0.0001" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.installed_power_kw ?? ''} onChange={(e) => set('installed_power_kw', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Custo de Energia (R$/kWh)</label>
              <input type="number" min="0" step="0.01" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.energy_cost_per_kwh ?? ''} onChange={(e) => set('energy_cost_per_kwh', e.target.value)} placeholder="Ex: 0.85" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Capacidade Nominal (ciclos/hora)</label>
              <input type="number" min="0" step="1" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.production_capacity_per_hour ?? ''} onChange={(e) => set('production_capacity_per_hour', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Meta Velocidade de Cruzeiro (ciclos/hora)</label>
              <input type="number" min="0" step="1" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.target_cycles_per_hour ?? ''} onChange={(e) => set('target_cycles_per_hour', e.target.value)} placeholder="Base do rateio DRE" />
            </div>
          </div>

          {/* Sequência de máquinas */}
          <div className="border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-foreground">Sequência de Equipamentos</p>
                <p className="text-xs text-muted-foreground">Potência utilizada: <strong className="text-foreground">{usedPower.toFixed(4)} kW</strong></p>
              </div>
              <button type="button" onClick={addMachine} className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Adicionar Máquina
              </button>
            </div>
            {(form.machines || []).length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhuma máquina vinculada. Clique em "Adicionar Máquina".</p>
            ) : (
              <div className="space-y-2">
                {(form.machines || []).map((m, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-muted/40 rounded-lg p-2 border border-border">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs shrink-0">{idx + 1}</span>
                    <select className="flex-1 border border-input rounded-lg px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      value={m.machine_id} onChange={(e) => updateMachine(idx, 'machine_id', e.target.value)}>
                      <option value="">Selecione...</option>
                      {machineOptions.map((mo) => <option key={mo.id} value={mo.id}>{mo.name} ({mo.code})</option>)}
                    </select>
                    <input type="number" min="0" step="0.0001" placeholder="kW" className="w-20 border border-input rounded-lg px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      value={m.power_kw ?? ''} onChange={(e) => updateMachine(idx, 'power_kw', e.target.value)} />
                    <div className="flex flex-col gap-0.5">
                      <button type="button" onClick={() => moveMachine(idx, -1)} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => moveMachine(idx, 1)} disabled={idx === (form.machines || []).length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button>
                    </div>
                    <button type="button" onClick={() => removeMachine(idx)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recursos compartilhados */}
          <div className="border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-primary" /> Recursos Compartilhados
                </p>
                <p className="text-xs text-muted-foreground">Rateio de custo conforme % de uso (ex: central dosadora usada por várias linhas)</p>
              </div>
              <button type="button" onClick={addSharedResource} className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Adicionar Recurso
              </button>
            </div>
            {(form.shared_resources || []).length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum recurso compartilhado vinculado.</p>
            ) : (
              <div className="space-y-2">
                {(form.shared_resources || []).map((s, idx) => {
                  const res = sharedResources.find((x) => x.id === s.resource_id);
                  return (
                    <div key={idx} className="flex items-center gap-2 bg-muted/40 rounded-lg p-2 border border-border">
                      <select className="flex-1 border border-input rounded-lg px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                        value={s.resource_id} onChange={(e) => updateSharedResource(idx, 'resource_id', e.target.value)}>
                        <option value="">Selecione...</option>
                        {sharedResources.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.resource_type})</option>)}
                      </select>
                      <input type="number" min="0" max="100" step="1" placeholder="% uso" className="w-24 border border-input rounded-lg px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                        value={s.usage_pct ?? ''} onChange={(e) => updateSharedResource(idx, 'usage_pct', e.target.value)} />
                      <span className="text-xs text-muted-foreground">%</span>
                      {res?.cost_per_hour != null && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{Number(res.cost_per_hour).toFixed(2)}/h</span>
                      )}
                      <button type="button" onClick={() => removeSharedResource(idx)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  );
                })}
                <p className="text-[10px] text-muted-foreground">
                  Soma total de % de todas as linhas deve ser 100% por recurso. Custo rateado = (custo/h × horas produção) × (% uso / 100).
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="line-active" checked={form.active !== false} onChange={(e) => set('active', e.target.checked)} className="rounded" />
            <label htmlFor="line-active" className="text-xs text-muted-foreground">Linha ativa</label>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-border rounded-lg py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              <Save className="w-4 h-4" /> {saving ? 'Salvando...' : line ? 'Salvar Alterações' : 'Criar Linha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}