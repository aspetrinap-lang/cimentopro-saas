import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, CheckSquare, Square } from 'lucide-react';

export default function ProductMultiSelect({ products, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  function toggle(id) {
    if (selected.includes(id)) {
      onChange(selected.filter(s => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  function toggleAll() {
    if (selected.length === filtered.length && filtered.length > 0) {
      onChange([]);
    } else {
      onChange(filtered.map(p => p.id));
    }
  }

  const label = selected.length === 0
    ? 'Todos os artefatos'
    : selected.length === 1
      ? products.find(p => p.id === selected[0])?.name || '1 selecionado'
      : `${selected.length} artefatos selecionados`;

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring min-w-[200px]">
        <span className="truncate">{label}</span>
        <ChevronDown className="w-3.5 h-3.5 ml-auto text-muted-foreground shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-72 bg-card border border-border rounded-lg shadow-xl max-h-80 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                className="w-full border border-input rounded-md pl-7 pr-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Buscar artefato..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <div className="p-1 border-b border-border">
            <button onClick={toggleAll}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted rounded-md transition-colors">
              {selected.length === filtered.length && selected.length > 0
                ? <CheckSquare className="w-3.5 h-3.5" />
                : <Square className="w-3.5 h-3.5" />}
              {selected.length === filtered.length && selected.length > 0 ? 'Desmarcar todos' : 'Selecionar todos'}
            </button>
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-xs text-muted-foreground text-center">Nenhum artefato encontrado.</p>
            ) : filtered.map(p => (
              <label key={p.id} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/50 cursor-pointer transition-colors">
                <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} className="rounded" />
                <span className="truncate">{p.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}