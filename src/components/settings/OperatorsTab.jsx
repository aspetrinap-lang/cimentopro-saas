import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { ROLE_LABELS } from '@/lib/permissions';

const ROLES = [
  { value: 'operador', label: 'Operador' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'administrador', label: 'Administrador' },
];

const empty = { name: '', email: '', pin: '', role: 'operador', profile_id: '', active: true };

export default function OperatorsTab() {
  const [list, setList] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [data, profs] = await Promise.all([
      base44.entities.UserPin.list('name'),
      base44.entities.UserRoleProfile.filter({ active: true }, 'name').catch(() => []),
    ]);
    setList(data);
    setProfiles(profs);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() { setEditing(null); setForm({ ...empty }); setShowForm(true); }
  function openEdit(item) { setEditing(item); setForm({ ...item }); setShowForm(true); }
  function set(field, val) { setForm((f) => ({ ...f, [field]: val })); }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    const pin = String(form.pin || '').replace(/\D/g, '').padStart(4, '0').slice(0, 4);
    const payload = {
      name: form.name.trim(),
      email: (form.email || '').trim(),
      pin,
      role: form.role,
      profile_id: form.profile_id || null,
      active: form.active !== false,
    };
    if (editing?.id) {
      await base44.entities.UserPin.update(editing.id, payload);
    } else {
      await base44.entities.UserPin.create(payload);
    }
    setSaving(false);
    setShowForm(false);
    load();
  }

  async function handleDelete(item) {
    if (!window.confirm(`Excluir operador "${item.name}"?`)) return;
    await base44.entities.UserPin.delete(item.id);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={openNew} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Novo Operador
        </button>
      </div>

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
                  <td className="px-5 py-3 text-center font-mono text-xs">{op.pin || '—'}</td>
                  <td className="px-5 py-3 text-center">
                    {op.active !== false ? (
                      <span className="text-green-600 text-xs font-medium">Ativo</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">Inativo</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(op)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(op)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
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
                  required
                  placeholder="0000"
                />
                <p className="text-xs text-muted-foreground/70 mt-1">Usado no login rápido dos operadores no dispositivo da fábrica.</p>
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
    </div>
  );
}