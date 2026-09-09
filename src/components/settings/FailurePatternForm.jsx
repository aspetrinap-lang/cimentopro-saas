import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X } from 'lucide-react';

const CATEGORIES = ['Elétrico', 'Mecânico', 'Pneumático', 'Hidráulico', 'Operacional', 'Manutenção Preventiva', 'Falta de Material', 'Outros'];

const empty = { name: '', failure_category: '', description: '', typical_duration_minutes: '', recommended_action: '', active: true };

export default function FailurePatternForm({ item, onClose, onSaved }) {
  const [form, setForm] = useState(item ? { ...item } : empty);
  const [saving, setSaving] = useState(false);

  function set(field, val) { setForm(f => ({ ...f, [field]: val })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, typical_duration_minutes: parseFloat(form.typical_duration_minutes) || null };
    if (item?.id) {
      await base44.entities.FailurePattern.update(item.id, payload);
    } else {
      await base44.entities.FailurePattern.create(payload);
    }
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">{item ? 'Editar Padrão de Falha' : 'Novo Padrão de Falha'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Nome do Padrão</label>
            <input className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Sobrecarga no motor" required />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Categoria</label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(cat => (
                <button key={cat} type="button"
                  onClick={() => set('failure_category', cat)}
                  className={`px-3 py-2 text-xs rounded-lg border font-medium transition-all text-left ${form.failure_category === cat
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Descrição</label>
            <textarea className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none" rows={2}
              value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Sintomas e contexto típico desta falha..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Duração Típica (min)</label>
              <input type="number" min="0" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.typical_duration_minutes} onChange={e => set('typical_duration_minutes', e.target.value)} placeholder="30" />
            </div>
            <div className="flex items-end">
              <div className="flex items-center gap-2 pb-2">
                <input type="checkbox" id="active" checked={form.active !== false} onChange={e => set('active', e.target.checked)} className="rounded" />
                <label htmlFor="active" className="text-sm text-muted-foreground">Ativo</label>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Ação Recomendada</label>
            <textarea className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none" rows={2}
              value={form.recommended_action} onChange={e => set('recommended_action', e.target.value)}
              placeholder="O que fazer quando essa falha ocorrer..." />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-border rounded-lg py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
            <button type="submit" disabled={saving || !form.failure_category}
              className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
              {saving ? 'Salvando...' : item ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}