import { useMemo, useState } from 'react';
import { Scale, AlertTriangle, Table2 } from 'lucide-react';
import { FINANCIAL_PERIODS } from '@/lib/industrialCostEngine';
import { buildBreakEvenAnalysis } from '@/lib/breakEvenEngine';
import BreakEvenCards from './BreakEvenCards';
import BreakEvenMarginCards from './BreakEvenMarginCards';
import BreakEvenCharts from './BreakEvenCharts';
import BreakEvenCompositionModal from './BreakEvenCompositionModal';

// Seção "Ponto de Equilíbrio da Empresa" da Análise de Custos.
// O componente apenas carrega/seleciona o período e chama o motor — todas as
// fórmulas vivem em src/lib/breakEvenEngine.js (camada sobre o v2.2).
export default function BreakEvenSection({ dres, orders, productTypes, lines, accounts, insumoCosts, selectedMonth }) {
  const [financialPeriod, setFinancialPeriod] = useState('selected_month');
  const [showComposition, setShowComposition] = useState(false);
  const [viewMode, setViewMode] = useState('accumulated'); // 'accumulated' | 'monthly'

  const analysis = useMemo(() => buildBreakEvenAnalysis({
    dres, orders, productTypes, lines, accounts, insumoCosts,
    financialPeriod, selectedMonth,
  }), [dres, orders, productTypes, lines, accounts, insumoCosts, financialPeriod, selectedMonth]);

  const dreCount = analysis.period.dreCount;
  // Visão apenas de APRESENTAÇÃO: na média mensal os valores absolutos do
  // período são divididos pelo nº de DREs. MC%, participações e percentuais
  // NUNCA são recalculados (razão de totais — idêntica nas duas visões).
  // O motor permanece intacto; a evolução mensal segue com valores individuais.
  const viewAnalysis = useMemo(() => {
    if (viewMode !== 'monthly' || !(dreCount > 1)) return analysis;
    const s = (v) => (v == null ? null : v / dreCount);
    return {
      ...analysis,
      revenue: { ...analysis.revenue, current: s(analysis.revenue.current) },
      variableCosts: { ...analysis.variableCosts, total: s(analysis.variableCosts.total) },
      contributionMargin: { ...analysis.contributionMargin, value: s(analysis.contributionMargin.value) },
      fixedIndustrialCosts: s(analysis.fixedIndustrialCosts),
      fixedCashCosts: s(analysis.fixedCashCosts),
      fixedNonCashCosts: s(analysis.fixedNonCashCosts),
      financialCashCosts: s(analysis.financialCashCosts),
      financialNonCashCosts: s(analysis.financialNonCashCosts),
      industrial: { ...analysis.industrial, fixedCosts: s(analysis.industrial.fixedCosts), breakEvenRevenue: s(analysis.industrial.breakEvenRevenue), breakEvenUnits: s(analysis.industrial.breakEvenUnits) },
      cash: { ...analysis.cash, fixedCosts: s(analysis.cash.fixedCosts), breakEvenRevenue: s(analysis.cash.breakEvenRevenue), breakEvenUnits: s(analysis.cash.breakEvenUnits) },
      financial: { ...analysis.financial, fixedCosts: s(analysis.financial.fixedCosts), financialCashCosts: s(analysis.financial.financialCashCosts), breakEvenRevenue: s(analysis.financial.breakEvenRevenue), breakEvenUnits: s(analysis.financial.breakEvenUnits) },
      safetyMargin: { ...analysis.safetyMargin, revenue: s(analysis.safetyMargin.revenue), breakEven: s(analysis.safetyMargin.breakEven), value: s(analysis.safetyMargin.value) },
      composition: analysis.composition.map((row) => ({ ...row, value: s(row.value) })),
    };
  }, [analysis, viewMode, dreCount]);

  const selectedLabel = dres.find((d) => d.reference_month === selectedMonth)?.month_label || selectedMonth || '—';

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Scale className="w-4 h-4 text-primary" /> Ponto de Equilíbrio da Empresa
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Quanto a empresa precisa faturar para cobrir seus custos industriais, desembolsos de caixa e compromissos financeiros.
        </p>
      </div>

      {/* Seletor de período financeiro — mesmo conceito do motor v2.2/Simulador */}
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
          <span className="text-xs text-muted-foreground">Mês: <strong className="text-foreground">{selectedLabel}</strong> (seletor do topo da página)</span>
        )}
        {/* Seletor de visão: acumulado do período × média mensal (apenas apresentação) */}
        <span className="text-xs text-muted-foreground">Visão:</span>
        <div className="inline-flex rounded-lg border border-border overflow-hidden">
          <button onClick={() => setViewMode('accumulated')}
            className={`text-xs px-3 py-1.5 transition-colors border-r border-border ${viewMode === 'accumulated' ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground hover:bg-muted'}`}>
            Acumulado do período
          </button>
          <button onClick={() => setViewMode('monthly')} disabled={dreCount <= 1}
            className={`text-xs px-3 py-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${viewMode === 'monthly' ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground hover:bg-muted'}`}>
            Média mensal
          </button>
        </div>
        {dreCount <= 1 ? (
          <span className="text-xs text-amber-600 dark:text-amber-400">Período com apenas 1 mês — a média mensal é igual ao acumulado.</span>
        ) : viewMode === 'monthly' && (
          <span className="text-xs text-muted-foreground">Valores divididos por <strong className="text-foreground">{dreCount}</strong> mês(es) — percentuais permanecem idênticos.</span>
        )}
        <span className="text-xs text-muted-foreground">
          Período considerado: <strong className="text-foreground">{analysis.period.label}</strong> — {analysis.period.dreCount} DRE(s)
          {analysis.period.months.length > 0 && analysis.period.months.length <= 6 ? ` (${analysis.period.months.join(' · ')})` : ''}
        </span>
      </div>

      {/* Alertas — nunca bloqueiam a análise */}
      {analysis.warnings.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-xl p-3 space-y-1">
          {analysis.warnings.map((msg, i) => (
            <p key={i} className="text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> {msg}
            </p>
          ))}
        </div>
      )}

      <BreakEvenCards analysis={viewAnalysis} />
      <BreakEvenMarginCards analysis={viewAnalysis} />
      <BreakEvenCharts analysis={viewAnalysis} />

      <div className="flex justify-center">
        <button onClick={() => setShowComposition(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">
          <Table2 className="w-4 h-4" /> Ver composição
        </button>
      </div>

      {showComposition && (
        <BreakEvenCompositionModal analysis={viewAnalysis} onClose={() => setShowComposition(false)} />
      )}
    </section>
  );
}