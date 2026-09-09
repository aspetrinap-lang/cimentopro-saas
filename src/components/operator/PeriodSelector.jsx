import { format, subDays } from 'date-fns';
import { CalendarRange } from 'lucide-react';

function fmt(d) {
  return format(d, 'yyyy-MM-dd');
}

// Seletor compacto de período: atalhos rápidos + datas inicial/final livres
export default function PeriodSelector({ start, end, onChange }) {
  const today = fmt(new Date());
  const isShortcut = (days) =>
    days === 1
      ? start === today && end === today
      : start === fmt(subDays(new Date(), days - 1)) && end === today;

  function applyShortcut(days) {
    onChange(days === 1 ? today : fmt(subDays(new Date(), days - 1)), today);
  }

  const btn = (active) =>
    `text-xs px-3 py-1.5 rounded-lg border transition-colors ${
      active ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-foreground hover:bg-muted'
    }`;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <CalendarRange className="w-4 h-4 text-muted-foreground" />
      <button className={btn(isShortcut(1))} onClick={() => applyShortcut(1)}>Hoje</button>
      <button className={btn(isShortcut(7))} onClick={() => applyShortcut(7)}>7 dias</button>
      <button className={btn(isShortcut(30))} onClick={() => applyShortcut(30)}>30 dias</button>
      <div className="flex items-center gap-1.5 ml-1">
        <input
          type="date"
          value={start}
          max={end}
          onChange={(e) => e.target.value && onChange(e.target.value, end)}
          className="border border-input rounded-lg px-2.5 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <span className="text-xs text-muted-foreground">até</span>
        <input
          type="date"
          value={end}
          min={start}
          onChange={(e) => e.target.value && onChange(start, e.target.value)}
          className="border border-input rounded-lg px-2.5 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
    </div>
  );
}