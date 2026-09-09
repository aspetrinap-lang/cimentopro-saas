export default function MoldLifecycleBar({ cyclesUsed = 0, maxCycles }) {
  if (!maxCycles) return null;
  const pct = Math.min((cyclesUsed / maxCycles) * 100, 100);
  const remaining = Math.max(maxCycles - cyclesUsed, 0);

  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-green-500';
  const textColor = pct >= 90 ? 'text-red-600' : pct >= 70 ? 'text-amber-600' : 'text-green-600';
  const label = pct >= 90 ? 'Crítico' : pct >= 70 ? 'Atenção' : 'Normal';

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className={`font-semibold ${textColor}`}>{label} — {pct.toFixed(1)}%</span>
        <span className="text-muted-foreground">{remaining.toLocaleString('pt-BR')} ciclos restantes</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{cyclesUsed.toLocaleString('pt-BR')} usados</span>
        <span>{maxCycles.toLocaleString('pt-BR')} total</span>
      </div>
    </div>
  );
}