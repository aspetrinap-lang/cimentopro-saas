import { X, AlertTriangle } from 'lucide-react';
import { fmtBRL, fmtNum } from '@/lib/statsUtils';
import { BREAK_EVEN_LABELS, CASH_EFFECT_LABELS, PARTICIPATES_LABELS } from '@/lib/breakEvenEngine';

// Auditoria do Ponto de Equilíbrio: composição por conta da DRE (classificação,
// efeito caixa, valor e participação) + mix de produtos + warnings.
export default function BreakEvenCompositionModal({ analysis, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card w-full max-w-4xl rounded-2xl shadow-2xl border border-border overflow-y-auto max-h-[94vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h3 className="font-semibold text-foreground">Composição do Ponto de Equilíbrio</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Período: {analysis.period.label} — {analysis.period.dreCount} DRE(s)
              {analysis.period.months.length ? ` (${analysis.period.months.join(' · ')})` : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* Contas da DRE do período — origem de cada valor */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-2 font-medium">Conta</th>
                  <th className="text-left py-2 font-medium pl-3">Classificação PE</th>
                  <th className="text-left py-2 font-medium pl-3">Efeito Caixa</th>
                  <th className="text-right py-2 font-medium">Valor</th>
                  <th className="text-center py-2 font-medium pl-3">Participa do PE</th>
                </tr>
              </thead>
              <tbody>
                {analysis.composition.map((row, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-1.5 text-foreground">{row.account_name}</td>
                    <td className="py-1.5 pl-3">
                      {row.configured
                        ? BREAK_EVEN_LABELS[row.classification]
                        : <span className="text-amber-600 dark:text-amber-400">Sem classificação</span>}
                    </td>
                    <td className="py-1.5 pl-3 text-muted-foreground">{CASH_EFFECT_LABELS[row.cashEffect]}</td>
                    <td className="py-1.5 text-right font-medium text-foreground">{fmtBRL(row.value)}</td>
                    <td className="py-1.5 text-center pl-3 text-muted-foreground">{PARTICIPATES_LABELS[row.classification]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {analysis.composition.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum lançamento da DRE no período selecionado.</p>
            )}
          </div>

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