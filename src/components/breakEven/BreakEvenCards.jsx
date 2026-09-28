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

// Três cards lado a lado — conceitos DIFERENTES: industrial (custo de fábrica),
// caixa (desembolso — sem depreciação) e financeiro (caixa + compromissos).
export default function BreakEvenCards({ analysis }) {
  const mc = fmtPct(analysis.contributionMargin.percent);
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <BreakEvenCard
        title="Ponto de Equilíbrio Industrial"
        description="Faturamento para cobrir os custos industriais fixos. Não inclui custos variáveis nem despesas financeiras."
        value={analysis.industrial.breakEvenRevenue}
        units={analysis.industrial.breakEvenUnits}
        rows={[
          ['Custos fixos industriais', fmtBRL(analysis.fixedIndustrialCosts)],
          ['Margem de contribuição', mc],
        ]}
      />
      <BreakEvenCard
        title="Ponto de Equilíbrio de Caixa"
        description="Faturamento para cobrir os desembolsos fixos de caixa. Depreciação e amortização (não caixa) ficam de fora."
        value={analysis.cash.breakEvenRevenue}
        units={analysis.cash.breakEvenUnits}
        rows={[
          ['Custos fixos de caixa', fmtBRL(analysis.fixedCashCosts)],
          ['Margem de contribuição', mc],
        ]}
      />
      <BreakEvenCard
        title="Ponto de Equilíbrio Financeiro"
        description="Caixa + compromissos financeiros pagos (juros, tarifas, parcelas classificados como financeiro caixa)."
        value={analysis.financial.breakEvenRevenue}
        units={analysis.financial.breakEvenUnits}
        rows={[
          ['Custos fixos de caixa', fmtBRL(analysis.financial.fixedCosts)],
          ['Compromissos financeiros', fmtBRL(analysis.financial.financialCashCosts)],
          ['Margem de contribuição', mc],
        ]}
      />
    </div>
  );
}