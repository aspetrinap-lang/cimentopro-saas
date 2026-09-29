import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Pencil, CreditCard, CalendarClock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import PlanFormDialog from '@/components/admin/PlanFormDialog';
import { PLAN_MODULES } from '@/lib/planModules';

const MODULE_LABELS = Object.fromEntries(PLAN_MODULES.map((m) => [m.key, m.label]));

function limitLabel(v) {
  return v ? String(v) : 'Ilimitado';
}

// Gestão de planos da plataforma (SUPER_ADMIN). Planos com empresas vinculadas
// nunca são excluídos — a desativação é lógica (Situação: Inativo).
export default function AdminPlans() {
  const { toast } = useToast();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [trialDays, setTrialDays] = useState(15);
  const [trialOpen, setTrialOpen] = useState(false);
  const [trialSaving, setTrialSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('subscriptionManagement', { action: 'listPlans' });
      setPlans(res.data.plans || []);
      const cfg = await base44.functions.invoke('subscriptionManagement', { action: 'getConfig' });
      setTrialDays(cfg.data?.config?.trial_days ?? 15);
    } catch (e) {
      toast({ title: 'Erro ao carregar planos', description: e.response?.data?.error || e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Planos</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Planos da plataforma — definem os módulos e limites de cadastro de cada empresa assinante
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setTrialOpen(true)} className="gap-2">
            <CalendarClock className="w-4 h-4" /> Trial: {trialDays} dias
          </Button>
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
            <Plus className="w-4 h-4" /> Novo Plano
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 text-sm">
          <div className="flex flex-col items-center gap-3">
            <CreditCard className="w-8 h-8 text-slate-300" />
            Nenhum plano cadastrado. Crie o primeiro plano da plataforma.
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="text-slate-500">Plano</TableHead>
                <TableHead className="text-slate-500">Preço mensal</TableHead>
                <TableHead className="text-slate-500">Preço anual</TableHead>
                <TableHead className="text-slate-500 text-center">Usuários</TableHead>
                <TableHead className="text-slate-500 text-center">Máquinas</TableHead>
                <TableHead className="text-slate-500 text-center">Linhas</TableHead>
                <TableHead className="text-slate-500">Módulos</TableHead>
                <TableHead className="text-slate-500 text-center">Empresas</TableHead>
                <TableHead className="text-slate-500">Situação</TableHead>
                <TableHead className="text-slate-500 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((p) => (
                <TableRow key={p.id} className="bg-white">
                  <TableCell>
                    <p className="font-medium text-slate-900">{p.name}</p>
                    {p.description && <p className="text-xs text-slate-400">{p.description}</p>}
                  </TableCell>
                  <TableCell className="text-slate-600 text-sm">
                    {p.price ? `R$ ${Number(p.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                  </TableCell>
                  <TableCell className="text-slate-600 text-sm">
                    {p.annual_price ? `R$ ${Number(p.annual_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                  </TableCell>
                  <TableCell className="text-center text-slate-600 text-sm">{limitLabel(p.max_users)}</TableCell>
                  <TableCell className="text-center text-slate-600 text-sm">{limitLabel(p.max_machines)}</TableCell>
                  <TableCell className="text-center text-slate-600 text-sm">{limitLabel(p.max_production_lines)}</TableCell>
                  <TableCell className="text-slate-600 text-sm">
                    <span title={(p.features || []).map((f) => MODULE_LABELS[f] || f).join(', ')}>
                      {(p.features || []).length} módulo{(p.features || []).length === 1 ? '' : 's'}
                    </span>
                  </TableCell>
                  <TableCell className="text-center text-slate-600 font-medium">{p.company_count || 0}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${
                      p.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                      {p.status === 'active' ? 'Ativo' : 'Inativo'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(p); setDialogOpen(true); }}
                      className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900" title="Editar plano">
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {dialogOpen && (
        <PlanFormDialog
          plan={editing}
          onClose={() => setDialogOpen(false)}
          onSaved={load}
        />
      )}

      {trialOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-indigo-600" /> Dias de Trial
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Configuração global da plataforma. Vale apenas para novos trials — empresas recém-criadas começam automaticamente em trial por este período.
            </p>
            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-500 mb-1">Dias de trial</label>
              <input
                type="number" min="1" max="365" step="1"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                value={trialDays}
                onChange={(e) => setTrialDays(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setTrialOpen(false)} className="flex-1 border border-slate-200 rounded-lg py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors">Cancelar</button>
              <button
                disabled={trialSaving || !Number.isInteger(Number(trialDays)) || Number(trialDays) < 1}
                onClick={async () => {
                  setTrialSaving(true);
                  try {
                    const res = await base44.functions.invoke('subscriptionManagement', { action: 'saveConfig', trial_days: Number(trialDays) });
                    setTrialDays(res.data.config.trial_days);
                    toast({ title: 'Configuração salva', description: `Novos trials terão ${res.data.config.trial_days} dias.` });
                    setTrialOpen(false);
                  } catch (e) {
                    toast({ title: 'Não foi possível salvar', description: e.response?.data?.error || e.message, variant: 'destructive' });
                  } finally {
                    setTrialSaving(false);
                  }
                }}
                className="flex-1 bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {trialSaving && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}