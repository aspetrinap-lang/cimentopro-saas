import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, AlertTriangle } from 'lucide-react';

const CATEGORIES = ['Elétrico', 'Mecânico', 'Pneumático', 'Hidráulico', 'Operacional', 'Manutenção Preventiva', 'Falta de Material', 'Outros'];

const empty = {
  machine_id: '',
  machine_name: '',
  date: new Date().toISOString().split('T')[0],
  start_time: '',
  end_time: '',
  duration_minutes: '',
  failure_category: '',
  failure_description: '',
  corrective_action: '',
  recurrent_pattern_id: '',
};

export default function MachineDowntimeForm({ item, prefillMachineId, prefillMachineNme, prefillDate, prefillOrderId, prefillOrderNumber, onClose, onSaved }) {
  const [form, setForm] = useState(item ? { ...item } : {
    ...empty,
    machine_id: prefillMachineId || '',
    machine_name: prefillMachineNme || '',
    date: prefillDate || empty.date,
    order_id: prefillOrderId || '',
    order_number: prefillOrderNumber || '',
  });
  const [machines, setMachines] = useState([]);
  const [patterns, setPatterns] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.entities.Machine.filter({ active: true }, 'name'),
      base44.entities.FailurePattern.filter({ active: true }, 'name'),
    ]).then(([m, p]) => { setMachines(m); setPatterns(p); });
  }, []);

  function set(field, val) { setForm(f => ({ ...f, [field]: val })); }

  function handleTimeChange(field, val) {
    const updated = { ...form, [field]: val };
    // Calcular duração automaticamente
    if (updated.start_time && updated.end_time) {
      const [sh, sm] = updated.start_time.split(':').map(Number);
      const [eh, em] = updated.end_time.split(':').map(Number);
      let mins = (eh * 60 + em) - (sh * 60 + sm);
      if (mins < 0) mins += 24 * 60;
      updated.duration_minutes = mins;
    }
    setForm(updated);
  }

  function handlePatternChange(id) {
    set('recurrent_pattern_id', id);
    if (id) {
      const p = patterns.find(p => p.id === id);
      if (p) {
        setForm(f => ({
          ...f,
          recurrent_pattern_id: id,
          failure_category: p.failure_category,
          failure_description: p.description || f.failure_description,
          duration_minutes: p.typical_duration_minutes || f.duration_minutes,
        }));
      }
    }
  }

  function handleMachineChange(id) {
    const m = machines.find(m => m.id === id);
    setForm(f => ({ ...f, machine_id: id, machine_name: m ? m.name : '' }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, duration_minutes: parseFloat(form.duration_minutes) || 0 };
    if (item?.id) {
      await base44.entities.MachineDowntime.update(item.id, payload);
    } else {
      await base44.entities.MachineDowntime.create(payload);
    }
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h2 className="font-semibold text-foreground">{item ? 'Editar Parada de Máquina' : 'Registrar Parada de Máquina'}</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Máquina + Data */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Máquina</label>
              <select className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.machine_id} onChange={e => handleMachineChange(e.target.value)} required>
                <option value="">Selecione...</option>
                {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Data</label>
              <input type="date" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.date} onChange={e => set('date', e.target.value)} required />
            </div>
          </div>

          {/* Horários */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Início</label>
              <input type="time" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.start_time} onChange={e => handleTimeChange('start_time', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Fim</label>
              <input type="time" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.end_time} onChange={e => handleTimeChange('end_time', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Duração (min)</label>
              <input type="number" min="0" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.duration_minutes} onChange={e => set('duration_minutes', e.target.value)} required />
            </div>
          </div>

          {/* Padrão recorrente */}
          {patterns.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Padrão de Falha Recorrente (opcional)</label>
              <select className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.recurrent_pattern_id} onChange={e => handlePatternChange(e.target.value)}>
                <option value="">Selecione um padrão...</option>
                {patterns.map(p => <option key={p.id} value={p.id}>{p.name} — {p.failure_category}</option>)}
              </select>
            </div>
          )}

          {/* Categoria */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Categoria da Falha</label>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map(cat => (
                <button key={cat} type="button"
                  onClick={() => set('failure_category', cat)}
                  className={`px-2 py-1.5 text-xs rounded-lg border font-medium transition-all ${form.failure_category === cat
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Descrição da Falha</label>
            <textarea className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none" rows={2}
              value={form.failure_description} onChange={e => set('failure_description', e.target.value)}
              placeholder="Descreva o problema ocorrido..." />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Ação Corretiva Tomada</label>
            <textarea className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none" rows={2}
              value={form.corrective_action} onChange={e => set('corrective_action', e.target.value)}
              placeholder="O que foi feito para resolver..." />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-border rounded-lg py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
            <button type="submit" disabled={saving || !form.failure_category}
              className="flex-1 bg-amber-500 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-60">
              {saving ? 'Salvando...' : item ? 'Salvar Alterações' : 'Registrar Parada'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}