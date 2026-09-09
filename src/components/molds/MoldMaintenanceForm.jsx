import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Zap, Wrench, Droplets, Wind, Settings, CheckSquare, RefreshCw, HelpCircle } from 'lucide-react';

const TYPES = [
  { label: 'Elétrico',       icon: Zap,         color: '#4F46E5' },
  { label: 'Mecânico',       icon: Wrench,       color: '#F97316' },
  { label: 'Pneumático',     icon: Wind,         color: '#06B6D4' },
  { label: 'Hidráulico',     icon: Droplets,     color: '#14B8A6' },
  { label: 'Lubrificação',   icon: RefreshCw,    color: '#F59E0B' },
  { label: 'Inspeção Geral', icon: CheckSquare,  color: '#8B5CF6' },
  { label: 'Troca de Peça',  icon: Settings,     color: '#EC4899' },
  { label: 'Outros',         icon: HelpCircle,   color: '#94A3B8' },
];

export default function MoldMaintenanceForm({ item, mold, onClose, onSaved }) {
  const [form, setForm] = useState(item ? { ...item } : {
    date: new Date().toISOString().split('T')[0],
    mold_id: mold.id,
    mold_name: mold.name,
    machine_id: '',
    machine_name: '',
    maintenance_type: '',
    replaced_part: '',
    description: '',
    technician: '',
    duration_minutes: '',
  });
  const [saving, setSaving] = useState(false);

  function set(field, val) { setForm(f => ({ ...f, [field]: val })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      duration_minutes: parseFloat(form.duration_minutes) || null,
      mold_id: mold.id,
      mold_name: mold.name,
    };
    if (item?.id) {
      await base44.entities.PreventiveMaintenance.update(item.id, payload);
    } else {
      await base44.entities.PreventiveMaintenance.create(payload);
      // Atualiza data da última manutenção no molde
      await base44.entities.Mold.update(mold.id, { last_maintenance_date: form.date });
    }
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="font-semibold text-foreground">{item ? 'Editar Manutenção' : 'Nova Manutenção'}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{mold.name}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Data</label>
            <input type="date" required
              className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.date} onChange={e => set('date', e.target.value)} />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Tipo de Manutenção</label>
            <div className="grid grid-cols-4 gap-2">
              {TYPES.map(({ label, icon: Icon, color }) => (
                <button key={label} type="button"
                  onClick={() => set('maintenance_type', label)}
                  className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                    form.maintenance_type === label
                      ? 'border-transparent text-white shadow-md'
                      : 'border-border text-muted-foreground hover:border-primary/40 bg-background'
                  }`}
                  style={form.maintenance_type === label ? { backgroundColor: color, borderColor: color } : {}}>
                  <Icon className="w-4 h-4" style={{ color: form.maintenance_type === label ? 'white' : color }} />
                  <span className="leading-tight text-center">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Peça Trocada</label>
            <input
              className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.replaced_part} onChange={e => set('replaced_part', e.target.value)}
              placeholder="Ex: Vedação, Parafusos, Superfície..." />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Descrição</label>
            <textarea rows={3}
              className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Descreva o serviço realizado no molde..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Responsável</label>
              <input
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.technician} onChange={e => set('technician', e.target.value)}
                placeholder="Nome do técnico" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Duração (min)</label>
              <input type="number" min="0"
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.duration_minutes} onChange={e => set('duration_minutes', e.target.value)}
                placeholder="60" />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-border rounded-lg py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving || !form.maintenance_type}
              className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
              {saving ? 'Salvando...' : item ? 'Salvar' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}