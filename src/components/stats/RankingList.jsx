// Lista rankeada reutilizável: badge circular numerado + label + valor.
// Sem `limit` mostra todos os itens; com `limit` mostra apenas os N primeiros.
export default function RankingList({ items, icon: Icon, title, render, limit, emptyText }) {
  const shown = limit ? items.slice(0, limit) : items;
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-blue-600" />
        <h4 className="text-[11px] font-semibold text-slate-600">{title}</h4>
      </div>
      {shown.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-3">{emptyText}</p>
      ) : (
        <ol className="space-y-1.5">
          {shown.map((it, i) => (
            <li key={i} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-2 min-w-0">
                <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <span className="text-slate-700 truncate">{it.name || it.label}</span>
              </span>
              <span className="font-semibold text-slate-500 whitespace-nowrap">{render(it)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}