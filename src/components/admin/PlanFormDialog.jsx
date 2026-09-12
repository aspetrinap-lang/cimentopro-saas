import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { X, Loader2, Save } from 'lucide-react';
import { PLAN_MODULES } from '@/lib/planModules';

const emptyForm = {
  name: '',
  description: '',
  price: '',
  max_users: '',
  max_machines: '',
  max_production_lines: '',
  features: [],
  status: 'active',
};

// Criação/edição de plano da plataforma (SUPER_ADMIN). Planos com empresas
// vinculadas nunca são excluídos — apenas desativados logicamente.
export default function PlanFormDialog({ plan, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (plan) {
      setForm({
        name: plan.name || '',
        description: plan.description || '',
        price: plan.price ?? '',
        max_users: plan.max_users ?? '',
        max_machines: plan.max_machines ?? '',
        max_production_lines: plan.max_production_lines ?? '',
        features: plan.features || [],
        status: plan.status || 'active',
      });
    } else {
      setForm(emptyForm);
    }
  }, [plan]);

  function set(field, val) { setForm((f) => ({ ...f, [field]: val })); }

  function toggleModule(key) {
    setForm((f) => ({
      ...f,
      features: f.features.includes(key)
        ? f.features.filter((k) => k !== key)
        : [...f.features, key],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.features.length) {
      toast({
        title: 'Selecione ao menos um módulo',
        description: 'O plano precisa incluir os módulos que as empresas poderão usar.',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      await base44.functions.invoke('subscriptionManagement', {
        action: 'savePlan',
        plan_id: plan?.id,
        name: form.name.trim(),
        description: form.description,
        price: form.price === '' ? 0 : Number(form.price),
        max_users: form.max_users === '' ? null : Number(form.max_users),
        max_machines: form.max_machines === '' ? null : Number(form.max_machines),
        max_production_lines: form.max_production_lines === '' ? null : Number(form.max_production_lines),
        features: form.features,
        status: form.status,
      });
      toast({ title: plan ? 'Plano atualizado' : 'Plano criado' });
      onSaved?.();
      onClose?.();
    } catch (err) {
      toast({
        title: 'Não foi possível salvar o plano',
        description: err.response?.data?.error || err.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card">
          <h2 className="font-semibold text-foreground">{plan ? 'Editar Plano' : 'Novo Plano'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Nome do Plano *</label>
              <input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex: Professional" required />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Descrição</label>
              <input className={inputCls} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Público-alvo, o que inclui..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Preço Mensal (R$)</label>
              <input type="number" min="0" step="0.01" className={inputCls} value={form.price} onChange={(e) => set('price', e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Situação</label>
              <select className={inputCls} value={form.status} onChange={(e) => set('status', e.target.value)}>
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Limite de Usuários</label>
              <input type="number" min="0" step="1" className={inputCls} value={form.max_users} onChange={(e) => set('max_users', e.target.value)} placeholder="Ilimitado" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Limite de Máquinas</label>
              <input type="number" min="0" step="1" className={inputCls} value={form.max_machines} onChange={(e) => set('max_machines', e.target.value)} placeholder="Ilimitado" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Limite de Linhas de Produção</label>
              <input type="number" min="0" step="1" className={inputCls} value={form.max_production_lines} onChange={(e) => set('max_production_lines', e.target.value)} placeholder="Ilimitado" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Módulos Incluídos *</label>
            <div className="grid grid-cols-1 gap-2">
              {PLAN_MODULES.map((m) => (
                <label
                  key={m.key}
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    form.features.includes(m.key) ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.features.includes(m.key)}
                    onChange={() => toggleModule(m.key)}
                    className="mt-0.5 rounded"
                  />
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-foreground">{m.label}</span>
                    <span className="block text-[11px] text-muted-foreground leading-snug">{m.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-border rounded-lg py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Salvando...' : plan ? 'Salvar' : 'Criar Plano'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}