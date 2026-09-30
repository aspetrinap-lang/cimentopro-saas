import { fmtBRL, fmtNum } from '@/lib/statsUtils';

function fmtPct(fraction) {
  return fraction == null ? '—' : `${fmtNum(fraction * 100, 2)}%`;
}

function BreakEvenCard({ title, description, value, units, rows }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-xs font-semibold text-foreground">{title}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5 min-h-[2.4em]">{description}</p>
      <p className={`text-2xl font-bold mt-2 ${value != null ? 'text-foreground' : 'text-muted-foreground text-base font-medium'}`}>
        {value != null ? fmtBRL(value) : 'Não calculável'}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">
        {units != null ? `${fmtNum(units, 0)} unidades equivalentes (mix)` : 'Unidades: não calculáveis'}
      </p>
      <div className="mt-3 space-y-1 text-xs border-t border-border pt-2">
        {rows.map(([label, v]) => (
          <div key={label} className="flex justify-between gap-2">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium text-foreground text-right">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Três indicadores do motor v1.1 — PEC (contábil), PEF (financeiro de caixa)
// e PEE (econômico, com lucro mínimo desejado).
export default function BreakEvenCards({ analysis }) {
  const mc = fmtPct(analysis.contributionMargin.percent);
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <BreakEvenCard
        title="PEC — Ponto de Equilíbrio Contábil"
        description="Faturamento para cobrir os Gastos Fixos Operacionais (fábrica, pessoal e estrutura). Não inclui juros, IOF, amortizações ou investimentos."
        value={analysis.pec.breakEvenRevenue}
        units={analysis.pec.breakEvenUnits}
        rows={[
          ['Gastos Fixos Operacionais', fmtBRL(analysis.fixedOperationalCosts)],
          ['Margem de contribuição', mc],
        ]}
      />
      <BreakEvenCard
        title="PEF — Ponto de Equilíbrio Financeiro"
        description="PEC + Obrigações Não Operacionais de Caixa (juros, IOF e amortizações). Investimentos ficam fora do PEF operacional."
        value={analysis.pef.breakEvenRevenue}
        units={analysis.pef.breakEvenUnits}
        rows={[
          ['Gastos Fixos Operacionais', fmtBRL(analysis.fixedOperationalCosts)],
          ['Obrigações financeiras de caixa', fmtBRL(analysis.financialCashCosts)],
          ['Margem de contribuição', mc],
        ]}
      />
      <BreakEvenCard
        title="PEE — Ponto de Equilíbrio Econômico"
        description="Gastos Fixos Operacionais + Lucro Mínimo Desejado configurado nesta tela. Com lucro desejado 0, PEE = PEC."
        value={analysis.pee.breakEvenRevenue}
        units={analysis.pee.breakEvenUnits}
        rows={[
          ['Gastos Fixos Operacionais', fmtBRL(analysis.fixedOperationalCosts)],
          ['Lucro mínimo desejado', fmtBRL(analysis.pee.desiredProfit || 0)],
          ['Margem de contribuição', mc],
        ]}
      />
    </div>
  );
}