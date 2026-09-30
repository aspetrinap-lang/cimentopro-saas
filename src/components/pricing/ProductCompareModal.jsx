// Modal do comparativo: um card por produto selecionado, com a composição do
// custo (mesmos componentes do detalhamento "Composição do Custo"), custo para
// venda, preço sugerido/atual e margem — destacando o produto mais viável.
import { X, ArrowLeftRight } from 'lucide-react';
import { fmtBRL, fmtNum } from '@/lib/statsUtils';
import { INDUSTRIAL_COMPONENTS, COMPONENT_LABELS, calculateSellingCost } from '@/lib/industrialCostEngine';

function CompareCard({ data, isBest }) {
  const { pt, product: p, row, sell, current, marginPct } = data;
  const goodRatio = p.goodRatio ?? 1;
  const components = INDUSTRIAL_COMPONENTS
    .filter((key) => (p.components[key] || 0) > 0)
    .map((key) => ({ key, label: COMPONENT_LABELS[key], value: (p.components[key] || 0) * goodRatio, estimated: p.componentEstimated?.[key] }));

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${isBest ? 'border-green-400 bg-green-50/60 dark:bg-green-950/20 ring-1 ring-green-300' : 'border-border bg-card'}`}>
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-bold text-foreground leading-snug">{pt.name}</h3>
          {isBest && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 font-semibold shrink-0">Mais viável</span>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {fmtNum(p.good, 0)} peças boas ({fmtNum(p.refugo, 0)} refugo) • {fmtNum(p.weightKg, 2)} kg/un
        </p>
      </div>

      <div className="space-y-1">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Custo Industrial (por {p.saleUnit})</p>
        {components.map((r) => (
          <div key={r.key} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{r.label}{r.estimated && <span className="text-[10px] text-amber-600 ml-1">est.</span>}</span>
            <span className="text-foreground font-medium">{fmtBRL(r.value)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Perdas / Refugo</span>
          <span className="text-amber-600 font-medium">{fmtBRL(p.lossBurden || 0)}</span>
        </div>
        <div className="flex items-center justify-between text-sm font-bold border-t border-border pt-1.5">
          <span className="text-foreground">Custo Industrial</span>
          <span className="text-foreground">{fmtBRL(p.industrialPerUnit)}</span>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Custo para Venda</p>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Frete + Outros</span>
          <span className="text-foreground font-medium">{fmtBRL((sell.freight || 0) + (sell.other || 0))}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Comissão + Impostos</span>
          <span className="text-foreground font-medium">{fmtBRL(sell.commissionValue + sell.taxValue)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-foreground font-semibold">Custo p/ Venda</span>
          <span className="text-foreground font-semibold">{fmtBRL(sell.sellingCost)}</span>
        </div>
      </div>

      <div className={`rounded-lg p-2.5 ${isBest ? 'bg-green-100/70 dark:bg-green-900/30' : 'bg-amber-400/90'}`}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className={`text-[10px] font-semibold uppercase tracking-wide ${isBest ? 'text-green-800 dark:text-green-300' : 'text-amber-900/80'}`}>Preço Sugerido</p>
            <p className={`text-[10px] ${isBest ? 'text-green-700 dark:text-green-400' : 'text-amber-900/70'}`}>margem {Number(row.margin) || 0}%</p>
          </div>
          {sell.invalid ? (
            <p className="text-xs font-bold text-red-800 text-right max-w-[10rem]">{sell.message}</p>
          ) : (
            <p className={`text-xl font-bold ${isBest ? 'text-green-900 dark:text-green-200' : 'text-amber-950'}`}>{fmtBRL(sell.price)}</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs border-t border-border pt-2">
        <span className="text-muted-foreground">Preço Atual</span>
        <span className="text-foreground font-semibold">{current ? fmtBRL(current) : '—'}</span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Margem real (preço atual)</span>
        {marginPct == null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className={`font-bold ${marginPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>{marginPct >= 0 ? '' : ''}{fmtNum(marginPct, 1)}%</span>
        )}
      </div>
    </div>
  );
}

export default function ProductCompareModal({ items, rowFor, bestId, onClose }) {
  const withSell = items
    .map(({ pt, product }) => {
      const row = rowFor(pt);
      const sell = calculateSellingCost(product.industrialPerUnit, row);
      const current = Number(pt.selling_price) || 0;
      const marginPct = current > 0 ? ((current - sell.sellingCost) / current) * 100 : null;
      return { pt, product, row, sell, current, marginPct };
    });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-4 overflow-y-auto" onClick={onClose}>
      <div className="max-w-6xl mx-auto bg-card rounded-2xl border border-border shadow-2xl my-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card rounded-t-2xl z-10">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-primary" />
            <div>
              <h2 className="font-semibold text-foreground">Comparativo de Produtos</h2>
              <p className="text-xs text-muted-foreground">{withSell.length} produtos • destaque no mais viável (maior margem %, empate: menor custo industrial)</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {withSell.map((d) => (
            <CompareCard key={d.pt.id} data={d} isBest={d.pt.id === bestId} />
          ))}
        </div>
      </div>
    </div>
  );
}