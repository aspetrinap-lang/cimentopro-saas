import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/CompanyContext';
import { useToast } from '@/components/ui/use-toast';
import { UserPlus, Trash2, Loader2 } from 'lucide-react';

const ROLE_OPTIONS = [
  { value: 'owner', label: 'Dono' },
  { value: 'admin', label: 'Administrador' },
  { value: 'supervisor', label: 'Supervisor' },
];
const ROLE_LABELS = { owner: 'Dono', admin: 'Administrador', supervisor: 'Supervisor' };

export default function CompanyUsersTab() {
  const { currentCompanyId, currentCompany, loading: loadingCompany } = useCompany();
  const { toast } = useToast();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('supervisor');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!currentCompanyId) return;
    setLoading(true);
    try {
      const res = await base44.functions.invoke('companyMembers', { action: 'list', company_id: currentCompanyId });
      setMembers(res.data.members || []);
    } catch (e) {
      toast({ title: 'Erro ao carregar usuários', description: e.response?.data?.error || e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [currentCompanyId, toast]);

  useEffect(() => { load(); }, [load]);

  async function handleLink(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setSaving(true);
    try {
      const res = await base44.functions.invoke('companyMembers', {
        action: 'link', company_id: currentCompanyId, email: email.trim(), role,
      });
      toast({
        title: res.data?.invited ? 'Convite enviado e usuário vinculado' : 'Usuário vinculado',
        description: res.data?.invited
          ? `${email.trim()} recebeu o convite de acesso e já está vinculado a ${currentCompany?.name || 'esta empresa'}.`
          : `${email.trim()} agora tem acesso a ${currentCompany?.name || 'esta empresa'}.`,
      });
      setEmail('');
      load();
    } catch (err) {
      toast({ title: 'Não foi possível vincular', description: err.response?.data?.error || err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleUnlink(m) {
    if (!window.confirm(`Remover o acesso de ${m.user_email || m.user_name || 'este usuário'} a esta empresa?`)) return;
    try {
      await base44.functions.invoke('companyMembers', { action: 'unlink', company_id: currentCompanyId, link_id: m.id });
      toast({ title: 'Acesso removido' });
      load();
    } catch (err) {
      toast({ title: 'Não foi possível remover', description: err.response?.data?.error || err.message, variant: 'destructive' });
    }
  }

  if (loadingCompany) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!currentCompanyId) {
    return (
      <div className="text-sm text-muted-foreground py-6">
        Selecione uma empresa ativa (canto superior da barra lateral) para gerenciar os usuários com acesso a ela.
      </div>
    );
  }

  const inputCls = 'w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Usuários da Empresa</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Vincule usuários a {currentCompany?.name || 'esta empresa'} e defina o papel de cada um (donos e administradores gerenciam a empresa; supervisores acompanham os módulos operacionais). E-mails ainda sem conta no CimentoPro recebem o convite da plataforma e entram direto na empresa no primeiro acesso.
        </p>
      </div>

      <form onSubmit={handleLink} className="flex flex-wrap items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-mail do usuário (sem conta, recebe convite)"
          className={`${inputCls} flex-1 min-w-[220px]`}
          required
        />
        <select value={role} onChange={(e) => setRole(e.target.value)} className={`${inputCls} w-44`}>
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          Vincular
        </button>
      </form>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : members.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6">
          Nenhum usuário vinculado a esta empresa. Vincule a conta de um dono para que ele veja os dados dela.
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Usuário</th>
                <th className="text-left px-4 py-2.5 font-medium">E-mail</th>
                <th className="text-left px-4 py-2.5 font-medium">Papel</th>
                <th className="text-left px-4 py-2.5 font-medium">Situação</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="px-4 py-2.5 font-medium text-foreground">{m.user_name || '—'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{m.user_email || '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                      {ROLE_LABELS[m.role] || m.role}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {m.status === 'active' ? 'Ativo' : m.status === 'invited' ? 'Convite pendente' : m.status}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => handleUnlink(m)}
                      className="inline-flex items-center gap-1.5 text-destructive hover:text-destructive/80 text-xs font-medium"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}