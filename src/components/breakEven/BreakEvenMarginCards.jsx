import { fmtBRL, fmtNum } from '@/lib/statsUtils';

function WaterfallRow({ label, value, emphasis = false, tone = 'text-foreground', signed = false }) {
  return (
    <div className={`flex justify-between gap-2 text-xs ${emphasis ? 'border-t border-border pt-1.5 mt-1.5' : ''}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={`${emphasis ? 'font-bold' : 'font-medium'} ${tone}`}>{signed && value != null ? fmtBRL(-value) : fmtBRL(value)}</span>
    </div>
  );
}

// Demonstração da Margem de Contribuição (Faturamento Bruto − Deduções −
// Variáveis = MC, com MC% sobre o Faturamento Bruto) e da Margem de
// Segurança (base: PEC, negativa preservada).
export default function BreakEvenMarginCards({ analysis }) {
  const cm = analysis.contributionMargin;
  const sm = analysis.safetyMargin;
  const cmPct = cm.percent == null ? '—' : `${fmtNum(cm.percent * 100, 2)}%`;
  const smPct = sm.percent == null ? 'Não calculável' : `${fmtNum(sm.percent, 2)}%`;
  const smTone = sm.value == null ? 'text-muted-foreground' : sm.value >= 0 ? 'text-green-600' : 'text-red-600';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-xs font-semibold text-foreground">Margem de Contribuição</p>
        <div className="flex items-baseline gap-2 mt-2">
          <p className={`text-2xl font-bold ${cm.value != null && cm.value < 0 ? 'text-red-600' : 'text-foreground'}`}>
            {analysis.revenue.gross > 0 ? fmtBRL(cm.value) : '—'}
          </p>
          <span className="text-sm font-semibold text-muted-foreground">{cmPct}</span>
        </div>
        <div className="mt-3 space-y-1">
          <WaterfallRow label="Faturamento Bruto" value={analysis.revenue.gross} />
          <WaterfallRow label="− Deduções da Receita" value={analysis.revenue.deductions} tone="text-red-600" signed />
          <WaterfallRow label="= Receita Líquida" value={analysis.revenue.net} />
          <WaterfallRow label="− Custos Variáveis Puros" value={analysis.variableCosts.total} tone="text-red-600" signed />
          <WaterfallRow label="= Margem de contribuição" value={cm.value} emphasis />
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          MC% = MC ÷ <strong>Faturamento Bruto</strong> — as deduções já foram retiradas da receita antes da margem
          (sem dupla contagem). Composição por conta em <strong>Ver composição</strong>.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-xs font-semibold text-foreground">Margem de Segurança</p>
        <div className="mt-2 space-y-1.5 text-xs">
          <div className="flex justify-between"><span className="text-muted-foreground">Faturamento atual</span><span className="font-medium text-foreground">{fmtBRL(sm.revenue)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">PEC (referência)</span><span className="font-medium text-foreground">{sm.breakEven != null ? fmtBRL(sm.breakEven) : 'Não calculável'}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Distância até o equilíbrio</span><span className={`font-medium ${smTone}`}>{sm.value != null ? fmtBRL(sm.value) : '—'}</span></div>
        </div>
        <div className="mt-3 border-t border-border pt-2 flex items-baseline justify-between">
          <span className="text-xs text-muted-foreground">Margem de segurança</span>
          <span className={`text-xl font-bold ${smTone}`}>{smPct}</span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          (Faturamento atual − PEC) ÷ Faturamento atual — o valor negativo é preservado quando o faturamento está abaixo do PEC.
        </p>
      </div>
    </div>
  );
}