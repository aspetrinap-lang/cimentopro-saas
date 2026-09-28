import { useCallback, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Search, ShieldCheck, ShieldOff, ShieldAlert } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PlatformAdminDialog from '@/components/admin/PlatformAdminDialog';

const ROLE_LABELS = { owner: 'Owner', admin: 'Admin', supervisor: 'Supervisor' };

// Usuários da plataforma + gestão de SUPER_ADMINs. O status de SUPER_ADMIN vem
// da fonte protegida (PlatformAdmin), verificada no backend — nunca da flag da
// sessão. Promover/rebaixar exige dupla confirmação: digitar o e-mail do alvo.
export default function AdminUsers() {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [target, setTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('adminUsers', { action: 'list' });
      setUsers(res.data.users || []);
      setNeedsMigration(!!res.data.needs_migration);
    } catch (e) {
      toast({ title: 'Erro ao carregar usuários', description: e?.response?.data?.error || e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function migrate() {
    if (!confirm('Migrar os SUPER_ADMINs atuais para a fonte protegida? Após a migração, a flag da sessão sozinha deixa de conceder acesso administrativo.')) return;
    setMigrating(true);
    try {
      const res = await base44.functions.invoke('adminUsers', { action: 'migrateSuperAdmins' });
      toast({ title: `Fonte protegida atualizada — ${res.data?.migrated || 0} SUPER_ADMIN(s) migrado(s).` });
      await load();
    } catch (e) {
      toast({ title: 'Falha na migração', description: e?.response?.data?.error || e.message, variant: 'destructive' });
    } finally { setMigrating(false); }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.full_name, u.email, ...(u.companies || []).map((c) => c.company_name)]
        .some((v) => (v || '').toLowerCase().includes(q)));
  }, [users, search]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Usuários</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Usuários da plataforma, vínculos de empresa e gestão de SUPER_ADMINs (fonte protegida, com dupla confirmação e auditoria)
        </p>
      </div>

      {needsMigration && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">Migração de segurança pendente</p>
            <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
              Existem SUPER_ADMINs baseados apenas na flag da sessão. Execute a migração única para a fonte protegida —
              depois dela, a flag sozinha deixa de conceder acesso administrativo.
            </p>
          </div>
          <button
            onClick={migrate}
            disabled={migrating}
            className="text-xs font-medium bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 disabled:opacity-50 shrink-0"
          >
            {migrating ? 'Migrando...' : 'Migrar agora'}
          </button>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, e-mail ou empresa..."
          className="pl-9 bg-white"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 text-sm">
          Nenhum usuário encontrado.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="text-slate-500">Usuário</TableHead>
                <TableHead className="text-slate-500">Papel na conta</TableHead>
                <TableHead className="text-slate-500">Plataforma</TableHead>
                <TableHead className="text-slate-500">Empresas vinculadas</TableHead>
                <TableHead className="text-slate-500 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.id} className="bg-white">
                  <TableCell>
                    <p className="font-medium text-slate-900">{u.full_name || u.email}</p>
                    <p className="text-xs text-slate-400">{u.email}</p>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex px-2 py-0.5 rounded-full border border-slate-200 text-slate-600 text-xs">
                      {u.role || 'user'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {u.is_platform_admin ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold">
                        <ShieldCheck className="w-3 h-3" /> SUPER_ADMIN
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {u.companies.length === 0 ? (
                      <span className="text-xs text-slate-400">Sem vínculos</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {u.companies.map((c, i) => (
                          <span key={i} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs">
                            {c.company_name || c.company_id}
                            <span className="text-indigo-400 font-medium">{ROLE_LABELS[c.role] || c.role}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <button
                      onClick={() => setTarget(u)}
                      title={u.is_platform_admin ? 'Rebaixar SUPER_ADMIN' : 'Promover a SUPER_ADMIN'}
                      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
                        u.is_platform_admin
                          ? 'border-red-200 text-red-600 hover:bg-red-50'
                          : 'border-amber-200 text-amber-700 hover:bg-amber-50'
                      }`}
                    >
                      {u.is_platform_admin ? <ShieldOff className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                      {u.is_platform_admin ? 'Rebaixar' : 'Promover'}
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {target && (
        <PlatformAdminDialog
          user={target}
          onClose={() => setTarget(null)}
          onDone={load}
        />
      )}
    </div>
  );
}