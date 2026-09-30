import { X, AlertTriangle } from 'lucide-react';
import { fmtBRL, fmtNum } from '@/lib/statsUtils';
import {
  BREAK_EVEN_LABELS, CASH_EFFECT_LABELS, PARTICIPATES_LABELS,
  BLOCK_LABELS, BLOCK_ORDER, ROLE_LABELS,
} from '@/lib/breakEvenEngine';

// Auditoria do Ponto de Equilíbrio v1.1: composição por BLOCOS gerenciais
// (Deduções, Variáveis, Fábrica, Pessoal, Estrutura, Obrigações Financeiras,
// Investimentos) + reconciliação até PEC/PEF/PEE + mix de produtos + warnings.
export default function BreakEvenCompositionModal({ analysis, onClose }) {
  const blocks = BLOCK_ORDER
    .map((block) => ({
      block,
      label: BLOCK_LABELS[block],
      rows: analysis.composition.filter((r) => r.block === block),
    }))
    .filter((g) => g.rows.length > 0);

  const blockTotal = (g) => g.rows.reduce((s, r) => s + r.value, 0);
  const cm = analysis.contributionMargin;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card w-full max-w-4xl rounded-2xl shadow-2xl border border-border overflow-y-auto max-h-[94vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h3 className="font-semibold text-foreground">Composição do Ponto de Equilíbrio</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Período: {analysis.period.label} — {analysis.period.dreCount} DRE(s)
              {analysis.period.months.length ? ` (${analysis.period.months.join(' · ')})` : ''} · consolidação por soma
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* Reconciliação até PEC / PEF / PEE */}
          <div className="border border-border rounded-xl p-4 bg-muted/20 space-y-1 text-xs">
            <p className="font-semibold text-foreground mb-2">Cadeia do cálculo</p>
            {[
              ['Faturamento Bruto', analysis.revenue.gross],
              ['− Deduções da Receita', analysis.revenue.deductions],
              ['= Receita Líquida', analysis.revenue.net],
              ['− Custos Variáveis Puros', analysis.variableCosts.total],
              ['= Margem de Contribuição', cm.value],
            ].map(([label, v]) => (
              <div key={label} className={`flex justify-between ${label.startsWith('=') ? 'font-semibold border-t border-border pt-1 mt-1' : ''}`}>
                <span className="text-muted-foreground">{label}</span>
                <span className="text-foreground">{fmtBRL(v)}</span>
              </div>
            ))}
            <div className="flex justify-between font-semibold">
              <span className="text-muted-foreground">MC% (÷ Faturamento Bruto)</span>
              <span className="text-foreground">{cm.percent != null ? `${fmtNum(cm.percent * 100, 2)}%` : '—'}</span>
            </div>
            <div className="border-t border-border pt-2 mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="bg-card border border-border rounded-lg p-2">
                <p className="text-[10px] text-muted-foreground">PEC = Fixos ÷ MC%</p>
                <p className="font-bold text-foreground text-sm">{analysis.pec.breakEvenRevenue != null ? fmtBRL(analysis.pec.breakEvenRevenue) : 'Não calculável'}</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-2">
                <p className="text-[10px] text-muted-foreground">PEF = (Fixos + Financeiro) ÷ MC%</p>
                <p className="font-bold text-foreground text-sm">{analysis.pef.breakEvenRevenue != null ? fmtBRL(analysis.pef.breakEvenRevenue) : 'Não calculável'}</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-2">
                <p className="text-[10px] text-muted-foreground">PEE = (Fixos + Lucro desejado) ÷ MC%</p>
                <p className="font-bold text-foreground text-sm">{analysis.pee.breakEvenRevenue != null ? fmtBRL(analysis.pee.breakEvenRevenue) : 'Não calculável'}</p>
              </div>
            </div>
            {analysis.investments > 0 && (
              <p className="text-[11px] text-muted-foreground pt-2">
                Investimentos de <strong className="text-foreground">{fmtBRL(analysis.investments)}</strong> não são incorporados
                ao PEF operacional — necessidade adicional de caixa por investimentos no período.
              </p>
            )}
          </div>

          {/* Composição por blocos gerenciais */}
          {blocks.length > 0 ? (
            <div className="space-y-4">
              {blocks.map((g) => (
                <div key={g.block} className="border border-border rounded-xl overflow-hidden">
                  <div className="bg-muted/40 px-4 py-2 flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground">{g.label}</p>
                    <p className="text-xs font-bold text-foreground">{fmtBRL(blockTotal(g))}</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <tbody>
                        {g.rows.map((row, i) => (
                          <tr key={i} className="border-b border-border/40 last:border-0">
                            <td className="py-1.5 pl-4 text-foreground">{row.account_name}</td>
                            <td className="py-1.5 pl-3 text-muted-foreground">
                              {row.configured
                                ? BREAK_EVEN_LABELS[row.classification]
                                : <span className="text-amber-600 dark:text-amber-400">Sem classificação</span>}
                            </td>
                            {row.financialRole && (
                              <td className="py-1.5 pl-3 text-muted-foreground">{ROLE_LABELS[row.financialRole] || row.financialRole}</td>
                            )}
                            <td className="py-1.5 pl-3 text-muted-foreground">{CASH_EFFECT_LABELS[row.cashEffect]}</td>
                            <td className="py-1.5 pl-3 text-muted-foreground">{PARTICIPATES_LABELS[row.classification] || '—'}</td>
                            <td className="py-1.5 pr-4 text-right font-medium text-foreground">{fmtBRL(row.value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhum lançamento da DRE no período selecionado.</p>
          )}

          {/* Mix de produtos */}
          {analysis.mix.products.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-foreground mb-1">Mix de Produtos</p>
              <p className="text-[11px] text-muted-foreground mb-2">
                {analysis.mix.source === 'sales'
                  ? 'Mix de vendas por produto.'
                  : 'Mix de vendas não disponível — o mix de produção (quantidade boa) foi utilizado como aproximação.'}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border">
                      <th className="text-left py-2 font-medium">Produto</th>
                      <th className="text-right py-2 font-medium">Qtde (mix)</th>
                      <th className="text-right py-2 font-medium">Participação</th>
                      <th className="text-right py-2 font-medium">Preço</th>
                      <th className="text-right py-2 font-medium">Custo Var./Un</th>
                      <th className="text-right py-2 font-medium">MC/Un</th>
                      <th className="text-right py-2 font-medium">MC%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.mix.products.map((p) => (
                      <tr key={p.id} className="border-b border-border/50">
                        <td className="py-1.5 text-foreground">{p.name} <span className="text-muted-foreground">({p.unit})</span></td>
                        <td className="py-1.5 text-right text-muted-foreground">{fmtNum(p.qty, 0)}</td>
                        <td className="py-1.5 text-right text-muted-foreground">{fmtNum(p.share * 100, 1)}%</td>
                        <td className="py-1.5 text-right text-muted-foreground">{p.price > 0 ? fmtBRL(p.price) : '—'}</td>
                        <td className="py-1.5 text-right text-muted-foreground">{fmtBRL(p.variableUnit)}</td>
                        <td className={`py-1.5 text-right font-medium ${p.contributionUnit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmtBRL(p.contributionUnit)}</td>
                        <td className={`py-1.5 text-right font-medium ${p.contributionUnit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {p.contributionPercent != null ? `${fmtNum(p.contributionPercent * 100, 1)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Custo Variável/Un = matéria-prima + molde + energia (operacionais do motor v{analysis.costingEngineVersion}) + contas variáveis da DRE
                rateadas pelas mesmas bases (kg/horas/unidades) — sem dupla contagem. MC ponderada do mix: {' '}
                <strong className="text-foreground">
                  {analysis.mix.weightedContributionMarginPercent != null ? `${fmtNum(analysis.mix.weightedContributionMarginPercent * 100, 2)}%` : '—'}
                </strong>.
              </p>
            </div>
          )}

          {/* Warnings de classificação */}
          {analysis.warnings.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-xl p-3 space-y-1">
              {analysis.warnings.map((msg, i) => (
                <p key={i} className="text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> {msg}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}