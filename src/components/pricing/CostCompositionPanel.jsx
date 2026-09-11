import { X, AlertTriangle, Layers, TrendingUp, Coins } from 'lucide-react';
import { fmtBRL, fmtNum } from '@/lib/statsUtils';
import { INDUSTRIAL_COMPONENTS, COMPONENT_LABELS, calculateSellingCost } from '@/lib/industrialCostEngine';

// COMPOSIÇÃO DO CUSTO — demonstrativo auditável de um produto: cada componente
// industrial com sua origem, o ônus do refugo, custos comerciais e o preço
// sugerido. Soma SEM duplicidade: componentes por peça bruta + perdas = custo
// industrial por peça boa.
export default function CostCompositionPanel({ product, row, onClose }) {
  const p = product;
  const sell = calculateSellingCost(p.industrialPerUnit, row);
  const goodRatio = p.goodRatio ?? 1;

  const componentRows = INDUSTRIAL_COMPONENTS
    .filter((key) => (p.components[key] || 0) > 0 || key === 'material_direct' || key === 'mold' || key === 'energy')
    .map((key) => ({
      key,
      label: COMPONENT_LABELS[key],
      // valor exibido por peça bruta (proporcional); o ônus do refugo fica na linha Perdas
      value: (p.components[key] || 0) * goodRatio,
      source: p.sources[key] || '—',
      estimated: p.componentEstimated?.[key],
    }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border overflow-y-auto max-h-[94vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h2 className="font-semibold text-foreground">Composição do Custo — {p.pt.name}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {fmtNum(p.good, 0)} peças boas consideradas ({fmtNum(p.gross, 0)} produzidas − {fmtNum(p.refugo, 0)} refugo) • {fmtNum(p.hours, 1)} h • peso/un: {fmtNum(p.weightKg, 2)} kg
              {p.monthsWithProduction < 3 && p.monthsWithProduction > 0 ? ` • produzido em ${p.monthsWithProduction} DRE(s)` : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          {p.weightEstimated && (
            <div className="text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 rounded-lg p-2 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Peso estimado (cadastro sem peso real) — atualize o Peso por Unidade no cadastro do produto.
            </div>
          )}
          {p.alerts?.map((a, i) => (
            <div key={i} className="text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 rounded-lg p-2 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {a}
            </div>
          ))}

          {/* Custo industrial */}
          <section>
            <h3 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-2"><Layers className="w-4 h-4 text-primary" /> Custo Industrial (por {p.saleUnit})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="text-left py-2 font-medium">Componente</th>
                    <th className="text-right py-2 font-medium">R$ / {p.saleUnit}</th>
                    <th className="text-left py-2 font-medium pl-3">Origem do valor</th>
                  </tr>
                </thead>
                <tbody>
                  {componentRows.map((r) => (
                    <tr key={r.key} className="border-b border-border/50">
                      <td className="py-1.5 text-foreground">
                        {r.label}
                        {r.estimated && <span className="text-[10px] text-amber-600 ml-1">estimado</span>}
                      </td>
                      <td className="py-1.5 text-right font-medium text-foreground">{fmtBRL(r.value)}</td>
                      <td className="py-1.5 pl-3 text-muted-foreground text-[11px]">{r.source}</td>
                    </tr>
                  ))}
                  <tr className="border-b border-border/50">
                    <td className="py-1.5 text-foreground">Perdas / Refugo</td>
                    <td className="py-1.5 text-right font-medium text-amber-600">{fmtBRL(p.lossBurden || 0)}</td>
                    <td className="py-1.5 pl-3 text-muted-foreground text-[11px]">Custo absorvido pela produção boa ({fmtNum(p.refugo, 0)} peças de refugo no período)</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="font-semibold border-t-2 border-border">
                    <td className="py-2 text-foreground">CUSTO INDUSTRIAL</td>
                    <td className="py-2 text-right text-foreground">{fmtBRL(p.industrialPerUnit)}</td>
                    <td className="py-2 pl-3 text-muted-foreground text-[11px]">por peça boa vendável</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          {/* Custo para venda */}
          <section>
            <h3 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-2"><Coins className="w-4 h-4 text-primary" /> Custo para Venda</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-muted/40 rounded-lg p-2 border border-border"><p className="text-muted-foreground text-[10px]">Frete + Outros</p><p className="font-semibold text-foreground">{fmtBRL((sell.freight || 0) + (sell.other || 0))}</p></div>
              <div className="bg-muted/40 rounded-lg p-2 border border-border"><p className="text-muted-foreground text-[10px]">Comissão</p><p className="font-semibold text-foreground">{fmtBRL(sell.commissionValue)}</p></div>
              <div className="bg-muted/40 rounded-lg p-2 border border-border"><p className="text-muted-foreground text-[10px]">Impostos</p><p className="font-semibold text-foreground">{fmtBRL(sell.taxValue)}</p></div>
              <div className="bg-primary/10 rounded-lg p-2 border border-border"><p className="text-primary text-[10px]">Custo p/ Venda</p><p className="font-semibold text-foreground">{fmtBRL(sell.sellingCost)}</p></div>
            </div>
          </section>

          {/* Preço sugerido */}
          <section className="bg-amber-400 rounded-2xl p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-xs font-semibold text-amber-900/80 uppercase tracking-wide flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4" /> Preço Sugerido ({Number(row.margin) || 0}% margem)
                </p>
                <p className="text-[11px] text-amber-900/70 mt-0.5">Lucro estimado: {fmtBRL(sell.marginValue)} por {p.saleUnit}</p>
              </div>
              {sell.invalid ? (
                <p className="text-sm font-bold text-red-800 max-w-[16rem] text-right">{sell.message}</p>
              ) : (
                <p className="text-2xl md:text-3xl font-bold text-amber-950">{fmtBRL(sell.price)}</p>
              )}
            </div>
          </section>

          <p className="text-[11px] text-muted-foreground">
            Componentes proporcionais à peça bruta; o ônus do refugo (peças produzidas e não vendíveis) é absorvido pela produção boa na linha "Perdas/Refugo".
            Comerciais, financeiras e impostos da DRE nunca entram no custo industrial.
          </p>
        </div>
      </div>
    </div>
  );
}