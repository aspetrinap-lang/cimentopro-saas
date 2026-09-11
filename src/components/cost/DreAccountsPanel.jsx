import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { scopedFilter, withCompany, activeCompanyId } from '@/lib/companyScope';
import { useToast } from '@/components/ui/use-toast';
import DreAccountEditor, { DRE_SOURCES } from './DreAccountEditor';
import { X, Plus, Copy, Pencil, Trash2, ArrowUp, ArrowDown, ListTree, Power } from 'lucide-react';

const CATEGORY_TONE = {
  'Receita': 'text-green-600 dark:text-green-400',
  'Custo Direto': 'text-amber-600 dark:text-amber-400',
  'Custo Indireto Variável': 'text-amber-600 dark:text-amber-400',
  'Despesa Fixa': 'text-muted-foreground',
  'Despesa Financeira': 'text-red-600 dark:text-red-400',
};

// Estrutura da DRE da empresa — cópia independente do DRE Padrão CimentoPro.
// A empresa personaliza contas, ordem, categorias e origem dos valores; contas
// com histórico são desativadas (nunca excluídas fisicamente).
export default function DreAccountsPanel({ onClose }) {
  const [accounts, setAccounts] = useState(null);
  const [dres, setDres] = useState([]);
  const [editing, setEditing] = useState(null); // 'new' | account
  const [applying, setApplying] = useState(false);
  const { toast } = useToast();

  async function load() {
    const [accs, ds] = await Promise.all([
      base44.entities.DreAccount.filter(scopedFilter(), 'sort_order', 500),
      base44.entities.MonthlyDre.filter(scopedFilter(), '-reference_month', 100).catch(() => []),
    ]);
    setAccounts([...accs].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
    setDres(ds);
  }

  useEffect(() => { load().catch(() => setAccounts([])); }, []);

  const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const usedIds = new Set();
  const usedNames = new Set();
  dres.forEach((d) => (d.items || []).forEach((it) => {
    if (it.account_id) usedIds.add(it.account_id);
    if (it.account_name) usedNames.add(norm(it.account_name));
  }));
  const hasHistory = (a) => usedIds.has(a.id) || usedNames.has(norm(a.name));

  async function handleSave(values) {
    if (editing === 'new') {
      const nextOrder = accounts.length ? Math.max(...accounts.map((a) => a.sort_order || 0)) + 1 : 1;
      await base44.entities.DreAccount.create(withCompany({ ...values, sort_order: nextOrder, active: true }));
    } else {
      await base44.entities.DreAccount.update(editing.id, values);
    }
    await load();
  }

  async function applyTemplate() {
    const companyId = activeCompanyId();
    if (!companyId) {
      toast({ title: 'Selecione uma empresa ativa antes de aplicar o DRE Padrão.', variant: 'destructive' });
      return;
    }
    setApplying(true);
    try {
      const res = await base44.functions.invoke('dreManagement', { action: 'copy_to_company', company_id: companyId });
      const d = res?.data ?? res;
      toast({ title: `DRE Padrão aplicado — ${d?.created || 0} conta(s) copiada(s), ${d?.skipped || 0} já existente(s).` });
      await load();
    } catch (e) {
      toast({ title: e?.response?.data?.error || 'Não foi possível aplicar o DRE Padrão.', variant: 'destructive' });
    } finally {
      setApplying(false);
    }
  }

  async function toggleActive(a) {
    await base44.entities.DreAccount.update(a.id, { active: a.active === false });
    load();
  }

  async function move(a, dir) {
    const idx = accounts.findIndex((x) => x.id === a.id);
    const j = idx + dir;
    if (j < 0 || j >= accounts.length) return;
    const next = [...accounts];
    [next[idx], next[j]] = [next[j], next[idx]];
    await base44.entities.DreAccount.bulkUpdate(next.map((x, i) => ({ id: x.id, sort_order: i + 1 })));
    load();
  }

  async function remove(a) {
    if (hasHistory(a)) {
      toast({ title: 'Esta conta possui lançamentos históricos — desative-a em vez de excluir.', variant: 'destructive' });
      return;
    }
    if (!confirm(`Excluir a conta "${a.name}"?`)) return;
    await base44.entities.DreAccount.delete(a.id);
    load();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border overflow-y-auto max-h-[94vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <ListTree className="w-4 h-4 text-primary" /> Estrutura da DRE da Empresa
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cópia independente do DRE Padrão CimentoPro — personalize contas, ordem, categorias e a origem dos valores.
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setEditing('new')} className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Nova Conta
            </button>
            <button onClick={applyTemplate} disabled={applying} className="flex items-center gap-1.5 text-xs border border-border px-3 py-1.5 rounded-lg text-foreground hover:bg-muted transition-colors disabled:opacity-60">
              <Copy className="w-3.5 h-3.5" /> {applying ? 'Aplicando...' : 'Aplicar DRE Padrão CimentoPro'}
            </button>
          </div>

          {accounts == null ? (
            <div className="flex items-center justify-center py-8"><div className="w-6 h-6 border-2 border-slate-200 border-t-primary rounded-full animate-spin" /></div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <p className="text-sm text-muted-foreground">Nenhuma conta configurada para esta empresa.</p>
              <p className="text-xs text-muted-foreground">Use <strong>Aplicar DRE Padrão CimentoPro</strong> para receber a cópia do template oficial e personalizá-la.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map((a, i) => {
                const parent = accounts.find((x) => x.id === a.parent_id);
                const source = DRE_SOURCES.find((s) => s.value === (a.source_type || 'manual'));
                return (
                  <div key={a.id} className={`flex items-center gap-2 bg-muted/40 rounded-lg p-3 border border-border ${a.active === false ? 'opacity-60' : ''}`}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{a.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        <span className={CATEGORY_TONE[a.category] || ''}>{a.category}</span>
                        {' • '}
                        {a.apportionment_method === 'volume' ? 'Rateio por volume' : a.apportionment_method === 'machine_hours' ? 'Rateio por horas' : 'Não aloca'}
                        {a.source_type && a.source_type !== 'manual' && <> {' • '} Origem: {source?.label}</>}
                        {parent && <> {' • '} Subconta de: {parent.name}</>}
                        {a.active === false && <> {' • '} <span className="text-red-600 dark:text-red-400">Inativa</span></>}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button onClick={() => move(a, -1)} disabled={i === 0} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-background disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
                      <button onClick={() => move(a, 1)} disabled={i === accounts.length - 1} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-background disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button>
                      <button onClick={() => toggleActive(a)} title={a.active === false ? 'Ativar conta' : 'Desativar conta (lógico)'} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-background"><Power className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setEditing(a)} className="p-1.5 text-muted-foreground hover:text-primary rounded-lg hover:bg-background"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => remove(a)} disabled={hasHistory(a)}
                        title={hasHistory(a) ? 'Conta com histórico — desative em vez de excluir' : 'Excluir conta'}
                        className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-background disabled:opacity-30"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {editing && (
        <DreAccountEditor
          account={editing === 'new' ? null : editing}
          accounts={accounts || []}
          allowSource
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}