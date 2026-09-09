import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X } from 'lucide-react';

const empty = { name: '', active: true };

export default function ProductCategoryForm({ item, onClose, onSaved }) {
  const [form, setForm] = useState(item ? { ...item } : empty);
  const [saving, setSaving] = useState(false);

  function set(field, val) { setForm(f => ({ ...f, [field]: val })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    if (item?.id) {
      await base44.entities.ProductCategory.update(item.id, form);
    } else {
      await base44.entities.ProductCategory.create(form);
    }
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">{item ? 'Editar Categoria' : 'Nova Categoria'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Nome da Categoria</label>
            <input
              className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="ex: Blocos de Concreto"
              required
            />
          </div>
          <div className="flex items-center gap-2">
            <input id="cat-active" type="checkbox" checked={form.active !== false} onChange={e => set('active', e.target.checked)} className="rounded border-input" />
            <label htmlFor="cat-active" className="text-sm text-muted-foreground">Ativo</label>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-border rounded-lg py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
              {saving ? 'Salvando...' : item ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}