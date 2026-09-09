import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Calculator, FileSpreadsheet, Gauge, Package, Zap, Layers, DollarSign, AlertTriangle, Activity, Printer } from 'lucide-react';
import DreImporter from '@/components/cost/DreImporter';
import CostsReport from '@/components/reports/CostsReport';
import { fmtBRL, fmtNum } from '@/lib/statsUtils';
import { useInsumoCosts } from '@/hooks/useInsumoCosts';
import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';
import { Save } from 'lucide-react';

function fmtBRL4(v) {
  if (v == null || !isFinite(v)) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

// Peso por unidade de venda (kg) — normaliza produtos vendidos em un/m²/m
// un: peso por peça; m²/m: peças por metro × peso por peça
function weightPerSaleUnit(pt) {
  if (!pt) return 0;
  const w = Number(pt.volume_per_unit_m3) || 0; // peso por peça (kg)
  const unit = String(pt.unit || 'un').toLowerCase();
  if (unit === 'un') return w;
  const ppm = Number(pt.pieces_per_m) || 0;
  return ppm > 0 ? ppm * w : w;
}

// Campos de materiais reais lançados na ordem (kg) — água em L ≈ kg
const REAL_WEIGHT_FIELDS = [
  'actual_cement', 'actual_sand_artificial', 'actual_sand_medium',
  'actual_sand_fine', 'actual_gravel', 'actual_additive', 'actual_pigment', 'actual_water',
];

// Peso real total consumido numa ordem (kg) — soma das matérias-primas reais lançadas
function orderRealWeightKg(o) {
  if (!o) return 0;
  return REAL_WEIGHT_FIELDS.reduce((s, f) => s + (Number(o[f]) || 0), 0);
}

// Tem lançamento real de materiais na ordem?
function orderHasRealWeight(o) {
  return REAL_WEIGHT_FIELDS.some((f) => o[f] != null && Number(o[f]) > 0);
}

function unitLabel(pt) {
  const u = String(pt?.unit || 'un').toLowerCase();
  if (u === 'm2') return 'm²';
  if (u === 'm') return 'm';
  return 'un';
}

export default function CostAnalysis() {
  const [orders, setOrders] = useState([]);
  const [lines, setLines] = useState([]);
  const [dres, setDres] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [showDre, setShowDre] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const { costs: insumoCosts } = useInsumoCosts();
  const [priceEdits, setPriceEdits] = useState({}); // productId -> { value, saved }
  const [savingPriceId, setSavingPriceId] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      base44.entities.ProductionOrder.filter({ status: 'Concluída' }, '-production_date', 2000),
      base44.entities.ProductionLine.list('name', 200),
      base44.entities.MonthlyDre.list('-reference_month', 100),
      base44.entities.ProductType.list('name', 500),
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

  function reloadDres() {
    base44.entities.MonthlyDre.list('-reference_month', 100).then((d) => {
      setDres(d);
      if (d.length && !selectedMonth) {
        const latest = [...d].sort((a, b) => String(b.reference_month).localeCompare(String(a.reference_month)))[0];
        setSelectedMonth(latest.reference_month);
      }
    }).catch(() => {});
  }

  // Filtra ordens do mês selecionado
  const monthOrders = useMemo(() => {
    if (!selectedMonth) return [];
    const [y, m] = selectedMonth.split('-').map(Number);
    return orders.filter((o) => {
      if (!o.production_date) return false;
      const d = new Date(o.production_date + 'T00:00:00');
      return d.getFullYear() === y && (d.getMonth() + 1) === m;
    });
  }, [orders, selectedMonth]);

  const currentDre = useMemo(() => {
    const d = dres.find((d) => d.reference_month === selectedMonth);
    if (!d) return null;
    const items = d.items || [];
    // Recalcula totais separados caso a DRE foi salva antes dos novos campos
    if (d.total_receita_actual == null || d.total_despesa_actual == null) {
      const receitaPlanned = items.filter((i) => i.category === 'Receita').reduce((s, i) => s + (Number(i.planned_value) || 0), 0);
      const receitaActual = items.filter((i) => i.category === 'Receita').reduce((s, i) => s + (Number(i.actual_value) || 0), 0);
      const despesaPlanned = items.filter((i) => i.category !== 'Receita').reduce((s, i) => s + (Number(i.planned_value) || 0), 0);
      const despesaActual = items.filter((i) => i.category !== 'Receita').reduce((s, i) => s + (Number(i.actual_value) || 0), 0);
      return {
        ...d,
        total_receita_planned: d.total_receita_planned ?? receitaPlanned,
        total_receita_actual: d.total_receita_actual ?? receitaActual,
        total_despesa_planned: d.total_despesa_planned ?? despesaPlanned,
        total_despesa_actual: d.total_despesa_actual ?? despesaActual,
      };
    }
    return d;
  }, [dres, selectedMonth]);

  // DREs ordenadas cronologicamente (mês de referência crescente)
  const sortedDres = useMemo(() => [...dres].sort((a, b) => String(a.reference_month).localeCompare(String(b.reference_month))), [dres]);

  // Totais de produção do mês
  const monthTotals = useMemo(() => {
    const produced = monthOrders.reduce((s, o) => s + (Number(o.actual_quantity) || 0), 0);
    const prodMinutes = monthOrders.reduce((s, o) => s + (Number(o.production_minutes) || 0), 0);
    const prodHours = prodMinutes / 60;
    const cycles = monthOrders.reduce((s, o) => s + (Number(o.machine_cycles_actual) || Number(o.machine_cycles_planned) || 0), 0);
    return { produced, prodMinutes, prodHours, cycles, orderCount: monthOrders.length };
  }, [monthOrders]);

  // Mapa produto → cadastro (para normalizar peso por unidade de venda)
  const ptMap = useMemo(() => {
    const m = {};
    productTypes.forEach((p) => { m[p.id] = p; });
    return m;
  }, [productTypes]);

  // Total produzido em kg (base de rateio por peso)
  // Usa o peso real consumido quando a ordem tem lançamento de matérias-primas;
  // caso contrário, estima pela quantidade × peso do cadastro.
  const monthWeightKg = useMemo(() => monthOrders.reduce((s, o) => {
    const pt = ptMap[o.product_type_id];
    if (orderHasRealWeight(o)) return s + orderRealWeightKg(o);
    return s + (Number(o.actual_quantity) || 0) * weightPerSaleUnit(pt);
  }, 0), [monthOrders, ptMap]);

  // Mapa máquina → linha (para casar ordens que não têm production_line_id)
  const machineToLine = useMemo(() => {
    const map = {};
    lines.forEach((line) => {
      (line.machines || []).forEach((m) => {
        if (m.machine_id) map[m.machine_id] = line.id;
      });
    });
    return map;
  }, [lines]);

  // Rateio por linha (custos diretos de energia + recursos compartilhados)
  const lineCosts = useMemo(() => {
    return lines.map((line) => {
      const lineOrders = monthOrders.filter((o) =>
        o.production_line_id
          ? o.production_line_id === line.id
          : o.machine_id && machineToLine[o.machine_id] === line.id
      );
      const produced = lineOrders.reduce((s, o) => s + (Number(o.actual_quantity) || 0), 0);
      const prodMinutes = lineOrders.reduce((s, o) => s + (Number(o.production_minutes) || 0), 0);
      const prodHours = prodMinutes / 60;
      const cycles = lineOrders.reduce((s, o) => s + (Number(o.machine_cycles_actual) || Number(o.machine_cycles_planned) || 0), 0);

      const usedPower = Number(line.used_power_kw) || 0;
      const energyCost = prodHours * usedPower * (Number(line.energy_cost_per_kwh) || 0);

      // Recursos compartilhados já são custos indiretos variáveis locais (rateados por % de uso)
      const sharedCost = 0; // mantido info no detalhe da linha; aqui focamos na DRE

      // Velocidade de cruzeiro: ciclos/hora reais vs meta
      const actualCyclesPerHour = prodHours > 0 ? cycles / prodHours : 0;
      const targetCyclesPerHour = Number(line.target_cycles_per_hour) || 0;
      const cruisePct = targetCyclesPerHour > 0 ? (actualCyclesPerHour / targetCyclesPerHour) * 100 : 0;

      return {
        line, produced, prodMinutes, prodHours, cycles, energyCost, sharedCost,
        actualCyclesPerHour, targetCyclesPerHour, cruisePct, orderCount: lineOrders.length,
      };
    });
  }, [lines, monthOrders, machineToLine]);

  // Rateio da DRE sobre a produção do mês — base por peso (kg)
  const apportionment = useMemo(() => {
    if (!currentDre) return null;
    const items = (currentDre.items || []).filter((i) => i.apportionment_method !== 'none');
    const totalWeight = monthWeightKg || 0;
    const totalMachineHours = monthTotals.prodHours || 0;

    const volumeItems = items.filter((i) => i.apportionment_method === 'volume');
    const hoursItems = items.filter((i) => i.apportionment_method === 'machine_hours');

    const volumeTotal = volumeItems.reduce((s, i) => s + (Number(i.actual_value) || 0), 0);
    const hoursTotal = hoursItems.reduce((s, i) => s + (Number(i.actual_value) || 0), 0);

    // Rateio por peso: R$/kg — custo por unidade de venda = R$/kg × peso/un
    const costPerKg = totalWeight > 0 ? volumeTotal / totalWeight : 0;
    // Rateio por horas de máquina: R$/h
    const costPerMachineHour = totalMachineHours > 0 ? hoursTotal / totalMachineHours : 0;

    return {
      volumeItems, hoursItems, volumeTotal, hoursTotal,
      totalApportionable: volumeTotal + hoursTotal,
      costPerKg, costPerMachineHour,
      totalWeight, totalMachineHours,
    };
  }, [currentDre, monthWeightKg, monthTotals]);

  // Custo de energia por kg (direto operacional)
  const avgEnergyPerKg = useMemo(() => {
    const totalEnergy = lineCosts.reduce((s, lc) => s + lc.energyCost, 0);
    return monthWeightKg > 0 ? totalEnergy / monthWeightKg : 0;
  }, [lineCosts, monthWeightKg]);

  // Custo direto de matérias-primas por unidade de venda (R$) — usa custos de insumos cadastrados
  function directMaterialCostPerUnit(pt) {
    if (!pt) return 0;
    return INSUMO_KEYS.reduce((s, key) => {
      const { pt_field } = INSUMO_FIELDS[key];
      const qty = Number(pt[pt_field]) || 0;
      const cost = Number(insumoCosts?.[key]) || 0;
      return s + qty * cost;
    }, 0);
  }

  async function handleSavePrice(ptId) {
    const edit = priceEdits[ptId];
    if (!edit) return;
    setSavingPriceId(ptId);
    try {
      await base44.entities.ProductType.update(ptId, { selling_price: Number(edit.value) || 0 });
      setProductTypes((prev) => prev.map((p) => p.id === ptId ? { ...p, selling_price: Number(edit.value) || 0 } : p));
      setPriceEdits((prev) => ({ ...prev, [ptId]: { ...prev[ptId], saved: true } }));
    } finally {
      setSavingPriceId(null);
    }
  }

  // Detalhe por produto: produção, peso total e horas, para custo indireto por unidade de venda
  // Peso unitário = peso do cadastro do produto, normalizado por unidade de venda.
  const productBreakdown = useMemo(() => {
    const map = {};
    monthOrders.forEach((o) => {
      const pid = o.product_type_id;
      if (!pid) return;
      if (!map[pid]) map[pid] = { pt: ptMap[pid], produced: 0, kg: 0, hours: 0 };
      const qty = Number(o.actual_quantity) || 0;
      map[pid].produced += qty;
      map[pid].kg += qty * weightPerSaleUnit(ptMap[pid]);
      map[pid].hours += (Number(o.production_minutes) || 0) / 60;
    });
    return Object.values(map).filter((r) => r.pt);
  }, [monthOrders, ptMap]);

  const stat = (icon, label, value, sub, color) => (
    <div className="bg-card rounded-xl p-4 border border-border">
      <div className="flex items-center gap-2 mb-1.5">
        <icon className={`w-4 h-4 ${color || 'text-primary'}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-lg font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" /> Análise de Custos
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Integração da DRE mensal com a produção — rateio de custos fixos e indiretos por artefato.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowReport(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-border text-muted-foreground hover:bg-muted transition-colors">
            <Printer className="w-4 h-4" /> Relatório
          </button>
          <button onClick={() => setShowDre(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <FileSpreadsheet className="w-4 h-4" /> Gerenciar DRE
          </button>
        </div>
      </div>

      {/* Seletor de mês */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Mês de referência:</span>
        {dres.length === 0 ? (
          <span className="text-xs text-amber-600">Nenhuma DRE importada. Clique em "Gerenciar DRE".</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {sortedDres.map((d) => (
              <button key={d.id} onClick={() => setSelectedMonth(d.reference_month)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${selectedMonth === d.reference_month ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-foreground hover:bg-muted'}`}>
                {d.month_label}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* Faturamento Total Realizado */}
          {currentDre && (
            <section className="bg-amber-400 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-xs font-semibold text-amber-900/80 uppercase tracking-wide">Faturamento Total Realizado</p>
                  <p className="text-[11px] text-amber-900/70 mt-0.5">{currentDre.faturamento_account || 'Receitas Operacionais'} — resultado de venda (não somado)</p>
                </div>
                <p className="text-2xl md:text-3xl font-bold text-amber-950">
                  {fmtBRL(Number(currentDre.faturamento_actual) || 0)}
                </p>
              </div>
            </section>
          )}

          {/* Resumo do mês */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stat(Package, 'Produção do Mês', fmtNum(monthWeightKg, 0), `${monthTotals.orderCount} ordens • ${fmtNum(monthTotals.produced, 0)} un`)}
            {stat(Activity, 'Horas de Máquina', fmtNum(monthTotals.prodHours, 1), `${fmtNum(monthTotals.cycles, 0)} ciclos`)}
            {stat(Zap, 'Custo Energia (mês)', fmtBRL(lineCosts.reduce((s, lc) => s + lc.energyCost, 0)), `${fmtBRL4(avgEnergyPerKg)}/kg`)}
            {apportionment ? stat(Layers, 'Rateio DRE / kg', fmtBRL(apportionment.costPerKg), `Total: ${fmtBRL(apportionment.totalApportionable)}`) : stat(AlertTriangle, 'Rateio DRE', '—', 'Sem DRE no mês')}
          </section>

          {/* Resumo da DRE por categoria */}
          {currentDre && (
            <section className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-primary" /> DRE de {currentDre.month_label}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border">
                      <th className="text-left py-2 font-medium">Conta</th>
                      <th className="text-right py-2 font-medium">Orçado</th>
                      <th className="text-right py-2 font-medium">Realizado</th>
                      <th className="text-left py-2 font-medium pl-3">Categoria</th>
                      <th className="text-left py-2 font-medium pl-3">Rateio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(currentDre.items || []).map((it, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-1.5 text-foreground">{it.account_name}</td>
                        <td className="py-1.5 text-right text-muted-foreground">{fmtBRL(Number(it.planned_value) || 0)}</td>
                        <td className="py-1.5 text-right font-medium text-foreground">{fmtBRL(Number(it.actual_value) || 0)}</td>
                        <td className="py-1.5 pl-3 text-muted-foreground">{it.category}</td>
                        <td className="py-1.5 pl-3 text-muted-foreground">
                          {it.apportionment_method === 'volume' ? 'Por volume' : it.apportionment_method === 'machine_hours' ? 'Por horas' : 'Não aloca'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold bg-green-50/50 dark:bg-green-950/20">
                      <td className="py-2 text-foreground">Total Receitas</td>
                      <td className="py-2 text-right text-green-700 dark:text-green-400">{fmtBRL(currentDre.total_receita_planned || 0)}</td>
                      <td className="py-2 text-right text-green-700 dark:text-green-400">{fmtBRL(currentDre.total_receita_actual || 0)}</td>
                      <td className="py-2 pl-3 text-muted-foreground" colSpan={2}>Receitas do mês</td>
                    </tr>
                    <tr className="font-semibold bg-red-50/50 dark:bg-red-950/20">
                      <td className="py-2 text-foreground">Total Despesas</td>
                      <td className="py-2 text-right text-red-700 dark:text-red-400">{fmtBRL(currentDre.total_despesa_planned || 0)}</td>
                      <td className="py-2 text-right text-red-700 dark:text-red-400">{fmtBRL(currentDre.total_despesa_actual || 0)}</td>
                      <td className="py-2 pl-3 text-muted-foreground" colSpan={2}>Custos e despesas</td>
                    </tr>
                    <tr className="font-semibold border-t-2 border-border">
                      <td className="py-2 text-foreground">Resultado</td>
                      <td className="py-2 text-right text-foreground">{fmtBRL((Number(currentDre.total_receita_planned) || 0) - (Number(currentDre.total_despesa_planned) || 0))}</td>
                      <td className="py-2 text-right text-foreground">{fmtBRL((Number(currentDre.total_receita_actual) || 0) - (Number(currentDre.total_despesa_actual) || 0))}</td>
                      <td className="py-2 pl-3 text-primary" colSpan={2}>Rateável: {fmtBRL(currentDre.total_apportionable || 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          )}

          {/* Velocidade de cruzeiro por linha */}
          <section>
            <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
              <Gauge className="w-4 h-4 text-primary" /> Velocidade de Cruzeiro por Linha
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {lineCosts.map((lc) => {
                const cruiseColor = lc.cruisePct >= 100 ? 'text-green-600' : lc.cruisePct >= 70 ? 'text-amber-600' : 'text-red-600';
                return (
                  <div key={lc.line.id} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-foreground text-sm">{lc.line.name}</p>
                      {lc.line.active === false && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Inativa</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-muted/40 rounded-lg p-2 border border-border">
                        <p className="text-muted-foreground text-[10px]">Ciclos/hora Real</p>
                        <p className={`font-semibold ${cruiseColor}`}>{fmtNum(lc.actualCyclesPerHour, 0)} cic/h</p>
                      </div>
                      <div className="bg-muted/40 rounded-lg p-2 border border-border">
                        <p className="text-muted-foreground text-[10px]">Meta Cruzeiro</p>
                        <p className="font-semibold text-foreground">{fmtNum(lc.targetCyclesPerHour, 0)} cic/h</p>
                      </div>
                      <div className="bg-muted/40 rounded-lg p-2 border border-border col-span-2">
                        <p className="text-muted-foreground text-[10px]">Aproveitamento da Meta</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full ${lc.cruisePct >= 100 ? 'bg-green-500' : lc.cruisePct >= 70 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, lc.cruisePct)}%` }} />
                          </div>
                          <span className={`font-semibold ${cruiseColor}`}>{fmtNum(lc.cruisePct, 0)}%</span>
                        </div>
                      </div>
                      <div className="bg-muted/40 rounded-lg p-2 border border-border">
                        <p className="text-muted-foreground text-[10px]">Produção</p>
                        <p className="font-semibold text-foreground">{fmtNum(lc.produced, 0)} pç</p>
                      </div>
                      <div className="bg-muted/40 rounded-lg p-2 border border-border">
                        <p className="text-muted-foreground text-[10px]">Horas</p>
                        <p className="font-semibold text-foreground">{fmtNum(lc.prodHours, 1)} h</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {lineCosts.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma linha cadastrada.</p>}
            </div>
          </section>

          {/* Composição do custo indireto por produto */}
          <section>
            <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" /> Composição do Custo Indireto por Produto (mês)
            </h3>
            <div className="bg-card border border-border rounded-xl p-4 space-y-4">
              {apportionment ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="bg-muted/40 rounded-lg p-3 border border-border">
                      <p className="text-muted-foreground text-[10px] mb-1">Energia (direto operacional)</p>
                      <p className="text-lg font-bold text-foreground">{fmtBRL4(avgEnergyPerKg)}</p>
                      <p className="text-muted-foreground text-[10px]">por kg</p>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-3 border border-border">
                      <p className="text-muted-foreground text-[10px] mb-1">DRE — Rateio por peso</p>
                      <p className="text-lg font-bold text-foreground">{fmtBRL4(apportionment.costPerKg)}</p>
                      <p className="text-muted-foreground text-[10px]">{fmtBRL(apportionment.volumeTotal)} ÷ {fmtNum(apportionment.totalWeight, 0)} kg</p>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-3 border border-border">
                      <p className="text-muted-foreground text-[10px] mb-1">DRE — Rateio por horas</p>
                      <p className="text-lg font-bold text-foreground">{fmtBRL4(apportionment.costPerMachineHour)}</p>
                      <p className="text-muted-foreground text-[10px]">{fmtBRL(apportionment.hoursTotal)} ÷ {fmtNum(apportionment.totalMachineHours, 1)} h</p>
                    </div>
                  </div>

                  {productBreakdown.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-muted-foreground border-b border-border">
                            <th className="text-left py-2 font-medium">Artefato</th>
                            <th className="text-center py-2 font-medium">Un. Venda</th>
                            <th className="text-right py-2 font-medium">Peso/Un (kg)</th>
                            <th className="text-right py-2 font-medium">Produzido</th>
                            <th className="text-right py-2 font-medium">Total (kg)</th>
                            <th className="text-right py-2 font-medium">Custo Direto/Un</th>
                            <th className="text-right py-2 font-medium">Custo Indireto/Un</th>
                            <th className="text-right py-2 font-medium">Custo Total/Un</th>
                            <th className="text-right py-2 font-medium">Preço Venda</th>
                            <th className="text-right py-2 font-medium">Margem R$</th>
                            <th className="text-right py-2 font-medium">Margem %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {productBreakdown.map((r) => {
                            const wu = weightPerSaleUnit(r.pt);
                            const totalKg = r.kg;
                            // Fator de conversão por unidade de venda:
                            // un → 1 (custo por peça); m²/m → pieces_per_m (converte custo por peça em custo por m²/m)
                            const ppm = Number(r.pt.pieces_per_m) || 0;
                            const saleFactor = (String(r.pt.unit || 'un').toLowerCase() !== 'un' && ppm > 0) ? ppm : 1;
                            const volCost = apportionment.costPerKg * wu;
                            const hoursPerUnit = r.produced > 0 ? r.hours / r.produced : 0;
                            const hoursCost = apportionment.costPerMachineHour * hoursPerUnit * saleFactor;
                            const indirect = volCost + hoursCost;
                            const direct = (directMaterialCostPerUnit(r.pt) + (Number(r.pt.mold_cost_per_unit) || 0)) * saleFactor + (avgEnergyPerKg * wu);
                            const totalCost = direct + indirect;
                            const savedPrice = Number(r.pt.selling_price) || 0;
                            const edit = priceEdits[r.pt.id];
                            const price = edit != null ? Number(edit.value) || 0 : savedPrice;
                            const marginRs = price - totalCost;
                            const marginPct = price > 0 ? (marginRs / price) * 100 : 0;
                            const marginColor = marginRs >= 0 ? 'text-green-600' : 'text-red-600';
                            return (
                              <tr key={r.pt.id} className="border-b border-border/50">
                                <td className="py-1.5 text-foreground">{r.pt.name}</td>
                                <td className="py-1.5 text-center text-muted-foreground">{unitLabel(r.pt)}</td>
                                <td className="py-1.5 text-right text-muted-foreground">
                                  {fmtNum(wu, 2)}
                                </td>
                                <td className="py-1.5 text-right text-foreground">{fmtNum(r.produced, 0)}</td>
                                <td className="py-1.5 text-right text-muted-foreground">{fmtNum(totalKg, 0)}</td>
                                <td className="py-1.5 text-right text-muted-foreground">{fmtBRL(direct)}</td>
                                <td className="py-1.5 text-right text-muted-foreground">{fmtBRL(indirect)}</td>
                                <td className="py-1.5 text-right font-semibold text-foreground">{fmtBRL(totalCost)}</td>
                                <td className="py-1.5 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <div className="relative">
                                      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">R$</span>
                                      <input type="number" min="0" step="0.01"
                                        className="w-24 border border-input rounded-md pl-7 pr-1 py-1 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring text-right"
                                        value={edit != null ? edit.value : savedPrice ? String(savedPrice) : ''}
                                        onChange={(e) => setPriceEdits((prev) => ({ ...prev, [r.pt.id]: { value: e.target.value, saved: false } }))}
                                        placeholder="0,00" />
                                    </div>
                                    {edit != null && (
                                      <button
                                        onClick={() => handleSavePrice(r.pt.id)}
                                        disabled={savingPriceId === r.pt.id}
                                        className="p-1 text-primary hover:bg-primary/10 rounded-md transition-colors disabled:opacity-40"
                                        title={edit.saved ? 'Preço salvo' : 'Salvar preço'}>
                                        {savingPriceId === r.pt.id
                                          ? <div className="w-3 h-3 border border-primary/40 border-t-primary rounded-full animate-spin" />
                                          : <Save className={`w-3.5 h-3.5 ${edit.saved ? 'text-green-600' : ''}`} />}
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td className={`py-1.5 text-right font-semibold ${marginColor}`}>{fmtBRL(marginRs)}</td>
                                <td className={`py-1.5 text-right font-semibold ${marginColor}`}>{price > 0 ? fmtNum(marginPct, 1) + '%' : '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    <strong>Custo Direto/Un</strong> = matérias-primas (consumo × custo do insumo) + molde + energia. <strong>Custo Indireto/Un</strong> = (R$/kg × peso/un) + (R$/h × horas/un). <strong>Custo Total/Un</strong> = direto + indireto. <strong>Margem</strong> = Preço de Venda − Custo Total. O preço de venda é editável para simulação; clique no ícone de salvar para persistir no cadastro do produto.
                    {monthWeightKg === 0 && ' ⚠️ Sem produção no mês — o rateio fica indisponível.'}
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">Importe a DRE do mês para visualizar a composição de custo.</p>
              )}
            </div>
          </section>
        </>
      )}

      {showDre && <DreImporter onClose={() => setShowDre(false)} onSaved={reloadDres} />}

      {showReport && <CostsReport initialMonth={selectedMonth || undefined} onClose={() => setShowReport(false)} />}
    </div>
  );
}