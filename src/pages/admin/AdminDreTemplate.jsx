import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import DreAccountEditor from '@/components/cost/DreAccountEditor';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Power, FileSpreadsheet, Building2, Copy, Database } from 'lucide-react';
import { fmtBRL } from '@/lib/statsUtils';

// Painel do SUPER_ADMIN: DRE Padrão CimentoPro (template estrutural, sem
// valores financeiros) + migração de legados + cópia para empresas.
// Alterações no template NUNCA propagam automaticamente para as empresas.
export default function AdminDreTemplate() {
  const [template, setTemplate] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState('');
  const [busy, setBusy] = useState('');
  const [report, setReport] = useState(null);
  const [editing, setEditing] = useState(null);
  const { toast } = useToast();

  async function load() {
    const [tpl, comps] = await Promise.all([
      base44.entities.DreTemplateAccount.list('sort_order', 500).catch(() => []),
      base44.entities.Company.list('name', 500).catch(() => []),
    ]);
    setTemplate([...tpl].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
    setCompanies(comps.filter((c) => c.status === 'active' || c.status === 'trial'));
  }

  useEffect(() => { load(); }, []);

  async function invoke(action, extra = {}) {
    const res = await base44.functions.invoke('dreManagement', { action, ...extra });
    return res?.data ?? res;
  }

  async function seed() {
    setBusy('seed');
    try {
      const d = await invoke('seed_template');
      toast({ title: `Template atualizado — ${d?.created || 0} conta(s) extraída(s) da DRE atual, ${d?.existing || 0} já existente(s).` });
      await load();
    } catch (e) {
      toast({ title: e?.response?.data?.error || 'Falha ao gerar o template.', variant: 'destructive' });
    } finally { setBusy(''); }
  }

  async function migrate() {
    if (!companyId) { toast({ title: 'Selecione a empresa de destino da migração.' }); return; }
    if (!confirm('Associar as DREs sem empresa à empresa selecionada? Nenhum valor será alterado.')) return;
    setBusy('migrate');
    try {
      const d = await invoke('migrate_legacy', { company_id: companyId });
      setReport(d);
      toast({ title: `Migração concluída — ${d?.legacy_before || 0} registro(s) associado(s) a ${d?.target_company_name}.` });
    } catch (e) {
      toast({ title: e?.response?.data?.error || 'Falha na migração.', variant: 'destructive' });
    } finally { setBusy(''); }
  }

  async function copyTo() {
    if (!companyId) { toast({ title: 'Selecione a empresa que receberá a cópia.' }); return; }
    setBusy('copy');
    try {
      const d = await invoke('copy_to_company', { company_id: companyId });
      toast({ title: `Cópia aplicada — ${d?.created || 0} conta(s) copiada(s), ${d?.skipped || 0} já existente(s).` });
    } catch (e) {
      toast({ title: e?.response?.data?.error || 'Falha ao aplicar a cópia.', variant: 'destructive' });
    } finally { setBusy(''); }
  }

  async function handleSave(values) {
    const { source_type, ...clean } = values;
    if (editing === 'new') {
      const nextOrder = template.length ? Math.max(...template.map((t) => t.sort_order || 0)) + 1 : 1;
      await base44.entities.DreTemplateAccount.create({ ...clean, sort_order: nextOrder, active: true });
    } else {
      await base44.entities.DreTemplateAccount.update(editing.id, clean);
    }
    await load();
  }

  async function toggleActive(t) {
    await base44.entities.DreTemplateAccount.update(t.id, { active: t.active === false });
    load();
  }

  async function move(t, dir) {
    const idx = template.findIndex((x) => x.id === t.id);
    const j = idx + dir;
    if (j < 0 || j >= template.length) return;
    const next = [...template];
    [next[idx], next[j]] = [next[j], next[idx]];
    await base44.entities.DreTemplateAccount.bulkUpdate(next.map((x, i) => ({ id: x.id, sort_order: i + 1 })));
    load();
  }

  async function remove(t) {
    if (!confirm(`Excluir a conta "${t.name}" do DRE Padrão? As DREs das empresas NÃO são afetadas.`)) return;
    await base44.entities.DreTemplateAccount.delete(t.id);
    load();
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <FileSpreadsheet className="w-6 h-6 text-indigo-600" /> DRE Padrão CimentoPro
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Template estrutural oficial (contas, categorias, rateio) — sem valores financeiros. Cada empresa recebe uma cópia independente.
        </p>
      </div>

      {/* Template */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="font-semibold text-slate-900 text-sm">Contas do Template ({template?.length ?? '…'})</h2>
            <p className="text-xs text-slate-500">Alterações aqui não modificam automaticamente as DREs das empresas.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={seed} disabled={busy === 'seed'} className="flex items-center gap-1.5 text-xs border border-slate-200 px-3 py-1.5 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <Database className="w-3.5 h-3.5" /> {busy === 'seed' ? 'Gerando...' : 'Gerar a partir das DREs existentes'}
            </button>
            <button onClick={() => setEditing('new')} className="flex items-center gap-1.5 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700">
              <Plus className="w-3.5 h-3.5" /> Nova Conta
            </button>
          </div>
        </div>

        {template == null ? (
          <div className="flex items-center justify-center py-10"><div className="w-6 h-6 border-2 border-slate-200 border-t-indigo-600 rounded-full animate-spin" /></div>
        ) : template.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6">
            Template vazio. Use <strong>Gerar a partir das DREs existentes</strong> para extrair a estrutura atual da DRE do CimentoPro.
          </p>
        ) : (
          <div className="max-h-96 overflow-y-auto space-y-1.5">
            {template.map((t, i) => (
              <div key={t.id} className={`flex items-center gap-2 bg-slate-50 rounded-lg p-2.5 border border-slate-100 ${t.active === false ? 'opacity-60' : ''}`}>
                <span className="text-[10px] text-slate-400 w-6 text-right">{t.sort_order || i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 truncate">{t.name}</p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {t.category} • {t.apportionment_method === 'volume' ? 'Rateio por volume' : t.apportionment_method === 'machine_hours' ? 'Rateio por horas' : 'Não aloca'}
                    {t.active === false && ' • Inativa'}
                  </p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button onClick={() => move(t, -1)} disabled={i === 0} className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
                  <button onClick={() => move(t, 1)} disabled={i === template.length - 1} className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button>
                  <button onClick={() => toggleActive(t)} title={t.active === false ? 'Ativar' : 'Desativar'} className="p-1.5 text-slate-400 hover:text-slate-700"><Power className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setEditing(t)} className="p-1.5 text-slate-400 hover:text-indigo-600"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => remove(t)} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Empresas: migração e cópia */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
          <Building2 className="w-4 h-4 text-indigo-600" /> Empresas
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 min-w-56">
            <option value="">Selecione a empresa…</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={copyTo} disabled={busy === 'copy'} className="flex items-center gap-1.5 text-xs border border-slate-200 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <Copy className="w-3.5 h-3.5" /> {busy === 'copy' ? 'Copiando...' : 'Aplicar cópia do template'}
          </button>
          <button onClick={migrate} disabled={busy === 'migrate'} className="flex items-center gap-1.5 text-xs border border-slate-200 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <Database className="w-3.5 h-3.5" /> {busy === 'migrate' ? 'Migrando...' : 'Migrar DREs sem empresa'}
          </button>
        </div>
        <p className="text-[11px] text-slate-500">
          A cópia é idempotente (contas que já existem na empresa são preservadas). A migração apenas acrescenta o vínculo com a empresa — nenhum valor é recalculado.
        </p>

        {report && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2">
            <p className="font-semibold text-slate-900">Relatório de conferência — Migração</p>
            <p className="text-slate-600">
              Empresa destino: <strong>{report.target_company_name}</strong> · Registros totais: {report.total_records} ·
              Legados antes: {report.legacy_before} · Legados após: {report.legacy_after}
              {report.migrated_months?.length > 0 && <> · Migrados: {report.migrated_months.join(', ')}</>}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-200">
                    <th className="text-left py-1.5 font-medium">Mês</th>
                    <th className="text-right py-1.5 font-medium">Contas</th>
                    <th className="text-right py-1.5 font-medium">Orçado</th>
                    <th className="text-right py-1.5 font-medium">Realizado</th>
                    <th className="text-center py-1.5 font-medium">Empresa (antes → depois)</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.after || []).map((r, idx) => {
                    const before = (report.before || [])[idx];
                    return (
                      <tr key={r.id} className="border-b border-slate-100">
                        <td className="py-1.5 text-slate-900">{r.reference_month}</td>
                        <td className="py-1.5 text-right">{r.items}</td>
                        <td className="py-1.5 text-right">{fmtBRL(r.total_planned || 0)}</td>
                        <td className="py-1.5 text-right">{fmtBRL(r.total_actual || 0)}</td>
                        <td className="py-1.5 text-center text-slate-500">{before?.company_id ? '—' : 'sem empresa'} → {r.company_id ? 'associada' : 'sem empresa'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {editing && (
        <DreAccountEditor
          account={editing === 'new' ? null : editing}
          accounts={template || []}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}