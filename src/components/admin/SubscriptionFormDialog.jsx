import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { X, Loader2, Save } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'trial', label: 'Trial' },
  { value: 'active', label: 'Ativa' },
  { value: 'past_due', label: 'Vencida' },
  { value: 'suspended', label: 'Suspensa' },
  { value: 'cancelled', label: 'Cancelada' },
];

// Atribuição/edição da assinatura de uma empresa (SUPER_ADMIN). A cobrança é
// manual — o vínculo e as datas registrados aqui controlam o acesso da
// empresa aos módulos e limites do plano.
export default function SubscriptionFormDialog({ company, subscription, plans, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    plan_id: subscription?.plan_id || '',
    status: subscription?.status || 'active',
    start_date: subscription?.start_date || '',
    end_date: subscription?.end_date || '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!form.plan_id && plans.length) {
      setForm((f) => ({ ...f, plan_id: plans[0].id }));
    }
  }, [plans]); // eslint-disable-line react-hooks/exhaustive-deps

  function set(field, val) { setForm((f) => ({ ...f, [field]: val })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.plan_id) {
      toast({ title: 'Selecione um plano', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await base44.functions.invoke('subscriptionManagement', {
        action: 'saveSubscription',
        company_id: company.company_id,
        plan_id: form.plan_id,
        status: form.status,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      });
      toast({
        title: subscription ? 'Assinatura atualizada' : 'Assinatura definida',
        description: `${company.company_name} — o acesso da empresa passa a valer imediatamente.`,
      });
      onSaved?.();
      onClose?.();
    } catch (err) {
      toast({
        title: 'Não foi possível salvar a assinatura',
        description: err.response?.data?.error || err.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring';
  const selectedPlan = plans.find((p) => p.id === form.plan_id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card">
          <div>
            <h2 className="font-semibold text-foreground">{subscription ? 'Editar Assinatura' : 'Definir Assinatura'}</h2>
            <p className="text-xs text-muted-foreground">{company.company_name}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Plano *</label>
            <select className={inputCls} value={form.plan_id} onChange={(e) => set('plan_id', e.target.value)} required>
              {plans.length === 0 && <option value="">Nenhum plano ativo — crie um plano primeiro</option>}
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.price ? ` — R$ ${Number(p.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Situação *</label>
              <select className={inputCls} value={form.status} onChange={(e) => set('status', e.target.value)}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            {selectedPlan?.price != null && (
              <div className="flex items-end">
                <p className="text-xs text-muted-foreground">
                  Preço do plano: <strong className="text-foreground">R$ {Number(selectedPlan.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>/mês
                </p>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Início</label>
              <input type="date" className={inputCls} value={form.start_date || ''} onChange={(e) => set('start_date', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Vencimento</label>
              <input type="date" className={inputCls} value={form.end_date || ''} onChange={(e) => set('end_date', e.target.value)} />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">
            A cobrança é gerida manualmente fora da plataforma. A situação e o vencimento definidos aqui
            controlam o acesso da empresa: vencida, suspensa ou cancelada, a empresa é bloqueada até a regularização.
          </p>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-border rounded-lg py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
            <button type="submit" disabled={saving || !plans.length} className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Salvando...' : 'Salvar Assinatura'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}