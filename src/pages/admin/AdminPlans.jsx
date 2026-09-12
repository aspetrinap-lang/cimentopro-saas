import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Pencil, CreditCard } from 'lucide-react';
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('subscriptionManagement', { action: 'listPlans' });
      setPlans(res.data.plans || []);
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
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
          <Plus className="w-4 h-4" /> Novo Plano
        </Button>
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
    </div>
  );
}