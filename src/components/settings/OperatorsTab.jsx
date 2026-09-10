import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Pencil, Trash2, X, KeyRound, Lock } from 'lucide-react';
import { ROLE_LABELS } from '@/lib/permissions';
import { activeCompanyId } from '@/lib/companyScope';
import { usePermissions } from '@/lib/PermissionsContext';
import { logAudit } from '@/lib/audit';
import { useToast } from '@/components/ui/use-toast';

const ROLES = [
  { value: 'operador', label: 'Operador' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'administrador', label: 'Administrador' },
];

const empty = { name: '', email: '', pin: '', role: 'operador', profile_id: '', active: true };

export default function OperatorsTab() {
  const { can } = usePermissions();
  const { toast } = useToast();
  const [list, setList] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(null);
  const [newPin, setNewPin] = useState('');
  const [savingPin, setSavingPin] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [res, profs] = await Promise.all([
        base44.functions.invoke('operatorPins', { action: 'list', company_id: activeCompanyId() }),
        base44.entities.UserRoleProfile.filter({ active: true }, 'name').catch(() => []),
      ]);
      setList(res.data.operators || []);
      setProfiles(profs);
    } catch (err) {
      toast({ title: 'Erro ao carregar operadores', description: err.response?.data?.error || err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openNew() { setEditing(null); setForm({ ...empty }); setShowForm(true); }
  function openEdit(item) { setEditing(item); setForm({ ...empty, name: item.name, email: item.email || '', role: item.role, profile_id: item.profile_id || '', active: item.active !== false }); setShowForm(true); }
  function set(field, val) { setForm((f) => ({ ...f, [field]: val })); }

  async function handleSave(e) {
    e.preventDefault();
    const pin = String(form.pin || '').replace(/\D/g, '');
    if (!editing && !/^\d{4}$/.test(pin)) {
      toast({ title: 'PIN inválido', description: 'Informe um PIN de exatamente 4 dígitos.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await base44.functions.invoke('operatorPins', {
        action: 'save',
        operator_id: editing?.id || null,
        company_id: activeCompanyId(),
        name: form.name.trim(),
        email: (form.email || '').trim(),
        role: form.role,
        profile_id: form.profile_id || null,
        active: form.active !== false,
        pin: pin || null,
      });
      toast({ title: editing ? 'Operador atualizado' : 'Operador criado' });
    } catch (err) {
      toast({ title: 'Não foi possível salvar', description: err.response?.data?.error || err.message, variant: 'destructive' });
      setSaving(false);
      return;
    }
    setSaving(false);
    setShowForm(false);
    load();
  }

  function openReset(op) { setResetting(op); setNewPin(''); }

  async function handleResetPin(e) {
    e.preventDefault();
    const digits = String(newPin || '').replace(/\D/g, '');
    if (!/^\d{4}$/.test(digits)) {
      toast({ title: 'PIN inválido', description: 'Informe um PIN de exatamente 4 dígitos.', variant: 'destructive' });
      return;
    }
    setSavingPin(true);
    try {
      await base44.functions.invoke('operatorPins', { action: 'reset_pin', operator_id: resetting.id, pin: digits });
      toast({ title: 'PIN redefinido', description: `${resetting.name} já pode acessar com o novo PIN.` });
      setResetting(null);
      load();
    } catch (err) {
      toast({ title: 'Não foi possível redefinir', description: err.response?.data?.error || err.message, variant: 'destructive' });
    } finally {
      setSavingPin(false);
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Excluir operador "${item.name}"?`)) return;
    await base44.entities.UserPin.delete(item.id);
    await logAudit({ action: 'DELETE', entity_name: 'UserPin', entity_id: item.id, old_value: item });
    load();
  }

  return (
    <div className="space-y-4">
      {can('SETTINGS_MANAGE') && (
        <div className="flex justify-end">
          <button onClick={openNew} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> Novo Operador
          </button>
        </div>
      )}

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-7 h-7 border-4 border-muted border-t-primary rounded-full animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <p className="px-5 py-12 text-center text-muted-foreground text-sm">
            Nenhum operador cadastrado. Crie operadores para liberar o acesso por PIN no dispositivo da fábrica.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
                <th className="px-5 py-3 text-left font-semibold">Nome</th>
                <th className="px-5 py-3 text-left font-semibold">E-mail</th>
                <th className="px-5 py-3 text-left font-semibold">Função</th>
                <th className="px-5 py-3 text-left font-semibold">Perfil</th>
                <th className="px-5 py-3 text-center font-semibold">PIN</th>
                <th className="px-5 py-3 text-center font-semibold">Ativo</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {list.map((op) => (
                <tr key={op.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3 font-medium text-foreground">{op.name}</td>
                  <td className="px-5 py-3 text-muted-foreground">{op.email || '—'}</td>
                  <td className="px-5 py-3 text-muted-foreground">{ROLE_LABELS[op.role] || op.role}</td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {profiles.find((p) => p.id === op.profile_id)?.name || <span className="text-muted-foreground/60">Padrão</span>}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Lock className="w-3 h-3" /> Protegido
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    {op.active !== false ? (
                      <span className="text-green-600 text-xs font-medium">Ativo</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">Inativo</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {can('SETTINGS_MANAGE') && (
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => openReset(op)} title="Redefinir PIN" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => openEdit(op)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(op)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground">{editing ? 'Editar Operador' : 'Novo Operador'}</h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Nome</label>
                <input
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  required
                  placeholder="Nome do operador"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">E-mail (opcional)</label>
                <input
                  type="email"
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.email || ''}
                  onChange={(e) => set('email', e.target.value)}
                  placeholder="operador@empresa.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Função</label>
                <select
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.role}
                  onChange={(e) => set('role', e.target.value)}
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Perfil de Acesso (abas permitidas)</label>
                <select
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.profile_id || ''}
                  onChange={(e) => set('profile_id', e.target.value)}
                >
                  <option value="">Usar permissões padrão da função</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground/70 mt-1">Se selecionado, define exatamente quais módulos o operador acessa. Crie perfis na aba "Perfis de Acesso".</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">PIN (4 dígitos)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background font-mono tracking-[0.3em] text-center focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.pin || ''}
                  onChange={(e) => set('pin', e.target.value.replace(/\D/g, ''))}
                  required={!editing}
                  placeholder={editing ? 'Manter PIN atual' : '0000'}
                />
                <p className="text-xs text-muted-foreground/70 mt-1">
                  {editing
                    ? 'Deixe em branco para manter o PIN atual. O PIN é armazenado de forma protegida e não pode ser consultado.'
                    : 'Usado no login rápido dos operadores no dispositivo da fábrica. Armazenado de forma protegida.'}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={form.active !== false} onChange={(e) => set('active', e.target.checked)} className="rounded border-input" />
                Ativo
              </label>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-border rounded-lg py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {resetting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card w-full max-w-sm rounded-2xl shadow-2xl border border-border">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground">Redefinir PIN</h2>
              <button onClick={() => setResetting(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleResetPin} className="p-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                Defina um novo PIN de 4 dígitos para <span className="font-medium text-foreground">{resetting.name}</span>. O operador usará este PIN no próximo acesso.
              </p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background font-mono tracking-[0.3em] text-center focus:outline-none focus:ring-2 focus:ring-ring"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                required
                placeholder="0000"
              />
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setResetting(null)} className="flex-1 border border-border rounded-lg py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={savingPin} className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
                  {savingPin ? 'Salvando...' : 'Redefinir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}