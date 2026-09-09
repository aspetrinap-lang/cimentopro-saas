import { useCallback, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Search, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const ROLE_LABELS = { owner: 'Owner', admin: 'Admin', supervisor: 'Supervisor' };

export default function AdminUsers() {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('adminUsers', { action: 'list' });
      setUsers(res.data.users || []);
    } catch (e) {
      toast({ title: 'Erro ao carregar usuários', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

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
          Usuários da plataforma com seus vínculos de empresa (UserCompany) e papéis operacionais
        </p>
      </div>

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
                    <Badge variant="outline" className="text-slate-600 border-slate-200">{u.role || 'user'}</Badge>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}