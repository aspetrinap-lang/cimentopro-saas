import { AlertTriangle, Ban, Database, Factory, Info } from 'lucide-react';
import { fmtBRL, fmtNum } from '@/lib/statsUtils';
import { historyRangeLabel } from '@/lib/pricingProductivity';

// BASE FINANCEIRA DO CÁLCULO — DREs do período financeiro selecionado, sempre
// por MÉDIA PONDERADA (Σ custos ÷ Σ base produtiva). Mostra os indicadores de
// cada mês do período, alertas de comportamento atípico, permite excluir meses
// e declara a base produtiva (histórico completo, independente do período).
export default function FinancialBaseSection({ model, period, onToggleExclude }) {
  if (!model || !model.months || model.months.length === 0) return null;
  const canExclude = period !== 'selected_month' && model.months.length > 1 && !!onToggleExclude;

  return (
    <section className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
          <Database className="w-4 h-4 text-primary" /> Base Financeira do Cálculo
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
            Motor v{model.calculation_version}
          </span>
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
            Período financeiro: {model.periodLabel}
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
            Método: média ponderada (Σ custos ÷ Σ base produtiva)
          </span>
          {model.average && (
            <span className="text-[11px] text-muted-foreground">
              Aplicada: <strong className="text-foreground">{model.average.label}</strong>
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b border-border">
              <th className="text-left py-2 font-medium">DRE</th>
              <th className="text-right py-2 font-medium">Custo Industrial</th>
              <th className="text-right py-2 font-medium">Produção (boas)</th>
              <th className="text-right py-2 font-medium">Peso (kg)</th>
              <th className="text-right py-2 font-medium">Horas</th>
              <th className="text-right py-2 font-medium">R$/kg</th>
              <th className="text-right py-2 font-medium">R$/hora</th>
              {canExclude && <th className="text-center py-2 font-medium">Na média</th>}
            </tr>
          </thead>
          <tbody>
            {model.months.map((m) => (
              <tr key={m.reference_month} className={`border-b border-border/50 ${m.userExcluded ? 'opacity-50' : ''}`}>
                <td className="py-1.5 text-foreground">
                  <div className="flex items-center gap-1.5">
                    {m.anomalous && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                    <span className="font-medium">{m.month_label}</span>
                    {m.energyFromDre && <span className="text-[10px] px-1 rounded bg-muted text-muted-foreground">energia via DRE</span>}
                  </div>
                  {m.anomalous && (
                    <p className="text-[10px] text-amber-600 mt-0.5">DRE com comportamento atípico — {m.anomalyReasons.join('; ')}. Avalie antes de utilizar como referência.</p>
                  )}
                </td>
                <td className="py-1.5 text-right text-muted-foreground">{fmtBRL(m.industrialTotal)}</td>
                <td className="py-1.5 text-right text-foreground">{fmtNum(m.goodUnits, 0)}</td>
                <td className="py-1.5 text-right text-muted-foreground">{fmtNum(m.weightKg, 0)}</td>
                <td className="py-1.5 text-right text-muted-foreground">{fmtNum(m.hours, 1)}</td>
                <td className="py-1.5 text-right text-muted-foreground">{fmtNum(m.costPerKg, 4)}</td>
                <td className="py-1.5 text-right text-muted-foreground">{fmtNum(m.costPerHour, 2)}</td>
                {canExclude && (
                  <td className="py-1.5 text-center">
                    <button
                      onClick={() => onToggleExclude(m.reference_month)}
                      className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${m.userExcluded
                        ? 'border-border text-muted-foreground hover:bg-muted'
                        : 'bg-primary/10 text-primary border-transparent hover:bg-primary/20'}`}
                    >
                      {m.userExcluded ? 'Incluir' : 'Não usar'}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {model.average && (
            <tfoot>
              <tr className="font-semibold border-t-2 border-border bg-primary/5">
                <td className="py-2 text-foreground">
                  <span className="flex items-center gap-1.5"><Info className="w-3.5 h-3.5 text-primary" /> MÉDIA PONDERADA UTILIZADA</span>
                </td>
                <td className="py-2 text-right text-foreground">{fmtBRL(model.average.industrialTotal)}</td>
                <td className="py-2 text-right text-foreground">Σ</td>
                <td className="py-2 text-right text-foreground">Σ</td>
                <td className="py-2 text-right text-foreground">Σ</td>
                <td className="py-2 text-right text-foreground">{fmtNum(model.average.costPerKg, 4)}</td>
                <td className="py-2 text-right text-foreground">{fmtNum(model.average.costPerHour, 2)}</td>
                {canExclude && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
        <Factory className="w-3 h-3 mt-0.5 shrink-0" />
        <span>
          Base produtiva: histórico completo de ordens concluídas
          {model.productivity?.from ? ` (${historyRangeLabel(model.productivity.from, model.productivity.to)})` : ''}
          — independente do período financeiro. A fonte usada por artefato (histórico próprio ou fallback) aparece na Composição de Custos.
        </span>
      </p>

      {(model.warnings?.length > 0 || model.unclassified?.length > 0) && (
        <div className="space-y-1">
          {model.warnings.map((w, i) => (
            <p key={`w${i}`} className="text-[11px] text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
              <Ban className="w-3 h-3 mt-0.5 shrink-0" />
              <span><strong>{w.account_name}</strong> ({w.month_label}): este componente da DRE já está representado no cálculo operacional e não foi somado novamente.</span>
            </p>
          ))}
          {model.unclassified?.length > 0 && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
              <Ban className="w-3 h-3 mt-0.5 shrink-0" />
              <span>{model.unclassified.length} lançamento(s) em contas sem classificação de custeio — excluídos do custo do produto. Classifique na Estrutura da DRE.</span>
            </p>
          )}
        </div>
      )}
    </section>
  );
}