import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Zap, Wrench, Droplets, Wind, Settings, CheckSquare, RefreshCw, HelpCircle } from 'lucide-react';

const TYPES = [
  { label: 'Elétrico', icon: Zap, color: '#4F46E5' },
  { label: 'Mecânico', icon: Wrench, color: '#F97316' },
  { label: 'Pneumático', icon: Wind, color: '#06B6D4' },
  { label: 'Hidráulico', icon: Droplets, color: '#14B8A6' },
  { label: 'Lubrificação', icon: RefreshCw, color: '#F59E0B' },
  { label: 'Inspeção Geral', icon: CheckSquare, color: '#8B5CF6' },
  { label: 'Troca de Peça', icon: Settings, color: '#EC4899' },
  { label: 'Outros', icon: HelpCircle, color: '#94A3B8' },
];

const empty = {
  date: new Date().toISOString().split('T')[0],
  machine_id: '',
  machine_name: '',
  mold_id: '',
  mold_name: '',
  maintenance_type: '',
  replaced_part: '',
  description: '',
  technician: '',
  duration_minutes: '',
};

export default function PreventiveMaintenanceForm({ item, onClose, onSaved }) {
  const [form, setForm] = useState(item ? { ...item } : empty);
  const [targetType, setTargetType] = useState(item?.mold_id ? 'mold' : 'machine');
  const [machines, setMachines] = useState([]);
  const [molds, setMolds] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.entities.Machine.filter({ active: true }, 'name').then(setMachines);
    base44.entities.Mold.filter({ status: 'Ativo' }, 'name').then(setMolds);
  }, []);

  function set(field, val) { setForm(f => ({ ...f, [field]: val })); }

  function handleTargetTypeChange(type) {
    setTargetType(type);
    // Limpar o campo do outro tipo ao trocar
    if (type === 'machine') {
      setForm(f => ({ ...f, mold_id: '', mold_name: '' }));
    } else {
      setForm(f => ({ ...f, machine_id: '', machine_name: '' }));
    }
  }

  function handleMachineChange(id) {
    const m = machines.find(m => m.id === id);
    setForm(f => ({ ...f, machine_id: id, machine_name: m ? m.name : '' }));
  }

  function handleMoldChange(id) {
    const m = molds.find(m => m.id === id);
    setForm(f => ({ ...f, mold_id: id, mold_name: m ? m.name : '' }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, duration_minutes: parseFloat(form.duration_minutes) || null };
    if (item?.id) {
      await base44.entities.PreventiveMaintenance.update(item.id, payload);
    } else {
      await base44.entities.PreventiveMaintenance.create(payload);
    }
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">{item ? 'Editar Manutenção' : 'Nova Manutenção Preventiva'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {/* Tipo de alvo: Máquina ou Molde */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Manutenção em</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button"
                onClick={() => handleTargetTypeChange('machine')}
                className={`py-2.5 rounded-xl border text-sm font-medium transition-all ${targetType === 'machine' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/40 bg-background'}`}>
                Máquina
              </button>
              <button type="button"
                onClick={() => handleTargetTypeChange('mold')}
                className={`py-2.5 rounded-xl border text-sm font-medium transition-all ${targetType === 'mold' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/40 bg-background'}`}>
                Molde
              </button>
            </div>
          </div>

          {/* Data + Máquina ou Molde */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Data</label>
              <input type="date" required
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            {targetType === 'machine' ? (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Máquina</label>
                <select
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.machine_id} onChange={e => handleMachineChange(e.target.value)}>
                  <option value="">Selecione...</option>
                  {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Molde</label>
                <select
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.mold_id} onChange={e => handleMoldChange(e.target.value)}>
                  <option value="">Selecione...</option>
                  {molds.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Tipo de manutenção */}
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

          {/* Peça trocada */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Peça Trocada</label>
            <input
              className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.replaced_part} onChange={e => set('replaced_part', e.target.value)}
              placeholder="Ex: Correia dentada, Filtro de ar..." />
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Descrição</label>
            <textarea rows={3}
              className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Descreva o serviço realizado..." />
          </div>

          {/* Responsável + Duração */}
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
            <button type="button" onClick={onClose} className="flex-1 border border-border rounded-lg py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
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