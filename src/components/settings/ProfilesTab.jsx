import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Pencil, Trash2, X, ShieldCheck } from 'lucide-react';
import { PERMISSION_CATALOG, resolvePermissions } from '@/lib/permissions';
import { usePermissions } from '@/lib/PermissionsContext';
import { logAudit } from '@/lib/audit';

// Módulos editáveis em um perfil de operador (plataforma é exclusiva do SUPER_ADMIN).
const EDITOR_MODULES = PERMISSION_CATALOG.filter((m) => m.module !== 'platform');
const ACTION_LABELS = { view: 'Ver', create: 'Criar', edit: 'Editar', delete: 'Excluir', manage: 'Gerenciar' };

const defaultForm = { name: '', description: '', permissions: {}, active: true };

// Converte permissões salvas (formato novo ou legado) para o editor granular.
function toFormPermissions(permissions) {
  const set = resolvePermissions(permissions);
  if (!set) return {};
  return Object.fromEntries([...set].map((p) => [p, true]));
}

export default function ProfilesTab() {
  const { can } = usePermissions();
  const canManage = can('SETTINGS_MANAGE');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await base44.entities.UserRoleProfile.list('name');
      setList(data);
    } catch {
      setList([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openNew() {
    setEditing(null);
    setForm({ ...defaultForm, permissions: {} });
    setShowForm(true);
  }

  function openEdit(item) {
    setEditing(item);
    setForm({
      name: item.name || '',
      description: item.description || '',
      permissions: toFormPermissions(item.permissions),
      active: item.active !== false,
    });
    setShowForm(true);
  }

  function set(field, val) {
    setForm((f) => ({ ...f, [field]: val }));
  }

  function togglePerm(perm) {
    setForm((f) => ({ ...f, permissions: { ...f.permissions, [perm]: !f.permissions[perm] } }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: (form.description || '').trim(),
      permissions: Object.fromEntries(Object.entries(form.permissions).filter(([, v]) => v === true)),
      active: form.active !== false,
    };
    try {
      if (editing?.id) {
        await base44.entities.UserRoleProfile.update(editing.id, payload);
        await logAudit({
          action: 'PERMISSION_CHANGE', entity_name: 'UserRoleProfile', entity_id: editing.id,
          old_value: { name: editing.name, permissions: editing.permissions, active: editing.active },
          new_value: payload,
        });
      } else {
        const created = await base44.entities.UserRoleProfile.create(payload);
        await logAudit({ action: 'PERMISSION_CHANGE', entity_name: 'UserRoleProfile', entity_id: created.id, new_value: payload });
      }
      setSaving(false);
      setShowForm(false);
      load();
    } catch {
      setSaving(false);
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Excluir perfil "${item.name}"?`)) return;
    await base44.entities.UserRoleProfile.delete(item.id);
    await logAudit({
      action: 'PERMISSION_CHANGE', entity_name: 'UserRoleProfile', entity_id: item.id,
      old_value: { name: item.name, permissions: item.permissions, active: item.active },
    });
    load();
  }

  function countModules(perms) {
    const set = resolvePermissions(perms);
    if (!set) return 0;
    return EDITOR_MODULES.filter((m) => set.has(m.actions.view)).length;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Crie perfis de acesso e defina, por módulo, o que cada perfil pode ver, criar, editar e excluir.
          Associe os perfis aos operadores na aba <strong>Operadores</strong>.
        </p>
        {canManage && (
          <button
            onClick={openNew}
            className="shrink-0 flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> Novo Perfil
          </button>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-7 h-7 border-4 border-muted border-t-primary rounded-full animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <p className="px-5 py-12 text-center text-muted-foreground text-sm">
            Nenhum perfil cadastrado. Crie um perfil para liberar acessos granulares aos operadores.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
                <th className="px-5 py-3 text-left font-semibold">Perfil</th>
                <th className="px-5 py-3 text-left font-semibold">Descrição</th>
                <th className="px-5 py-3 text-center font-semibold">Módulos</th>
                <th className="px-5 py-3 text-center font-semibold">Ativo</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3 font-medium text-foreground">{p.name}</td>
                  <td className="px-5 py-3 text-muted-foreground">{p.description || '—'}</td>
                  <td className="px-5 py-3 text-center">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                      {countModules(p.permissions)} módulo(s)
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    {p.active !== false ? (
                      <span className="text-green-600 text-xs font-medium">Ativo</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">Inativo</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {canManage && (
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => openEdit(p)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(p)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
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
          <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                {editing ? 'Editar Perfil' : 'Novo Perfil de Acesso'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Nome do Perfil</label>
                <input
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  required
                  placeholder="ex: Operador de Produção"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Descrição (opcional)</label>
                <input
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder="Resumo do que este perfil acessa"
                />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Permissões por módulo</p>
                <div className="space-y-2 border border-border rounded-lg p-3 bg-muted/30 max-h-[45vh] overflow-y-auto">
                  {EDITOR_MODULES.map((mod) => (
                    <div key={mod.module} className="border border-border rounded-lg p-3 bg-card">
                      <p className="text-sm font-medium text-foreground mb-2">{mod.label}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                        {Object.entries(mod.actions).map(([actionKey, perm]) => (
                          <label key={perm} className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                            <input
                              type="checkbox"
                              checked={form.permissions[perm] === true}
                              onChange={() => togglePerm(perm)}
                              className="rounded border-input"
                            />
                            {ACTION_LABELS[actionKey] || actionKey}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  {EDITOR_MODULES.filter((m) => form.permissions[m.actions.view]).length} de {EDITOR_MODULES.length} módulos com acesso de visualização.
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={form.active !== false}
                  onChange={(e) => set('active', e.target.checked)}
                  className="rounded border-input"
                />
                Ativo
              </label>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 border border-border rounded-lg py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {saving ? 'Salvando...' : 'Salvar Perfil'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}