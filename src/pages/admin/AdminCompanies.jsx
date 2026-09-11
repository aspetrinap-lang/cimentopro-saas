import { useCallback, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Pencil, Ban, RefreshCw, Search, Building2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import CompanyFormDialog from '@/components/admin/CompanyFormDialog';
import CompanyMembersDialog from '@/components/admin/CompanyMembersDialog';

const STATUS_STYLES = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  suspended: 'bg-red-50 text-red-700 border-red-200',
  inactive: 'bg-slate-100 text-slate-500 border-slate-200',
  trial: 'bg-amber-50 text-amber-700 border-amber-200',
};

const STATUS_LABELS = {
  active: 'Ativo', suspended: 'Suspenso', inactive: 'Inativo', trial: 'Trial',
};

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${STATUS_STYLES[status] || STATUS_STYLES.inactive}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export default function AdminCompanies() {
  const { toast } = useToast();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [membersCompany, setMembersCompany] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('adminCompanies', { action: 'list' });
      setCompanies(res.data.companies || []);
    } catch (e) {
      toast({ title: 'Erro ao carregar empresas', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) =>
      [c.name, c.legal_name, c.document, c.email, c.city].some((v) => (v || '').toLowerCase().includes(q)));
  }, [companies, search]);

  async function handleStatusChange() {
    if (!confirm) return;
    setSaving(true);
    try {
      await base44.functions.invoke('adminCompanies', {
        action: confirm.type,
        company_id: confirm.company.id,
      });
      toast({ title: confirm.type === 'suspend' ? 'Empresa suspensa' : 'Empresa reativada' });
      setConfirm(null);
      load();
    } catch (e) {
      toast({ title: 'Erro ao atualizar status', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Empresas</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Empresas cadastradas na plataforma CimentoPro — dados isolados por empresa
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
          <Plus className="w-4 h-4" /> Nova Empresa
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, CNPJ, e-mail..."
          className="pl-9 bg-white"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 text-sm">
          {companies.length === 0 ? (
            <div className="flex flex-col items-center gap-3">
              <Building2 className="w-8 h-8 text-slate-300" />
              Nenhuma empresa cadastrada na plataforma ainda.
            </div>
          ) : 'Nenhuma empresa encontrada para a busca.'}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="text-slate-500">Empresa</TableHead>
                <TableHead className="text-slate-500">CNPJ</TableHead>
                <TableHead className="text-slate-500">Contato</TableHead>
                <TableHead className="text-slate-500">Status</TableHead>
                <TableHead className="text-slate-500 text-center">Usuários</TableHead>
                <TableHead className="text-slate-500 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id} className="bg-white">
                  <TableCell>
                    <p className="font-medium text-slate-900">{c.name}</p>
                    {c.legal_name && <p className="text-xs text-slate-400">{c.legal_name}</p>}
                  </TableCell>
                  <TableCell className="text-slate-600 text-sm">{c.document || '—'}</TableCell>
                  <TableCell>
                    <p className="text-slate-600 text-sm">{c.email || '—'}</p>
                    {c.phone && <p className="text-xs text-slate-400">{c.phone}</p>}
                  </TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                  <TableCell className="text-center text-slate-600 font-medium">{c.user_count}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button variant="ghost" size="sm" onClick={() => setMembersCompany(c)}
                        className="h-8 w-8 p-0 text-slate-500 hover:text-indigo-600" title="Usuários da empresa">
                        <Users className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { setEditing(c); setDialogOpen(true); }}
                        className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900" title="Editar">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {c.status === 'suspended' ? (
                        <Button variant="ghost" size="sm" onClick={() => setConfirm({ type: 'reactivate', company: c })}
                          className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700" title="Reativar">
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => setConfirm({ type: 'suspend', company: c })}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-600" title="Suspender">
                          <Ban className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CompanyFormDialog
        open={dialogOpen}
        company={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={() => { setDialogOpen(false); load(); }}
      />

      <CompanyMembersDialog
        open={!!membersCompany}
        company={membersCompany}
        onClose={() => setMembersCompany(null)}
        onChanged={load}
      />

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.type === 'suspend' ? 'Suspender empresa' : 'Reativar empresa'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.type === 'suspend'
                ? `Confirmar a suspensão de "${confirm?.company?.name}"? A ação será registrada na auditoria e pode ser revertida com Reativar.`
                : `Confirmar a reativação de "${confirm?.company?.name}"? A ação será registrada na auditoria.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleStatusChange(); }}
              disabled={saving}
              className={confirm?.type === 'suspend' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}
            >
              {saving ? 'Aplicando...' : confirm?.type === 'suspend' ? 'Suspender' : 'Reativar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}