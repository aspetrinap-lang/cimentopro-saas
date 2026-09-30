import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { scopedFilter } from '@/lib/companyScope';
import { Calculator, Printer, Save, RotateCcw, SlidersHorizontal, Truck, Percent, ShieldCheck, PieChart, AlertTriangle } from 'lucide-react';
import { useInsumoCosts } from '@/hooks/useInsumoCosts';
import { useCompanyTaxes, DEFAULT_REGIME_TAXES } from '@/hooks/useCompanyTaxes';
import { fmtBRL, fmtNum } from '@/lib/statsUtils';
import { buildCostModel, calculateSellingCost, unitLabel, FINANCIAL_PERIODS, historyRangeLabel } from '@/lib/industrialCostEngine';
import FinancialBaseSection from '@/components/pricing/FinancialBaseSection';
import ProductCompareFilter from '@/components/pricing/ProductCompareFilter';
import CostCompositionPanel from '@/components/pricing/CostCompositionPanel';
import CostingV2Report from '@/components/reports/CostingV2Report';

const DEFAULTS_KEY = 'pricing_simulator_defaults';
const ROWS_KEY = 'pricing_simulator_rows';

function loadDefaults() {
  try {
    const raw = localStorage.getItem(DEFAULTS_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      return { commission: 3, freight: 0, other: 0, margin: 20, ...d };
    }
  } catch { /* ignore */ }
  return { commission: 3, freight: 0, other: 0, margin: 20 };
}

function saveDefaults(d) {
  localStorage.setItem(DEFAULTS_KEY, JSON.stringify(d));
}

function loadRows() {
  try {
    return JSON.parse(localStorage.getItem(ROWS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveRows(r) {
  localStorage.setItem(ROWS_KEY, JSON.stringify(r));
}

export default function PricingSimulator() {
  const [orders, setOrders] = useState([]);
  const [lines, setLines] = useState([]);
  const [dres, setDres] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [molds, setMolds] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [financialPeriod, setFinancialPeriod] = useState('all_history'); // all_history | selected_month | last_3 | last_6 | last_12
  const [selectedMonth, setSelectedMonth] = useState('');
  const [excludedMonths, setExcludedMonths] = useState([]);
  const [defaults, setDefaults] = useState(loadDefaults);
  const [rows, setRows] = useState(loadRows); // productId -> { commission, freight, other, margin, taxRate }
  const [savingId, setSavingId] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showV2Report, setShowV2Report] = useState(false);
  const [compareIds, setCompareIds] = useState([]); // comparativo: produtos selecionados ([] = todos)
  const [composingId, setComposingId] = useState(null);
  const { costs: insumoCosts } = useInsumoCosts();
  const { taxes, setTaxes, currentRate } = useCompanyTaxes();

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      base44.entities.ProductionOrder.filter(scopedFilter({ status: 'Concluída' }), '-production_date', 2000),
      base44.entities.ProductionLine.filter(scopedFilter({}), 'name', 200),
      base44.entities.MonthlyDre.filter(scopedFilter(), '-reference_month', 100),
      base44.entities.ProductType.filter(scopedFilter({}), 'name', 500),
      base44.entities.DreAccount.filter(scopedFilter(), 'sort_order', 500),
      base44.entities.Mold.filter(scopedFilter({}), 'name', 500),
    ]).then(([o, l, d, pt, acc, moldItems]) => {
      if (!active) return;
      setOrders(o);
      setLines(l);
      setDres(d);
      setProductTypes(pt);
      setAccounts(acc);
      setMolds(moldItems);
      if (d.length && !selectedMonth) {
        const latest = [...d].sort((a, b) => String(b.reference_month).localeCompare(String(a.reference_month)))[0];
        setSelectedMonth(latest.reference_month);
      }
    }).catch(() => {}).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const sortedDres = useMemo(
    () => [...dres].sort((a, b) => String(a.reference_month).localeCompare(String(b.reference_month))),
    [dres]
  );

  // Recalcula o custo do molde com os dados atuais, pois mold_cost_per_unit
  // no produto é apenas um cache e pode ficar desatualizado após editar o molde.
  const costProductTypes = useMemo(() => {
    const moldsById = new Map(molds.map((mold) => [mold.id, mold]));
    return productTypes.map((pt) => {
      const mold = pt.mold_id ? moldsById.get(pt.mold_id) : null;
      if (!mold) return pt;
      const moldCost = Number(mold.cost) || 0;
      const usefulCycles = Number(mold.max_cycles) || 0;
      const piecesPerCycle = Number(mold.units_per_cycle) || 0;
      const costPerPiece = moldCost > 0 && usefulCycles > 0 && piecesPerCycle > 0
        ? moldCost / usefulCycles / piecesPerCycle
        : 0;
      return { ...pt, mold_cost_per_unit: costPerPiece };
    });
  }, [productTypes, molds]);

  const model = useMemo(() => buildCostModel({
    dres,
    orders,
    productTypes: costProductTypes,
    lines,
    accounts,
    insumoCosts,
    financialPeriod,
    excludedMonths,
    selectedMonth,
  }), [dres, orders, costProductTypes, lines, accounts, insumoCosts, financialPeriod, excludedMonths, selectedMonth]);

  const modelByProduct = useMemo(() => {
    const m = {};
    model.products.forEach((p) => { m[p.pt.id] = p; });
    return m;
  }, [model]);

  const categories = useMemo(() => {
    const set = new Set();
    productTypes.forEach((p) => p.category && set.add(p.category));
    return ['all', ...Array.from(set)];
  }, [productTypes]);

  const visibleProducts = useMemo(
    () => productTypes.filter((p) => p.active !== false && (categoryFilter === 'all' || p.category === categoryFilter)),
    [productTypes, categoryFilter]
  );

  // Comparativo: com seleção, a tabela mostra apenas os produtos escolhidos.
  const shownProducts = useMemo(
    () => (compareIds.length > 0 ? visibleProducts.filter((p) => compareIds.includes(p.id)) : visibleProducts),
    [visibleProducts, compareIds]
  );

  // Produto mais viável entre os comparados: maior margem % (preço atual vs custo p/ venda);
  // empate ou sem preço atual → menor custo industrial por unidade.
  const bestId = useMemo(() => {
    if (compareIds.length < 2) return null;
    let best = null;
    shownProducts.forEach((pt) => {
      const p = modelByProduct[pt.id];
      if (!p) return;
      const sell = calculateSellingCost(p.industrialPerUnit, rowFor(pt));
      const current = Number(pt.selling_price) || 0;
      const marginPct = current > 0 ? ((current - sell.sellingCost) / current) * 100 : -Infinity;
      if (!best || marginPct > best.marginPct || (marginPct === best.marginPct && p.industrialPerUnit < best.cost)) {
        best = { id: pt.id, marginPct, cost: p.industrialPerUnit };
      }
    });
    return best?.id || null;
  }, [shownProducts, modelByProduct, compareIds, defaults, rows, taxes, insumoCosts]);

  // Parâmetros de venda do produto: exceção por produto (tax_rate_percent do
  // cadastro) > valor editado na linha > alíquota da empresa por regime (banco).
  function rowFor(pt) {
    const stored = rows[pt.id] || {};
    const defaultTax = Number(pt.tax_rate_percent) > 0 ? Number(pt.tax_rate_percent) : currentRate;
    return {
      commission: defaults.commission,
      freight: defaults.freight,
      other: defaults.other,
      margin: defaults.margin,
      ...stored,
      taxRate: stored.taxRate ?? defaultTax,
    };
  }

  function setRow(ptId, field, val) {
    setRows((prev) => {
      const next = { ...prev, [ptId]: { ...rowFor({ id: ptId, tax_rate_percent: 0 }), [field]: val } };
      saveRows(next);
      return next;
    });
  }

  function updateDefaults(field, val) {
    const next = { ...defaults, [field]: val };
    setDefaults(next);
    saveDefaults(next);
  }

  function applyRegime(regime) {
    const next = { regime, tax_rates: { ...taxes.tax_rates } };
    setTaxes(next);
  }

  function updateRegimeTax(tax) {
    const t = Number(tax) || 0;
    setTaxes({ regime: taxes.regime, tax_rates: { ...taxes.tax_rates, [taxes.regime]: t } });
  }

  function applyDefaultsToAll() {
    const next = {};
    visibleProducts.forEach((p) => {
      next[p.id] = { ...defaults, taxRate: Number(p.tax_rate_percent) > 0 ? Number(p.tax_rate_percent) : currentRate };
    });
    setRows((prev) => {
      const merged = { ...prev, ...next };
      saveRows(merged);
      return merged;
    });
  }

  function toggleExclude(referenceMonth) {
    setExcludedMonths((prev) =>
      prev.includes(referenceMonth)
        ? prev.filter((m) => m !== referenceMonth)
        : [...prev, referenceMonth]
    );
  }

  async function handleApplyPrice(pt, price) {
    setSavingId(pt.id);
    try {
      await base44.entities.ProductType.update(pt.id, { selling_price: +price.toFixed(2) });
      setProductTypes((prev) => prev.map((p) => (p.id === pt.id ? { ...p, selling_price: +price.toFixed(2) } : p)));
    } finally {
      setSavingId(null);
    }
  }

  const composing = composingId ? modelByProduct[composingId] : null;
  const composingPt = composingId ? productTypes.find((p) => p.id === composingId) : null;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" /> Simulador de Preços
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Custeio industrial v{model.calculation_version} — composição auditável, sem duplicidades, baseada nas suas DREs.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowV2Report(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            <Printer className="w-4 h-4" /> Relatório de Custeio
          </button>
        </div>
      </div>

      {/* Período financeiro + método */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-muted-foreground">Período financeiro:</span>
        <div className="inline-flex rounded-lg border border-border overflow-hidden">
          {FINANCIAL_PERIODS.map((p, i) => (
            <button key={p.value} onClick={() => setFinancialPeriod(p.value)}
              className={`text-xs px-3 py-1.5 transition-colors ${i > 0 ? 'border-l border-border' : ''} ${financialPeriod === p.value ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground hover:bg-muted'}`}>
              {p.label}
            </button>
          ))}
        </div>
        {financialPeriod === 'selected_month' && (
          <>
            <span className="text-xs text-muted-foreground">Mês de referência:</span>
            <div className="flex flex-wrap gap-1.5">
              {sortedDres.map((d) => (
                <button key={d.id} onClick={() => setSelectedMonth(d.reference_month)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${selectedMonth === d.reference_month ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-foreground hover:bg-muted'}`}>
                  {d.month_label}
                </button>
              ))}
            </div>
          </>
        )}
        <span className="text-xs text-muted-foreground">
          Método: <strong className="text-foreground">Média ponderada</strong> — Σ custos ÷ Σ base produtiva do período.
        </span>
        <span className="text-xs text-muted-foreground">
          Base produtiva: histórico completo de ordens concluídas
          {model.productivity?.from ? ` (${historyRangeLabel(model.productivity.from, model.productivity.to)})` : ''} — nunca limitado pelo período financeiro.
        </span>
        {dres.length === 0 && (
          <span className="text-xs text-amber-600">Nenhuma DRE cadastrada — usando apenas custos diretos de cadastro.</span>
        )}
      </div>

      {/* Avisos de dados insuficientes / duplicidade */}
      {model.insufficient?.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-xl p-3 space-y-1">
          {model.insufficient.map((msg, i) => (
            <p key={i} className="text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> {msg}
            </p>
          ))}
        </div>
      )}

      {/* Parâmetros padrão de venda */}
      <section className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <SlidersHorizontal className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-semibold text-foreground">Parâmetros Padrão de Venda</h3>
          <button onClick={applyDefaultsToAll} className="ml-auto flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors">
            <RotateCcw className="w-3.5 h-3.5" /> Aplicar a todos
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Regime Tributário</label>
            <select
              className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={taxes.regime} onChange={(e) => applyRegime(e.target.value)}>
              <option value="simples">Simples Nacional</option>
              <option value="real">Lucro Real/Presumido</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"><Percent className="w-3 h-3" /> Alíquota Imposto (%)</label>
            <input type="number" min="0" max="100" step="0.01"
              className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={taxes.regime === 'real' ? taxes.tax_rates.real : taxes.tax_rates.simples} onChange={(e) => updateRegimeTax(e.target.value)} />
            <p className="text-[10px] text-muted-foreground mt-0.5">Configurado por empresa (banco). Padrão: Simples ≈ {DEFAULT_REGIME_TAXES.simples}%, Real ≈ {DEFAULT_REGIME_TAXES.real}%.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"><Percent className="w-3 h-3" /> Comissão (%)</label>
            <input type="number" min="0" step="0.1"
              className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={defaults.commission} onChange={(e) => updateDefaults('commission', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"><Truck className="w-3 h-3" /> Frete (R$)</label>
            <input type="number" min="0" step="0.01"
              className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={defaults.freight} onChange={(e) => updateDefaults('freight', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Margem Desejada (%)</label>
            <input type="number" min="0" max="99" step="0.1"
              className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={defaults.margin} onChange={(e) => updateDefaults('margin', e.target.value)} />
          </div>
        </div>
      </section>

      {/* Base financeira do cálculo */}
      <FinancialBaseSection model={model} period={financialPeriod} onToggleExclude={toggleExclude} />

      {/* Filtro de categoria */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Categoria:</span>
        {categories.map((c) => (
          <button key={c} onClick={() => setCategoryFilter(c)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${categoryFilter === c ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-foreground hover:bg-muted'}`}>
            {c === 'all' ? 'Todas' : c}
          </button>
          ))}
          </div>

          {/* Filtro de comparativo entre produtos */}
          <ProductCompareFilter products={visibleProducts} selected={compareIds} onChange={setCompareIds} />

      {loading ? (
        <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" /></div>
      ) : (
        <section className="bg-card border border-border rounded-xl p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-2 font-medium">Artefato</th>
                  <th className="text-center py-2 font-medium">Un.</th>
                  <th className="text-right py-2 font-medium">Custo Industrial</th>
                  <th className="text-right py-2 font-medium">Custo p/ Venda</th>
                  <th className="text-right py-2 font-medium">% Imposto</th>
                  <th className="text-right py-2 font-medium">% Comis.</th>
                  <th className="text-right py-2 font-medium">Frete (R$)</th>
                  <th className="text-right py-2 font-medium">Margem (%)</th>
                  <th className="text-right py-2 font-medium">Preço Sugerido</th>
                  <th className="text-right py-2 font-medium">Preço Atual</th>
                  <th className="text-center py-2 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {shownProducts.map((pt) => {
                  const p = modelByProduct[pt.id];
                  if (!p) return null;
                  const row = rowFor(pt);
                  const sell = calculateSellingCost(p.industrialPerUnit, row);
                  const current = Number(pt.selling_price) || 0;
                  const diff = sell.price - current;
                  const suggestedColor = current > 0 && diff > 0 ? 'text-red-600 font-bold' : current > 0 && diff < 0 ? 'text-green-600' : 'text-foreground';
                  const isBest = pt.id === bestId;
                  return (
                    <tr key={pt.id} className={`border-b border-border/50 ${isBest ? 'bg-green-50 dark:bg-green-950/20' : ''}`}>
                      <td className="py-1.5">
                        <button onClick={() => setComposingId(pt.id)} title="Ver composição de custos e origem de cada valor"
                          className="text-foreground hover:text-primary underline decoration-dotted underline-offset-2 text-left transition-colors">
                          {pt.name}
                        </button>
                        {p.weightEstimated && <span className="text-[10px] text-amber-600 ml-1" title="Peso estimado — atualize o cadastro">⚠</span>}
                        {isBest && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 font-semibold ml-1">Mais viável</span>}
                      </td>
                      <td className="py-1.5 text-center text-muted-foreground">{unitLabel(pt)}</td>
                      <td className="py-1.5 text-right text-muted-foreground" title="Clique em Composição para ver a origem de cada componente">{fmtBRL(p.industrialPerUnit)}</td>
                      <td className="py-1.5 text-right text-muted-foreground">{fmtBRL(sell.sellingCost)}</td>
                      <td className="py-1.5 text-right">
                        <input type="number" min="0" max="100" step="0.01" className="w-16 border border-input rounded-md px-1.5 py-1 text-xs bg-background text-right focus:outline-none focus:ring-1 focus:ring-ring"
                          value={row.taxRate} onChange={(e) => setRow(pt.id, 'taxRate', e.target.value)} />
                      </td>
                      <td className="py-1.5 text-right">
                        <input type="number" min="0" step="0.1" className="w-16 border border-input rounded-md px-1.5 py-1 text-xs bg-background text-right focus:outline-none focus:ring-1 focus:ring-ring"
                          value={row.commission} onChange={(e) => setRow(pt.id, 'commission', e.target.value)} />
                      </td>
                      <td className="py-1.5 text-right">
                        <input type="number" min="0" step="0.01" className="w-20 border border-input rounded-md px-1.5 py-1 text-xs bg-background text-right focus:outline-none focus:ring-1 focus:ring-ring"
                          value={row.freight} onChange={(e) => setRow(pt.id, 'freight', e.target.value)} />
                      </td>
                      <td className="py-1.5 text-right">
                        <input type="number" min="0" max="99" step="0.1" className="w-16 border border-input rounded-md px-1.5 py-1 text-xs bg-background text-right focus:outline-none focus:ring-1 focus:ring-ring"
                          value={row.margin} onChange={(e) => setRow(pt.id, 'margin', e.target.value)} />
                      </td>
                      <td className={`py-1.5 text-right font-bold ${suggestedColor}`}>
                        {sell.invalid ? <span className="text-red-600 font-medium text-[10px]">inválido</span> : fmtBRL(sell.price)}
                      </td>
                      <td className="py-1.5 text-right text-muted-foreground">{current ? fmtBRL(current) : '—'}</td>
                      <td className="py-1.5 text-center whitespace-nowrap">
                        <button onClick={() => setComposingId(pt.id)} title="Composição do custo e origem dos valores"
                          className="p-1.5 text-muted-foreground hover:text-primary rounded-lg hover:bg-muted">
                          <PieChart className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleApplyPrice(pt, sell.price)} disabled={savingId === pt.id || sell.invalid}
                          title="Aplicar o preço sugerido ao cadastro do produto (explícito)"
                          className="ml-0.5 flex items-center gap-1 inline-flex text-xs bg-primary text-primary-foreground px-2.5 py-1 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50">
                          {savingId === pt.id ? <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" /> : <Save className="w-3 h-3" />}
                          Aplicar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">
            <strong>Custo Industrial</strong> = matéria-prima + molde + energia + mão de obra + manutenção + depreciação + custos fixos industriais, absorvidos pela produção boa (peça em <strong>Composição</strong> mostra a origem de cada valor).
            <strong> Preço Sugerido</strong> = (Custo Industrial + Frete + Outros) ÷ (1 − Margem% − Comissão% − Imposto%), com imposto sobre o preço final.
            Impostos, comissão, frete e despesas financeiras da DRE <strong>não</strong> entram no custo industrial.
            <span className="text-red-600 font-medium"> Vermelho: preço atual defasado</span>; <span className="text-green-600 font-medium">verde: acima do sugerido</span>. Aplicar é sempre explícito.
          </p>
        </section>
      )}

      {composing && composingPt && (
        <CostCompositionPanel
          product={composing}
          row={rowFor(composingPt)}
          onClose={() => setComposingId(null)}
        />
      )}

      {showV2Report && (
        <CostingV2Report
          model={model}
          products={visibleProducts.map((pt) => ({ pt, product: modelByProduct[pt.id] }))}
          rowFor={rowFor}
          onClose={() => setShowV2Report(false)}
        />
      )}

    </div>
  );
}