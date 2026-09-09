import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Upload, Save, Plus, Trash2, FileSpreadsheet, Calendar, DollarSign } from 'lucide-react';

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const CATEGORIES = ['Receita', 'Custo Direto', 'Custo Indireto Variável', 'Despesa Fixa', 'Despesa Financeira'];
const METHODS = [
  { value: 'none', label: 'Não aloca no produto' },
  { value: 'volume', label: 'Rateio por volume (peças)' },
  { value: 'machine_hours', label: 'Rateio por horas de máquina' },
];

const DEFAULT_CATEGORY_METHOD = {
  'Receita': 'none',
  'Custo Direto': 'none',
  'Custo Indireto Variável': 'machine_hours',
  'Despesa Fixa': 'volume',
  'Despesa Financeira': 'none',
};

function emptyItem() {
  return { account_name: '', planned_value: '', actual_value: '', category: 'Despesa Fixa', apportionment_method: 'volume' };
}

const fmtFat = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });

export default function DreImporter({ onClose, onSaved }) {
  const [dres, setDres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // 'new' | id | { id, ... }
  const [form, setForm] = useState({ reference_month: '', month_label: '', items: [emptyItem()], notes: '' });
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseMsg, setParseMsg] = useState('');
  const [parsedMonths, setParsedMonths] = useState(null); // { months: [...], year }

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await base44.entities.MonthlyDre.list('-reference_month', 100);
      setDres(data);
    } catch {
      setDres([]);
    } finally {
      setLoading(false);
    }
  }

  function startNew() {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setEditing('new');
    setForm({ reference_month: ym, month_label: `${MONTH_NAMES[now.getMonth()]}/${now.getFullYear()}`, items: [emptyItem()], faturamento: { account_name: '', planned_value: '', actual_value: '' }, notes: '' });
  }

  function startEdit(d) {
    setEditing(d.id);
    setForm({
      reference_month: d.reference_month || '',
      month_label: d.month_label || '',
      items: (d.items || []).map((i) => ({ ...i })),
      faturamento: { account_name: d.faturamento_account || '', planned_value: d.faturamento_planned ?? '', actual_value: d.faturamento_actual ?? '' },
      notes: d.notes || '',
    });
  }

  function setItem(idx, field, val) {
    setForm((f) => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: val };
      if (field === 'category') {
        items[idx].apportionment_method = DEFAULT_CATEGORY_METHOD[val] || 'none';
      }
      return { ...f, items };
    });
  }

  function addItem() {
    setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }));
  }

  function removeItem(idx) {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  }

  // Tenta mapear a categoria automaticamente pelo nome da conta
  function guessCategory(name) {
    const n = (name || '').toLowerCase();
    if (n.includes('receita') || n.includes('venda')) return 'Receita';
    if (n.includes('financeir') || n.includes('juros') || n.includes('irpj') || n.includes('csll')) return 'Despesa Financeira';
    if (n.includes('mão de obra') || n.includes('mao de obra') || n.includes('salario') || n.includes('encargo') || n.includes('aluguel') || n.includes('administrat') || n.includes('honor') || n.includes('iptu') || n.includes('seguro')) return 'Despesa Fixa';
    if (n.includes('energia') || n.includes('combust') || n.includes('manuten') || n.includes('deprec') || n.includes('frota')) return 'Custo Indireto Variável';
    return 'Despesa Fixa';
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    setParseMsg('');
    setParsedMonths(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const res = await base44.functions.invoke('parseDreXlsx', { file_url });
      const data = res?.data ?? res;
      const months = (data?.months || []).filter((m) => (m.items || []).length > 0);
      if (!months.length) {
        if (!editing) setEditing('new');
        setParseMsg('Não foi possível identificar meses com dados na planilha. Preencha manualmente abaixo.');
      } else if (months.length === 1) {
        loadMonthIntoForm(months[0]);
      } else {
        setParsedMonths({ months, year: data?.year });
      }
    } catch (err) {
      if (!editing) setEditing('new');
      setParseMsg('Erro ao processar o arquivo. Preencha manualmente abaixo.');
    } finally {
      setParsing(false);
      e.target.value = '';
    }
  }

  function loadMonthIntoForm(month) {
    const mapped = (month.items || [])
      .filter((i) => i.account_name && String(i.account_name).trim())
      .map((i) => {
        const cat = guessCategory(i.account_name);
        return {
          account_name: String(i.account_name).trim(),
          planned_value: Number(i.planned_value) || 0,
          actual_value: Number(i.actual_value) || 0,
          category: cat,
          apportionment_method: DEFAULT_CATEGORY_METHOD[cat] || 'none',
        };
      });
    const [y, m] = month.reference_month.split('-');
    const fat = month.faturamento || {};
    setForm({
      reference_month: month.reference_month,
      month_label: `${MONTH_NAMES[Number(m) - 1]}/${y}`,
      items: mapped.length ? mapped : [emptyItem()],
      faturamento: {
        account_name: fat.account_name || '',
        planned_value: Number(fat.planned_value) || '',
        actual_value: Number(fat.actual_value) || '',
      },
      notes: '',
    });
    setParsedMonths(null);
    setEditing('new');
    setParseMsg(`${mapped.length} linhas importadas de ${month.name}. Faturamento: ${fmtFat(Number(fat.actual_value) || 0)}. Revise as categorias e confirme.`);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.reference_month) return;
    setSaving(true);
    const items = form.items
      .filter((i) => i.account_name && i.account_name.trim())
      .map((i) => ({
        account_name: i.account_name.trim(),
        planned_value: Number(i.planned_value) || 0,
        actual_value: Number(i.actual_value) || 0,
        category: i.category,
        apportionment_method: i.apportionment_method,
      }));
    const totalPlanned = items.reduce((s, i) => s + (i.planned_value || 0), 0);
    const totalActual = items.reduce((s, i) => s + (i.actual_value || 0), 0);
    const totalApportionable = items
      .filter((i) => i.apportionment_method !== 'none')
      .reduce((s, i) => s + (i.actual_value || 0), 0);
    const totalReceitaActual = items
      .filter((i) => i.category === 'Receita')
      .reduce((s, i) => s + (i.actual_value || 0), 0);
    const totalDespesaActual = items
      .filter((i) => i.category !== 'Receita')
      .reduce((s, i) => s + (i.actual_value || 0), 0);
    const totalReceitaPlanned = items
      .filter((i) => i.category === 'Receita')
      .reduce((s, i) => s + (i.planned_value || 0), 0);
    const totalDespesaPlanned = items
      .filter((i) => i.category !== 'Receita')
      .reduce((s, i) => s + (i.planned_value || 0), 0);
    const payload = {
      reference_month: form.reference_month,
      month_label: form.month_label || form.reference_month,
      items,
      faturamento_account: form.faturamento?.account_name || '',
      faturamento_planned: +Number(form.faturamento?.planned_value || 0).toFixed(2),
      faturamento_actual: +Number(form.faturamento?.actual_value || 0).toFixed(2),
      total_planned: +totalPlanned.toFixed(2),
      total_actual: +totalActual.toFixed(2),
      total_apportionable: +totalApportionable.toFixed(2),
      total_receita_planned: +totalReceitaPlanned.toFixed(2),
      total_receita_actual: +totalReceitaActual.toFixed(2),
      total_despesa_planned: +totalDespesaPlanned.toFixed(2),
      total_despesa_actual: +totalDespesaActual.toFixed(2),
      notes: form.notes || '',
    };
    try {
      if (editing === 'new') {
        await base44.entities.MonthlyDre.create(payload);
      } else {
        await base44.entities.MonthlyDre.update(editing, payload);
      }
      setEditing(null);
      setForm({ reference_month: '', month_label: '', items: [emptyItem()], faturamento: { account_name: '', planned_value: '', actual_value: '' }, notes: '' });
      await load();
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(d) {
    if (!confirm(`Excluir a DRE de ${d.month_label}?`)) return;
    await base44.entities.MonthlyDre.delete(d.id);
    load();
    onSaved?.();
  }

  const totals = (form.items || []).reduce(
    (acc, i) => {
      acc.planned += Number(i.planned_value) || 0;
      acc.actual += Number(i.actual_value) || 0;
      acc.apportionable += i.apportionment_method !== 'none' ? (Number(i.actual_value) || 0) : 0;
      return acc;
    },
    { planned: 0, actual: 0, apportionable: 0 }
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card w-full max-w-3xl rounded-2xl shadow-2xl border border-border overflow-y-auto max-h-[94vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-primary" /> DRE Mensal
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Importe ou cadastre a DRE mensal. Os custos rateáveis entram no custo do artefato.</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          {!editing && (
            <>
              <div className="flex items-center gap-2">
                <button onClick={startNew} className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Nova DRE
                </button>
                <label className="flex items-center gap-1.5 text-xs border border-border px-3 py-1.5 rounded-lg text-foreground hover:bg-muted transition-colors cursor-pointer">
                  <Upload className="w-3.5 h-3.5" /> Importar Planilha
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUpload} disabled={parsing} />
                </label>
              </div>

              {parsing && (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-primary">
                  <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  Processando planilha...
                </div>
              )}
              {parsedMonths && (
                <div className="border border-border rounded-xl p-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary" /> Selecione o Mês ({parsedMonths.year})
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">A planilha contém {parsedMonths.months.length} meses. Escolha qual importar.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {parsedMonths.months.map((m) => (
                      <button key={m.reference_month} onClick={() => loadMonthIntoForm(m)}
                        className="text-xs px-3 py-2 rounded-lg border border-border bg-card text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors flex items-center gap-2">
                        <span className="font-medium">{m.name}</span>
                        <span className="text-[10px] text-muted-foreground">{m.items.length} contas</span>
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setParsedMonths(null)} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
                </div>
              )}
              {loading ? (
                <div className="flex items-center justify-center py-8"><div className="w-6 h-6 border-2 border-slate-200 border-t-primary rounded-full animate-spin" /></div>
              ) : dres.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Nenhuma DRE cadastrada. Clique em "Nova DRE" ou importe uma planilha.</p>
              ) : (
                <div className="space-y-2">
                  {dres.map((d) => (
                    <div key={d.id} className="flex items-center justify-between gap-2 bg-muted/40 rounded-lg p-3 border border-border">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-primary" /> {d.month_label}
                        </p>
                        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                          <DollarSign className="w-3.5 h-3.5" /> Faturamento: <strong>R$ {Number(d.faturamento_actual || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {d.items?.length || 0} contas • Rateável: <strong className="text-foreground">R$ {Number(d.total_apportionable || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => startEdit(d)} className="text-xs text-primary hover:underline">Editar</button>
                        <button onClick={() => handleDelete(d)} className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-muted"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {editing && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {parseMsg && <div className="text-xs bg-primary/10 text-primary rounded-lg p-2">{parseMsg}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Mês de Referência</label>
                  <input type="month" className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    value={form.reference_month} onChange={(e) => {
                      const [y, m] = e.target.value.split('-');
                      setForm((f) => ({ ...f, reference_month: e.target.value, month_label: `${MONTH_NAMES[Number(m) - 1]}/${y}` }));
                    }} required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Rótulo</label>
                  <input className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    value={form.month_label} onChange={(e) => setForm((f) => ({ ...f, month_label: e.target.value }))} />
                </div>
              </div>

              {form.faturamento && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">Faturamento Total (Receitas Operacionais) — não somado, lido direto da linha</p>
                    <span className="text-[10px] text-amber-700 dark:text-amber-400">Resultado de Venda</span>
                  </div>
                  <div className="grid grid-cols-12 gap-1.5 items-center">
                    <input className="col-span-12 sm:col-span-6 border border-amber-300 dark:border-amber-700 rounded-md px-2 py-1.5 text-xs bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      placeholder="Conta do faturamento (ex: Receitas Operacionais)"
                      value={form.faturamento.account_name} onChange={(e) => setForm((f) => ({ ...f, faturamento: { ...f.faturamento, account_name: e.target.value } }))} />
                    <div className="col-span-6 sm:col-span-3 relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">R$</span>
                      <input type="number" step="0.01" className="w-full border border-amber-300 dark:border-amber-700 rounded-md pl-7 pr-2 py-1.5 text-xs bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        placeholder="Orçado" value={form.faturamento.planned_value} onChange={(e) => setForm((f) => ({ ...f, faturamento: { ...f.faturamento, planned_value: e.target.value } }))} />
                    </div>
                    <div className="col-span-6 sm:col-span-3 relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">R$</span>
                      <input type="number" step="0.01" className="w-full border border-amber-300 dark:border-amber-700 rounded-md pl-7 pr-2 py-1.5 text-xs bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        placeholder="Realizado" value={form.faturamento.actual_value} onChange={(e) => setForm((f) => ({ ...f, faturamento: { ...f.faturamento, actual_value: e.target.value } }))} />
                    </div>
                  </div>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-1.5">
                    Faturamento Realizado: <strong>{fmtFat(Number(form.faturamento.actual_value) || 0)}</strong>
                  </p>
                </div>
              )}

              <div className="border border-border rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">Linhas da DRE ({form.items.length})</p>
                  <div className="flex gap-2">
                    <label className="flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer">
                      <Upload className="w-3 h-3" /> Importar
                      <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUpload} disabled={parsing} />
                    </label>
                    <button type="button" onClick={addItem} className="flex items-center gap-1 text-[11px] bg-primary/10 text-primary px-2 py-1 rounded-md hover:bg-primary/20">
                      <Plus className="w-3 h-3" /> Linha
                    </button>
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {form.items.map((it, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-1.5 items-center bg-muted/30 rounded-lg p-2 border border-border">
                      <input className="col-span-12 sm:col-span-4 border border-input rounded-md px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                        placeholder="Conta" value={it.account_name} onChange={(e) => setItem(idx, 'account_name', e.target.value)} />
                      <div className="col-span-6 sm:col-span-2 relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">R$</span>
                        <input type="number" step="0.01" className="w-full border border-input rounded-md pl-7 pr-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                          placeholder="Orçado" value={it.planned_value} onChange={(e) => setItem(idx, 'planned_value', e.target.value)} />
                      </div>
                      <div className="col-span-6 sm:col-span-2 relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">R$</span>
                        <input type="number" step="0.01" className="w-full border border-input rounded-md pl-7 pr-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                          placeholder="Realizado" value={it.actual_value} onChange={(e) => setItem(idx, 'actual_value', e.target.value)} />
                      </div>
                      <select className="col-span-7 sm:col-span-2 border border-input rounded-md px-1 py-1.5 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                        value={it.category} onChange={(e) => setItem(idx, 'category', e.target.value)}>
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <div className="col-span-4 sm:col-span-1 flex items-center justify-end">
                        <button type="button" onClick={() => removeItem(idx)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                      <select className="col-span-12 border border-input rounded-md px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring -mt-1"
                        value={it.apportionment_method} onChange={(e) => setItem(idx, 'apportionment_method', e.target.value)}>
                        {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </div>
                  ))}
                  {form.items.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Nenhuma linha. Adicione ou importe.</p>}
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                  <div className="bg-muted/40 rounded-md p-2 border border-border"><p className="text-muted-foreground text-[10px]">Orçado</p><p className="font-semibold text-foreground">R$ {totals.planned.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
                  <div className="bg-muted/40 rounded-md p-2 border border-border"><p className="text-muted-foreground text-[10px]">Realizado</p><p className="font-semibold text-foreground">R$ {totals.actual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
                  <div className="bg-primary/10 rounded-md p-2 border border-border"><p className="text-primary text-[10px]">Rateável</p><p className="font-semibold text-foreground">R$ {totals.apportionable.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setEditing(null)} className="flex-1 border border-border rounded-lg py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar DRE'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}