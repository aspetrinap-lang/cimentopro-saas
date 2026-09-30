import { useEffect, useMemo, useState } from 'react';
import { Scale, AlertTriangle, Table2, Target } from 'lucide-react';
import { FINANCIAL_PERIODS } from '@/lib/industrialCostEngine';
import { fmtBRL } from '@/lib/statsUtils';
import { buildBreakEvenAnalysis } from '@/lib/breakEvenEngine';
import { base44 } from '@/api/base44Client';
import { scopedFilter, withCompany } from '@/lib/companyScope';
import BreakEvenCards from './BreakEvenCards';
import BreakEvenMarginCards from './BreakEvenMarginCards';
import BreakEvenCharts from './BreakEvenCharts';
import BreakEvenCompositionModal from './BreakEvenCompositionModal';

// Seção "Ponto de Equilíbrio da Empresa" da Análise de Custos (motor v1.1).
// O componente apenas carrega/seleciona o período, mantém o Lucro Mínimo
// Desejado (PEE) por empresa e chama o motor — todas as fórmulas vivem em
// src/lib/breakEvenEngine.js. Consolidação do período: sempre por SOMA —
// a visão de média mensal foi removida (média de PE é proibida pela
// especificação; a evolução mensal continua no gráfico).
export default function BreakEvenSection({ dres, orders, productTypes, lines, accounts, insumoCosts, selectedMonth }) {
  const [financialPeriod, setFinancialPeriod] = useState('selected_month');
  const [showComposition, setShowComposition] = useState(false);
  const [desiredProfit, setDesiredProfit] = useState(0);
  const [profitInput, setProfitInput] = useState('0');
  const [savingProfit, setSavingProfit] = useState(false);
  const [profitSaved, setProfitSaved] = useState(false);

  // Lucro Mínimo Desejado — salvo por empresa (AppSettings)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = await base44.entities.AppSettings.filter(scopedFilter({ key: 'break_even_settings' }));
        if (alive && rows.length > 0) {
          const v = Number(rows[0].value && rows[0].value.desired_profit) || 0;
          setDesiredProfit(v);
          setProfitInput(String(v));
        }
      } catch (e) {
        // sem configuração — permanece 0 (PEE = PEC)
      }
    })();
    return () => { alive = false; };
  }, []);

  const analysis = useMemo(() => buildBreakEvenAnalysis({
    dres, orders, productTypes, lines, accounts, insumoCosts,
    financialPeriod, selectedMonth, desiredProfit,
  }), [dres, orders, productTypes, lines, accounts, insumoCosts, financialPeriod, selectedMonth, desiredProfit]);

  async function saveProfit() {
    const val = parseFloat(profitInput) || 0;
    setSavingProfit(true);
    try {
      const rows = await base44.entities.AppSettings.filter(scopedFilter({ key: 'break_even_settings' }));
      if (rows.length > 0) {
        await base44.entities.AppSettings.update(rows[0].id, { value: { desired_profit: val } });
      } else {
        await base44.entities.AppSettings.create(withCompany({ key: 'break_even_settings', value: { desired_profit: val } }));
      }
      setDesiredProfit(val);
      setProfitSaved(true);
      setTimeout(() => setProfitSaved(false), 2000);
    } finally {
      setSavingProfit(false);
    }
  }

  const selectedLabel = dres.find((d) => d.reference_month === selectedMonth)?.month_label || selectedMonth || '—';

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Scale className="w-4 h-4 text-primary" /> Ponto de Equilíbrio da Empresa
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Quanto a empresa precisa faturar para cobrir seus Gastos Fixos Operacionais (PEC), as obrigações financeiras de caixa (PEF) e o lucro mínimo desejado (PEE).
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
        <span className="text-xs text-muted-foreground">
          Período considerado: <strong className="text-foreground">{analysis.period.label}</strong> — {analysis.period.dreCount} DRE(s)
          {analysis.period.months.length > 0 && analysis.period.months.length <= 6 ? ` (${analysis.period.months.join(' · ')})` : ''}
          <span className="ml-2">Consolidação por <strong className="text-foreground">soma</strong> dos meses — nunca média dos pontos de equilíbrio.</span>
          {analysis.monthlyAverage && (
            <span className="ml-2">
              Referencial mensal (média das DREs): <strong className="text-foreground">{fmtBRL(analysis.monthlyAverage.pee ?? analysis.monthlyAverage.pec)}</strong> / mês — informacional
            </span>
          )}
        </span>
      </div>

      {/* Lucro Mínimo Desejado (PEE) — salvo por empresa */}
      <div className="flex items-center gap-2 flex-wrap bg-card border border-border rounded-xl px-4 py-3">
        <Target className="w-4 h-4 text-primary" />
        <span className="text-xs font-medium text-foreground">Lucro Mínimo Desejado (PEE):</span>
        <div className="relative">
          <input type="number" min="0" step="0.01" value={profitInput} onChange={(e) => setProfitInput(e.target.value)}
            className="w-36 border border-input rounded-lg pl-3 pr-8 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
        </div>
        <button onClick={saveProfit} disabled={savingProfit}
          className="text-xs px-3 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-60">
          {savingProfit ? 'Salvando...' : profitSaved ? 'Salvo ✓' : 'Salvar'}
        </button>
        <span className="text-xs text-muted-foreground">Usado no PEE = (Fixos Operacionais + lucro desejado) ÷ MC% — com 0, PEE = PEC.</span>
      </div>

      {/* Alertas — nunca bloqueiam a análise */}
      {analysis.warnings.length > 0 && (
        <div className={`border rounded-xl p-3 space-y-1 ${analysis.calculationStatus === 'invalid_margin' ? 'bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-700' : 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700'}`}>
          {analysis.warnings.map((msg, i) => (
            <p key={i} className={`text-[11px] flex items-start gap-1.5 ${analysis.calculationStatus === 'invalid_margin' && i === 0 ? 'text-red-800 dark:text-red-300 font-medium' : 'text-amber-800 dark:text-amber-300'}`}>
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> {msg}
            </p>
          ))}
        </div>
      )}

      <BreakEvenCards analysis={analysis} />
      <BreakEvenMarginCards analysis={analysis} />
      <BreakEvenCharts analysis={analysis} />

      <div className="flex justify-center">
        <button onClick={() => setShowComposition(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">
          <Table2 className="w-4 h-4" /> Ver composição
        </button>
      </div>

      {showComposition && (
        <BreakEvenCompositionModal analysis={analysis} onClose={() => setShowComposition(false)} />
      )}
    </section>
  );
}