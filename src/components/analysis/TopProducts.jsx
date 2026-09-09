const COLORS = ['#4F46E5', '#6366F1', '#818CF8', '#A5B4FC', '#C7D2FE', '#64748B', '#94A3B8', '#CBD5E1'];

export default function TopProducts({ data, maxItems = 10 }) {
  const top = [...data]
    .filter(p => p.totalQty > 0)
    .sort((a, b) => b.totalQty - a.totalQty)
    .slice(0, maxItems);

  if (top.length === 0) return null;

  const maxQty = top[0].totalQty;

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-foreground">Produtos Mais Produzidos</h2>
        <span className="text-xs text-muted-foreground">Top {top.length} por volume total</span>
      </div>
      <div className="space-y-2.5">
        {top.map((p, i) => {
          const pct = maxQty > 0 ? (p.totalQty / maxQty * 100) : 0;
          return (
            <div key={p.name} className="flex items-center gap-3">
              <span className="text-xs font-bold text-muted-foreground w-6 shrink-0">{i + 1}º</span>
              <span className="text-sm font-medium text-foreground w-36 truncate shrink-0">{p.name}</span>
              <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden">
                <div className="h-full rounded-md transition-all"
                  style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
              </div>
              <span className="text-xs font-bold text-foreground w-28 text-right shrink-0">
                {p.totalQty.toLocaleString('pt-BR')} un
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}