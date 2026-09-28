// Lista rankeada reutilizável: badge circular numerado + label + valor.
// Sem `limit` mostra todos os itens; com `limit` mostra apenas os N primeiros.
export default function RankingList({ items, icon: Icon, title, render, limit, emptyText }) {
  const shown = limit ? items.slice(0, limit) : items;
  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-primary" />
        <h4 className="text-xs font-semibold text-foreground">{title}</h4>
      </div>
      {shown.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">{emptyText}</p>
      ) : (
        <ol className="space-y-1.5">
          {shown.map((it, i) => (
            <li key={i} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-2 min-w-0">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <span className="text-foreground truncate">{it.name || it.label}</span>
              </span>
              <span className="font-semibold text-muted-foreground whitespace-nowrap">{render(it)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}