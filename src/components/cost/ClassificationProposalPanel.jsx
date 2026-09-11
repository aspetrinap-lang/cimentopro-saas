import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { scopedFilter } from '@/lib/companyScope';
import { useToast } from '@/components/ui/use-toast';
import { proposeClassification } from '@/lib/dreClassification';
import { COST_COMPONENT_TYPES, RATE_BASES, BASIS_BY_TYPE_DEFAULT, INDUSTRIAL_COMPONENTS } from '@/lib/industrialCostEngine';
import { X, Wand2, Save, AlertTriangle } from 'lucide-react';

// Assistente de classificação em lote: propõe componente de custo + base de
// rateio para cada conta sem classificação. O usuário REVISA e EDITA antes de
// aplicar — nada é gravado sem o clique em "Aplicar Classificação".
export default function ClassificationProposalPanel({ onClose }) {
  const [rows, setRows] = useState(null); // [{ account, p }]
  const [applying, setApplying] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    base44.entities.DreAccount.filter(scopedFilter(), 'sort_order', 500)
      .then((accs) => {
        setRows(
          accs
            .filter((a) => a.active !== false && !a.cost_component_type)
            .map((a) => ({ account: a, p: proposeClassification(a) }))
        );
      })
      .catch(() => setRows([]));
  }, []);

  const toApplyCount = (rows || []).filter((r) => r.p?.cost_component_type).length;
  const industrialCount = (rows || []).filter((r) => r.p?.include_in_product_cost).length;
  const revisarCount = (rows || []).filter((r) => r.p?.revisar).length;
  const receitaCount = (rows || []).filter((r) => !r.p).length;

  function setType(idx, type) {
    setRows((prev) => prev.map((r, i) => {
      if (i !== idx) return r;
      if (!type) return { account: r.account, p: null };
      const industrial = INDUSTRIAL_COMPONENTS.includes(type);
      const basis = industrial ? (BASIS_BY_TYPE_DEFAULT[type] || 'machine_hours') : 'none';
      return {
        account: r.account,
        p: {
          cost_component_type: type,
          rate_basis: basis,
          include_in_product_cost: industrial && basis !== 'none',
          already_included_in_energy: type === 'energy',
          already_included_in_direct_material: type === 'material_direct',
          revisar: r.p?.revisar || false,
        },
      };
    }));
  }

  function setField(idx, field, val) {
    setRows((prev) => prev.map((r, i) => (i === idx && r.p ? { ...r, p: { ...r.p, [field]: val } } : r)));
  }

  async function handleApply() {
    const updates = (rows || [])
      .filter((r) => r.p?.cost_component_type)
      .map((r) => ({
        id: r.account.id,
        cost_component_type: r.p.cost_component_type,
        rate_basis: r.p.rate_basis || 'none',
        include_in_product_cost: r.p.include_in_product_cost === true,
        already_included_in_energy: r.p.already_included_in_energy === true,
        already_included_in_direct_material: r.p.already_included_in_direct_material === true,
      }));
    if (!updates.length) {
      toast({ title: 'Nenhuma conta com componente de custo selecionado.', variant: 'destructive' });
      return;
    }
    setApplying(true);
    try {
      await base44.entities.DreAccount.bulkUpdate(updates);
      toast({
        title: `${updates.length} conta(s) classificada(s) com sucesso.`,
        description: 'A Base Financeira do Simulador de Preços passa a exibir os valores rateados da DRE.',
      });
      onClose();
    } catch {
      toast({ title: 'Não foi possível aplicar a classificação.', variant: 'destructive' });
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card w-full max-w-3xl rounded-2xl shadow-2xl border border-border overflow-y-auto max-h-[94vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-primary" /> Assistente de Classificação de Custeio
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Proposta automática para as contas sem classificação. Revise, ajuste e clique em Aplicar — depois disso a Base Financeira do Simulador de Preços passa a exibir valores.
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          {rows == null ? (
            <div className="flex items-center justify-center py-8"><div className="w-6 h-6 border-2 border-slate-200 border-t-primary rounded-full animate-spin" /></div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Todas as contas ativas já estão classificadas.</p>
          ) : (
            <>
              <div className="text-[11px] text-muted-foreground bg-muted/40 rounded-lg p-2 border border-border">
                {industrialCount} conta(s) entrarão no custo industrial (rateio por horas de máquina) · {rows.length - industrialCount - receitaCount} ficarão fora do custo (comercial, tributos, administrativo, já incluídas) · {receitaCount} de Receita sem classificação · <span className="text-amber-600 dark:text-amber-400 font-medium">{revisarCount} sugestão(ões) para revisar</span>
              </div>

              <div className="space-y-2">
                {rows.map((r, i) => {
                  const isReceita = !r.p;
                  const p = r.p || {};
                  const industrial = !!p.cost_component_type && INDUSTRIAL_COMPONENTS.includes(p.cost_component_type);
                  return (
                    <div key={r.account.id} className="bg-muted/40 rounded-lg p-3 border border-border space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{r.account.name}</p>
                        <span className="text-[10px] text-muted-foreground shrink-0">{r.account.category}</span>
                      </div>
                      {isReceita ? (
                        <p className="text-[11px] text-muted-foreground">Conta de Receita — não entra no custo do produto (sem classificação).</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 items-center">
                          <select
                            className="sm:col-span-4 border border-input rounded-md px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                            value={p.cost_component_type || ''}
                            onChange={(e) => setType(i, e.target.value || null)}>
                            <option value="">— Não classificar —</option>
                            {COST_COMPONENT_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                          </select>
                          <select
                            className="sm:col-span-3 border border-input rounded-md px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                            value={p.rate_basis || 'none'}
                            disabled={!industrial}
                            onChange={(e) => setField(i, 'rate_basis', e.target.value)}>
                            {RATE_BASES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                          </select>
                          <label className="sm:col-span-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <input type="checkbox" checked={p.include_in_product_cost === true}
                              disabled={!industrial || p.rate_basis === 'none'}
                              onChange={(e) => setField(i, 'include_in_product_cost', e.target.checked)} />
                            Incluir no custo
                          </label>
                          {p.cost_component_type === 'energy' && (
                            <label className="sm:col-span-3 flex items-center gap-1.5 text-[11px] text-muted-foreground" title="A energia é calculada pelas linhas (kW × horas × tarifa) — a conta da DRE não soma novamente">
                              <input type="checkbox" checked={p.already_included_in_energy === true}
                                onChange={(e) => setField(i, 'already_included_in_energy', e.target.checked)} />
                              Já na energia das linhas
                            </label>
                          )}
                          {p.cost_component_type === 'material_direct' && (
                            <label className="sm:col-span-3 flex items-center gap-1.5 text-[11px] text-muted-foreground" title="A matéria-prima vem do traço/consumo das ordens — a conta da DRE não soma novamente">
                              <input type="checkbox" checked={p.already_included_in_direct_material === true}
                                onChange={(e) => setField(i, 'already_included_in_direct_material', e.target.checked)} />
                              Já no custo operacional
                            </label>
                          )}
                        </div>
                      )}
                      {p.revisar && !isReceita && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Sugestão automática com menor certeza — confirme antes de aplicar.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={onClose} className="flex-1 border border-border rounded-lg py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
                <button type="button" onClick={handleApply} disabled={applying || toApplyCount === 0}
                  className="flex-1 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" /> {applying ? 'Aplicando...' : `Aplicar Classificação (${toApplyCount})`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}