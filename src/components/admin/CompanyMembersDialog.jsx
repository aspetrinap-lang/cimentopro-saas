import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Trash2, UserPlus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const ROLE_OPTIONS = [
  { value: 'owner', label: 'Dono' },
  { value: 'admin', label: 'Administrador' },
  { value: 'supervisor', label: 'Supervisor' },
];
const ROLE_LABELS = { owner: 'Dono', admin: 'Administrador', supervisor: 'Supervisor' };

export default function CompanyMembersDialog({ open, company, onClose, onChanged }) {
  const { toast } = useToast();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('supervisor');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!open || !company?.id) return;
    setLoading(true);
    try {
      const res = await base44.functions.invoke('companyMembers', { action: 'list', company_id: company.id });
      setMembers(res.data.members || []);
    } catch (e) {
      toast({ title: 'Erro ao carregar usuários', description: e.response?.data?.error || e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [open, company?.id, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!open) { setEmail(''); } }, [open]);

  async function handleLink(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setSaving(true);
    try {
      const res = await base44.functions.invoke('companyMembers', {
        action: 'link', company_id: company.id, email: email.trim(), role,
      });
      toast({
        title: res.data?.invited ? 'Convite enviado e usuário vinculado' : 'Usuário vinculado',
        description: res.data?.invited
          ? `${email.trim()} recebeu o convite de acesso e já está vinculado a ${company.name}.`
          : `${email.trim()} agora tem acesso a ${company.name}.`,
      });
      setEmail('');
      load();
      onChanged?.();
    } catch (err) {
      toast({ title: 'Não foi possível vincular', description: err.response?.data?.error || err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleUnlink(m) {
    if (!window.confirm(`Remover o acesso de ${m.user_email || m.user_name || 'este usuário'} a ${company.name}?`)) return;
    try {
      await base44.functions.invoke('companyMembers', { action: 'unlink', company_id: company.id, user_id: m.user_id });
      toast({ title: 'Acesso removido' });
      load();
      onChanged?.();
    } catch (err) {
      toast({ title: 'Não foi possível remover', description: err.response?.data?.error || err.message, variant: 'destructive' });
    }
  }

  const inputCls = 'w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Usuários — {company?.name}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleLink} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-end pt-2">
          <div>
            <Label className="text-xs text-slate-500">E-mail do usuário</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-mail sem conta recebe convite de acesso"
              className="mt-1"
              required
            />
          </div>
          <div>
            <Label className="text-xs text-slate-500">Papel</Label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className={`${inputCls} mt-1 sm:w-36`}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Vincular
          </Button>
        </form>

        <p className="text-xs text-muted-foreground -mt-1">
          E-mails sem conta no CimentoPro recebem o convite da plataforma e o vínculo é criado na mesma hora — o primeiro acesso já entra nesta empresa.
        </p>

        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : members.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            Nenhum usuário vinculado a esta empresa ainda.
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-muted-foreground text-xs">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Usuário</th>
                  <th className="text-left px-3 py-2 font-medium">Papel</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <p className="font-medium text-foreground">{m.user_name || '—'}</p>
                      <p className="text-xs text-muted-foreground">{m.user_email || '—'}</p>
                    </td>
                    <td className="px-3 py-2">
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                        {ROLE_LABELS[m.role] || m.role}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleUnlink(m)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive/80" title="Remover acesso">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}