import { useCallback, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Search, ReceiptText, Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import SubscriptionFormDialog from '@/components/admin/SubscriptionFormDialog';

const SUB_STATUS = {
  trial: { label: 'Trial', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  active: { label: 'Ativa', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  past_due: { label: 'Vencida', cls: 'bg-red-50 text-red-700 border-red-200' },
  suspended: { label: 'Suspensa', cls: 'bg-red-50 text-red-700 border-red-200' },
  cancelled: { label: 'Cancelada', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};

const COMPANY_STATUS = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  trial: 'bg-amber-50 text-amber-700 border-amber-200',
  suspended: 'bg-red-50 text-red-700 border-red-200',
  inactive: 'bg-slate-100 text-slate-500 border-slate-200',
};

const COMPANY_STATUS_LABELS = { active: 'Ativo', suspended: 'Suspenso', inactive: 'Inativo', trial: 'Trial' };

function fmtDate(d) {
  return d ? new Date(`${d}T00:00:00`).toLocaleDateString('pt-BR') : '—';
}

// Gestão de assinaturas por empresa (SUPER_ADMIN). A cobrança é manual —
// aqui o SUPER_ADMIN define plano, situação e vigência de cada empresa.
export default function AdminSubscriptions() {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('subscriptionManagement', { action: 'listSubscriptions' });
      setRows(res.data.companies || []);
      setPlans(res.data.plans || []);
    } catch (e) {
      toast({ title: 'Erro ao carregar assinaturas', description: e.response?.data?.error || e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      r.company_name.toLowerCase().includes(q) || (r.subscription?.plan_name || '').toLowerCase().includes(q));
  }, [rows, search]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Assinaturas</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Plano, situação e vigência de cada empresa — cobrança gerida manualmente fora da plataforma
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por empresa ou plano..."
          className="pl-9 bg-white"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 text-sm">
          <div className="flex flex-col items-center gap-3">
            <ReceiptText className="w-8 h-8 text-slate-300" />
            Nenhuma empresa encontrada.
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="text-slate-500">Empresa</TableHead>
                <TableHead className="text-slate-500">Plano</TableHead>
                <TableHead className="text-slate-500">Situação</TableHead>
                <TableHead className="text-slate-500">Vigência</TableHead>
                <TableHead className="text-slate-500 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const st = r.subscription ? SUB_STATUS[r.subscription.status] : null;
                return (
                  <TableRow key={r.company_id} className="bg-white">
                    <TableCell>
                      <p className="font-medium text-slate-900">{r.company_name}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium ${COMPANY_STATUS[r.company_status] || COMPANY_STATUS.inactive}`}>
                        {COMPANY_STATUS_LABELS[r.company_status] || r.company_status}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-600 text-sm">
                      {r.subscription?.plan_name || (
                        <span className="text-slate-400">Sem assinatura — acesso livre (legado)</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {st ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${st.cls}`}>
                          {st.label}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-600 text-sm">
                      {r.subscription ? `${fmtDate(r.subscription.start_date)} → ${fmtDate(r.subscription.end_date)}` : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing(r)}
                        className="h-8 gap-1.5 px-2 text-slate-500 hover:text-indigo-600"
                        title={r.subscription ? 'Editar assinatura' : 'Definir assinatura'}
                      >
                        {r.subscription ? <Pencil className="w-4 h-4" /> : <><Plus className="w-4 h-4" /> Definir</>}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {editing && (
        <SubscriptionFormDialog
          company={editing}
          subscription={editing.subscription}
          plans={plans}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}