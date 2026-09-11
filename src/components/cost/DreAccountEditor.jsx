import { useEffect, useState } from 'react';
import { X, Save } from 'lucide-react';

const CATEGORIES = ['Receita', 'Custo Direto', 'Custo Indireto Variável', 'Despesa Fixa', 'Despesa Financeira'];
const METHODS = [
  { value: 'none', label: 'Não aloca no produto' },
  { value: 'volume', label: 'Rateio por volume (peso produzido)' },
  { value: 'machine_hours', label: 'Rateio por horas de máquina' },
];
export const DRE_SOURCES = [
  { value: 'manual', label: 'Lançamento manual / importação' },
  { value: 'raw_material', label: 'Matéria-prima (consumo de insumos)' },
  { value: 'energy', label: 'Energia elétrica das linhas' },
  { value: 'maintenance', label: 'Manutenção' },
  { value: 'sales', label: 'Vendas / receita' },
];

// Editor de conta da DRE — compartilhado entre o Template Padrão (SUPER_ADMIN)
// e a estrutura da empresa (DreAccountsPanel). `allowSource` exibe a origem
// dos valores (configuração que alimentará a automação da DRE).
export default function DreAccountEditor({ account, accounts = [], allowSource = false, onClose, onSave }) {
  const [form, setForm] = useState({
    name: '', description: '', category: 'Despesa Fixa', apportionment_method: 'none', source_type: 'manual', parent_id: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (account) {
      setForm({
        name: account.name || '',
        description: account.description || '',
        category: account.category || 'Despesa Fixa',
        apportionment_method: account.apportionment_method || 'none',
        source_type: account.source_type || 'manual',
        parent_id: account.parent_id || '',
      });
    }
  }, [account]);

  const parentOptions = accounts.filter((a) => a.id !== account?.id);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || saving) return;
    setSaving(true);
    try {
      await onSave({
        name: form.name.trim(),
        description: form.description.trim(),
        category: form.category,
        apportionment_method: form.apportionment_method,
        ...(allowSource ? { source_type: form.source_type } : {}),
        parent_id: form.parent_id || null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={handleSubmit} className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">{account ? 'Editar Conta' : 'Nova Conta'}</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Nome da conta *</label>
          <input autoFocus className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Descrição</label>
          <input className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Categoria *</label>
            <select className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Método de rateio</label>
            <select className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.apportionment_method} onChange={(e) => setForm((f) => ({ ...f, apportionment_method: e.target.value }))}>
              {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </div>

        {allowSource && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Origem dos valores</label>
            <select className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.source_type} onChange={(e) => setForm((f) => ({ ...f, source_type: e.target.value }))}>
              {DRE_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <p className="text-[11px] text-muted-foreground mt-1">Contas com origem em módulo serão alimentadas automaticamente pelo CimentoPro (Fase 2).</p>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Subconta de (opcional)</label>
          <select className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.parent_id} onChange={(e) => setForm((f) => ({ ...f, parent_id: e.target.value }))}>
            <option value="">— Conta principal —</option>
            {parentOptions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 border border-border rounded-lg py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
          <button type="submit" disabled={saving} className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            <Save className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}