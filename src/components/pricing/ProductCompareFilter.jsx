// Filtro de comparativo entre produtos — seleção múltipla sobre a tabela do Simulador de Preços.
import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Filter, Check, X, ChevronDown, ArrowLeftRight } from 'lucide-react';

export default function ProductCompareFilter({ products, selected, onChange, onCompare }) {
  const [open, setOpen] = useState(false);

  function toggle(id) {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-muted-foreground">Comparativo:</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="text-xs px-3 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted transition-colors flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" />
            {selected.length > 0 ? `${selected.length} produto(s) selecionado(s)` : 'Selecionar produtos'}
            <ChevronDown className="w-3 h-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-1">
          <div className="max-h-64 overflow-y-auto">
            {products.map((p) => (
              <button key={p.id} onClick={() => toggle(p.id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md hover:bg-muted text-left transition-colors">
                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${selected.includes(p.id) ? 'bg-primary border-primary' : 'border-input'}`}>
                  {selected.includes(p.id) && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                </span>
                <span className="truncate text-foreground">{p.name}</span>
              </button>
            ))}
            {products.length === 0 && <p className="px-2 py-3 text-xs text-muted-foreground">Nenhum produto disponível.</p>}
          </div>
        </PopoverContent>
      </Popover>
      {selected.length >= 2 && onCompare && (
        <button onClick={onCompare}
          className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-medium flex items-center gap-1.5 transition-colors">
          <ArrowLeftRight className="w-3.5 h-3.5" /> Comparar
        </button>
      )}
      {selected.length > 0 && (
        <button onClick={() => onChange([])}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
          <X className="w-3 h-3" /> Limpar
        </button>
      )}
      {selected.length >= 2 && (
        <span className="text-[10px] text-muted-foreground">Destaca o produto mais viável (maior margem %).</span>
      )}
    </div>
  );
}