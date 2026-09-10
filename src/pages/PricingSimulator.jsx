import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { scopedFilter } from '@/lib/companyScope';
import { Calculator, Printer, Save, RotateCcw, SlidersHorizontal, Truck, Percent, ShieldCheck } from 'lucide-react';
import { useInsumoCosts } from '@/hooks/useInsumoCosts';
import { fmtBRL, fmtNum } from '@/lib/statsUtils';
import {
  weightPerSaleUnit, unitLabel, saleFactor,
  directMaterialCostPerUnit, totalProductionCostPerUnit,
  calculateSuggestedPrice,
  orderRealWeightKg, orderHasRealWeight,
} from '@/lib/costUtils';
import PricingReport from '@/components/reports/PricingReport';

const DEFAULTS_KEY = 'pricing_simulator_defaults';
const ROWS_KEY = 'pricing_simulator_rows';
const REGIME_TAXES_KEY = 'pricing_simulator_regime_taxes';

// Alíquota padrão sugerida por regime (valor inicial — pode ser editada e persistida pelo usuário)
const REGIME_DEFAULT_TAX = {
  simples: 13,
  real: 21.5,
};

function loadDefaults() {
  try {
    const raw = localStorage.getItem(DEFAULTS_KEY);
    return raw ? JSON.parse(raw) : { regime: 'simples', taxRate: REGIME_DEFAULT_TAX.simples, commission: 3, freight: 0, other: 0, margin: 20 };
  } catch {
    return { regime: 'simples', taxRate: REGIME_DEFAULT_TAX.simples, commission: 3, freight: 0, other: 0, margin: 20 };
  }
}

function saveDefaults(d) {
  localStorage.setItem(DEFAULTS_KEY, JSON.stringify(d));
}

function loadRows() {
  try {
    const raw = localStorage.getItem(ROWS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveRows(r) {
  localStorage.setItem(ROWS_KEY, JSON.stringify(r));
}

function loadRegimeTaxes() {
  try {
    const raw = localStorage.getItem(REGIME_TAXES_KEY);
    const stored = raw ? JSON.parse(raw) : {};
    return { ...REGIME_DEFAULT_TAX, ...stored };
  } catch {
    return { ...REGIME_DEFAULT_TAX };
  }
}

function saveRegimeTaxes(t) {
  localStorage.setItem(REGIME_TAXES_KEY, JSON.stringify(t));
}



export default function PricingSimulator() {
  const [orders, setOrders] = useState([]);
  const [lines, setLines] = useState([]);
  const [dres, setDres] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [calcMode, setCalcMode] = useState('average'); // 'average' (média dos últimos 3 meses — padrão) | 'single'
  const [defaults, setDefaults] = useState(loadDefaults);
  const [rows, setRows] = useState(loadRows); // productId -> { commission, freight, other, margin, taxRate }
  const [regimeTaxes, setRegimeTaxes] = useState(loadRegimeTaxes); // { simples, real } — alíquota por regime (editável)
  const [savingId, setSavingId] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showReport, setShowReport] = useState(false);
  const { costs: insumoCosts } = useInsumoCosts();

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      base44.entities.ProductionOrder.filter(scopedFilter({ status: 'Concluída' }), '-production_date', 2000),
      base44.entities.ProductionLine.filter(scopedFilter({}), 'name', 200),
      base44.entities.MonthlyDre.filter(scopedFilter(), '-reference_month', 100),
      base44.entities.ProductType.filter(scopedFilter({}), 'name', 500),
    ]).then(([o, l, d, pt]) => {
      if (!active) return;
      setOrders(o);
      setLines(l);
      setDres(d);
      setProductTypes(pt);
      if (d.length && !selectedMonth) {
        const latest = [...d].sort((a, b) => String(b.reference_month).localeCompare(String(a.reference_month)))[0];
        setSelectedMonth(latest.reference_month);
      }
    }).catch(() => {}).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const sortedDres = useMemo(
    () => [...dres].sort((a, b) => String(a.reference_month).localeCompare(String(b.reference_month))),
    [dres]
  );

  const currentDre = useMemo(() => dres.find((d) => d.reference_month === selectedMonth) || null, [dres, selectedMonth]);

  const monthOrders = useMemo(() => {
    if (!selectedMonth) return [];
    const [y, m] = selectedMonth.split('-').map(Number);
    return orders.filter((o) => {
      if (!o.production_date) return false;
      const d = new Date(o.production_date + 'T00:00:00');
      return d.getFullYear() === y && (d.getMonth() + 1) === m;
    });
  }, [orders, selectedMonth]);

  const ptMap = useMemo(() => {
    const m = {};
    productTypes.forEach((p) => { m[p.id] = p; });
    return m;
  }, [productTypes]);

  const monthWeightKg = useMemo(() => monthOrders.reduce((s, o) => {
    const pt = ptMap[o.product_type_id];
    if (orderHasRealWeight(o)) return s + orderRealWeightKg(o);
    return s + (Number(o.actual_quantity) || 0) * weightPerSaleUnit(pt);
  }, 0), [monthOrders, ptMap]);

  const machineToLine = useMemo(() => {
    const map = {};
    lines.forEach((line) => {
      (line.machines || []).forEach((m) => {
        if (m.machine_id) map[m.machine_id] = line.id;
      });
    });
    return map;
  }, [lines]);

  const lineCosts = useMemo(() => lines.map((line) => {
    const lineOrders = monthOrders.filter((o) =>
      o.production_line_id ? o.production_line_id === line.id : o.machine_id && machineToLine[o.machine_id] === line.id
    );
    const prodMinutes = lineOrders.reduce((s, o) => s + (Number(o.production_minutes) || 0), 0);
    const prodHours = prodMinutes / 60;
    const usedPower = Number(line.used_power_kw) || 0;
    const energyCost = prodHours * usedPower * (Number(line.energy_cost_per_kwh) || 0);
    return { line, prodHours, energyCost };
  }), [lines, monthOrders, machineToLine]);

  const monthTotals = useMemo(() => {
    const prodMinutes = monthOrders.reduce((s, o) => s + (Number(o.production_minutes) || 0), 0);
    return { prodHours: prodMinutes / 60 };
  }, [monthOrders]);

  const apportionment = useMemo(() => {
    if (!currentDre) return { costPerKg: 0, costPerMachineHour: 0 };
    const items = (currentDre.items || []).filter((i) => i.apportionment_method !== 'none');
    const volumeTotal = items.filter((i) => i.apportionment_method === 'volume').reduce((s, i) => s + (Number(i.actual_value) || 0), 0);
    const hoursTotal = items.filter((i) => i.apportionment_method === 'machine_hours').reduce((s, i) => s + (Number(i.actual_value) || 0), 0);
    return {
      costPerKg: monthWeightKg > 0 ? volumeTotal / monthWeightKg : 0,
      costPerMachineHour: monthTotals.prodHours > 0 ? hoursTotal / monthTotals.prodHours : 0,
    };
  }, [currentDre, monthWeightKg, monthTotals]);

  const avgEnergyPerKg = useMemo(() => {
    const totalEnergy = lineCosts.reduce((s, lc) => s + lc.energyCost, 0);
    return monthWeightKg > 0 ? totalEnergy / monthWeightKg : 0;
  }, [lineCosts, monthWeightKg]);

  // Horas por unidade por produto (média real)
  const productHoursPerUnit = useMemo(() => {
    const map = {};
    monthOrders.forEach((o) => {
      const pid = o.product_type_id;
      if (!pid) return;
      if (!map[pid]) map[pid] = { hours: 0, produced: 0 };
      map[pid].hours += (Number(o.production_minutes) || 0) / 60;
      map[pid].produced += Number(o.actual_quantity) || 0;
    });
    const out = {};
    Object.keys(map).forEach((pid) => {
      out[pid] = map[pid].produced > 0 ? map[pid].hours / map[pid].produced : 0;
    });
    return out;
  }, [monthOrders]);

  // Média dos últimos 3 meses de DRE (média móvel trimestral) — rateio, energia e horas/un
  const averageData = useMemo(() => {
    const last3 = [...sortedDres].slice(-3);
    if (last3.length === 0) return { costPerKg: 0, costPerMachineHour: 0, avgEnergyPerKg: 0, productHoursPerUnit: {}, monthsCount: 0 };
    let totalVol = 0, totalHoursCost = 0, totalWeight = 0, totalProdHours = 0, totalEnergy = 0;
    const phuMap = {};
    last3.forEach((dre) => {
      const items = (dre.items || []).filter((i) => i.apportionment_method !== 'none');
      totalVol += items.filter((i) => i.apportionment_method === 'volume').reduce((s, i) => s + (Number(i.actual_value) || 0), 0);
      totalHoursCost += items.filter((i) => i.apportionment_method === 'machine_hours').reduce((s, i) => s + (Number(i.actual_value) || 0), 0);
      const [y, m] = dre.reference_month.split('-').map(Number);
      const mo = orders.filter((o) => {
        if (!o.production_date) return false;
        const d = new Date(o.production_date + 'T00:00:00');
        return d.getFullYear() === y && (d.getMonth() + 1) === m;
      });
      const w = mo.reduce((s, o) => {
        const pt = ptMap[o.product_type_id];
        if (orderHasRealWeight(o)) return s + orderRealWeightKg(o);
        return s + (Number(o.actual_quantity) || 0) * weightPerSaleUnit(pt);
      }, 0);
      totalWeight += w;
      totalProdHours += mo.reduce((s, o) => s + (Number(o.production_minutes) || 0), 0) / 60;
      lines.forEach((line) => {
        const lineOrders = mo.filter((o) => o.production_line_id ? o.production_line_id === line.id : o.machine_id && machineToLine[o.machine_id] === line.id);
        const lph = lineOrders.reduce((s, o) => s + (Number(o.production_minutes) || 0), 0) / 60;
        totalEnergy += lph * (Number(line.used_power_kw) || 0) * (Number(line.energy_cost_per_kwh) || 0);
      });
      mo.forEach((o) => {
        const pid = o.product_type_id;
        if (!pid) return;
        if (!phuMap[pid]) phuMap[pid] = { hours: 0, produced: 0 };
        phuMap[pid].hours += (Number(o.production_minutes) || 0) / 60;
        phuMap[pid].produced += Number(o.actual_quantity) || 0;
      });
    });
    const phu = {};
    Object.keys(phuMap).forEach((pid) => { phu[pid] = phuMap[pid].produced > 0 ? phuMap[pid].hours / phuMap[pid].produced : 0; });
    return {
      costPerKg: totalWeight > 0 ? totalVol / totalWeight : 0,
      costPerMachineHour: totalProdHours > 0 ? totalHoursCost / totalProdHours : 0,
      avgEnergyPerKg: totalWeight > 0 ? totalEnergy / totalWeight : 0,
      productHoursPerUnit: phu,
      monthsCount: last3.length,
    };
  }, [sortedDres, orders, ptMap, lines, machineToLine]);

  const isAverage = calcMode === 'average';
  const activeApportionment = isAverage ? averageData : apportionment;
  const activeEnergyPerKg = isAverage ? averageData.avgEnergyPerKg : avgEnergyPerKg;
  const activeProductHours = isAverage ? averageData.productHoursPerUnit : productHoursPerUnit;

  const categories = useMemo(() => {
    const set = new Set();
    productTypes.forEach((p) => p.category && set.add(p.category));
    return ['all', ...Array.from(set)];
  }, [productTypes]);

  const visibleProducts = useMemo(() => {
    return productTypes.filter((p) => p.active !== false && (categoryFilter === 'all' || p.category === categoryFilter));
  }, [productTypes, categoryFilter]);

  function rowFor(ptId) {
    return rows[ptId] || { commission: defaults.commission, freight: defaults.freight, other: defaults.other, margin: defaults.margin, taxRate: defaults.taxRate };
  }

  function setRow(ptId, field, val) {
    setRows((prev) => {
      const next = { ...prev, [ptId]: { ...rowFor(ptId), [field]: val } };
      saveRows(next);
      return next;
    });
  }

  function applyRegime(regime) {
    const tax = regimeTaxes[regime] ?? REGIME_DEFAULT_TAX[regime] ?? 0;
    const next = { ...defaults, regime, taxRate: tax };
    setDefaults(next);
    saveDefaults(next);
  }

  function updateRegimeTax(tax) {
    const t = Number(tax) || 0;
    updateDefaults('taxRate', t);
    setRegimeTaxes((prev) => {
      const next = { ...prev, [defaults.regime]: t };
      saveRegimeTaxes(next);
      return next;
    });
  }

  function applyDefaultsToAll() {
    const next = {};
    visibleProducts.forEach((p) => {
      next[p.id] = { ...defaults };
    });
    setRows((prev) => {
      const merged = { ...prev, ...next };
      saveRows(merged);
      return merged;
    });
    saveDefaults(defaults);
  }

  function updateDefaults(field, val) {
    const next = { ...defaults, [field]: val };
    setDefaults(next);
    saveDefaults(next);
  }

  async function handleApplyPrice(pt) {
    const baseCost = totalProductionCostPerUnit(pt, {
      insumoCosts,
      avgEnergyPerKg: activeEnergyPerKg,
      costPerKg: activeApportionment.costPerKg,
      costPerMachineHour: activeApportionment.costPerMachineHour,
      hoursPerUnit: activeProductHours[pt.id] || 0,
    });
    const price = calculateSuggestedPrice(baseCost, rowFor(pt.id));
    setSavingId(pt.id);
    try {
      await base44.entities.ProductType.update(pt.id, { selling_price: +price.toFixed(2) });
      setProductTypes((prev) => prev.map((p) => p.id === pt.id ? { ...p, selling_price: +price.toFixed(2) } : p));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" /> Simulador de Preços
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Ajuste margem, comissão, frete e outros custos de venda para definir o preço sugerido.</p>
        </div>
        <button onClick={() => setShowReport(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
          <Printer className="w-4 h-4" /> Relatório
        </button>
      </div>

      {/* Seletor de modo de cálculo + mês */}
      <div className="flex items-center gap-3 flex-wrap">
        {sortedDres.length > 0 && (
          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            <button onClick={() => setCalcMode('single')}
              className={`text-xs px-3 py-1.5 transition-colors ${calcMode === 'single' ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground hover:bg-muted'}`}>
              Mês selecionado
            </button>
            <button onClick={() => setCalcMode('average')}
              className={`text-xs px-3 py-1.5 border-l border-border transition-colors ${calcMode === 'average' ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground hover:bg-muted'}`}>
              Média trimestral
            </button>
          </div>
        )}
        {calcMode === 'single' ? (
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
        ) : (
          <span className="text-xs text-muted-foreground">
            Base de custos: média móvel dos últimos {averageData.monthsCount || 3} meses de DRE (suaviza variações sazonais).
          </span>
        )}
        {sortedDres.length === 0 && (
          <span className="text-xs text-amber-600">Nenhuma DRE importada — usando apenas custo direto.</span>
        )}
      </div>

      {/* Defaults globais */}
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
              value={defaults.regime} onChange={(e) => applyRegime(e.target.value)}>
              <option value="simples">Simples Nacional</option>
              <option value="real">Lucro Real/Presumido</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"><Percent className="w-3 h-3" /> Alíquota Imposto (%)</label>
            <input type="number" min="0" max="100" step="0.01"
              className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={defaults.taxRate} onChange={(e) => updateRegimeTax(e.target.value)} />
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
            <label className="block text-xs font-medium text-muted-foreground mb-1">Outros Custos (R$)</label>
            <input type="number" min="0" step="0.01"
              className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={defaults.other} onChange={(e) => updateDefaults('other', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Margem Desejada (%)</label>
            <input type="number" min="0" max="99" step="0.1"
              className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={defaults.margin} onChange={(e) => updateDefaults('margin', e.target.value)} />
          </div>
        </div>
      </section>

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
                  <th className="text-right py-2 font-medium">Custo Prod.</th>
                  <th className="text-right py-2 font-medium">% Imposto</th>
                  <th className="text-right py-2 font-medium">% Comis.</th>
                  <th className="text-right py-2 font-medium">Frete (R$)</th>
                  <th className="text-right py-2 font-medium">Outros (R$)</th>
                  <th className="text-right py-2 font-medium">Margem (%)</th>
                  <th className="text-right py-2 font-medium">Preço Sugerido</th>
                  <th className="text-right py-2 font-medium">Preço Atual</th>
                  <th className="text-center py-2 font-medium">Ação</th>
                </tr>
              </thead>
              <tbody>
                {visibleProducts.map((pt) => {
                  const baseCost = totalProductionCostPerUnit(pt, {
                    insumoCosts,
                    avgEnergyPerKg: activeEnergyPerKg,
                    costPerKg: activeApportionment.costPerKg,
                    costPerMachineHour: activeApportionment.costPerMachineHour,
                    hoursPerUnit: activeProductHours[pt.id] || 0,
                  });
                  const row = rowFor(pt.id);
                  const suggested = calculateSuggestedPrice(baseCost, row);
                  const current = Number(pt.selling_price) || 0;
                  const diff = suggested - current;
                  const suggestedColor = current > 0 && diff > 0 ? 'text-red-600 font-bold' : current > 0 && diff < 0 ? 'text-green-600' : 'text-foreground';
                  return (
                    <tr key={pt.id} className="border-b border-border/50">
                      <td className="py-1.5 text-foreground">{pt.name}</td>
                      <td className="py-1.5 text-center text-muted-foreground">{unitLabel(pt)}</td>
                      <td className="py-1.5 text-right text-muted-foreground">{fmtBRL(baseCost)}</td>
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
                        <input type="number" min="0" step="0.01" className="w-20 border border-input rounded-md px-1.5 py-1 text-xs bg-background text-right focus:outline-none focus:ring-1 focus:ring-ring"
                          value={row.other} onChange={(e) => setRow(pt.id, 'other', e.target.value)} />
                      </td>
                      <td className="py-1.5 text-right">
                        <input type="number" min="0" max="99" step="0.1" className="w-16 border border-input rounded-md px-1.5 py-1 text-xs bg-background text-right focus:outline-none focus:ring-1 focus:ring-ring"
                          value={row.margin} onChange={(e) => setRow(pt.id, 'margin', e.target.value)} />
                      </td>
                      <td className={`py-1.5 text-right font-bold ${suggestedColor}`}>{fmtBRL(suggested)}</td>
                      <td className="py-1.5 text-right text-muted-foreground">{current ? fmtBRL(current) : '—'}</td>
                      <td className="py-1.5 text-center">
                        <button onClick={() => handleApplyPrice(pt)} disabled={savingId === pt.id}
                          className="flex items-center gap-1 mx-auto text-xs bg-primary text-primary-foreground px-2.5 py-1 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50">
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
            <strong>Preço Sugerido</strong> = (Custo Produção + Frete + Outros) ÷ (1 − Margem% − Comissão% − Imposto%). O imposto incide sobre o preço final (markup "por dentro"), conforme legislação brasileira. Alíquota padrão do Simples Nacional ≈ 12,5%; Lucro Real/Presumido ≈ 18% (ajuste com a carga efetiva do seu contador). <span className="text-red-600 font-medium">Vermelho: preço atual defasado (abaixo do sugerido)</span>; <span className="text-green-600 font-medium">verde: preço atual acima do sugerido</span>. Clique em <strong>Aplicar</strong> para gravar no cadastro do produto.
          </p>
        </section>
      )}

      {showReport && (
        <PricingReport
          orders={orders}
          lines={lines}
          dres={sortedDres}
          productTypes={productTypes}
          insumoCosts={insumoCosts}
          defaults={defaults}
          rows={rows}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}