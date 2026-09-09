import { iecStatus } from '@/lib/statsUtils';

const IEC_STROKE_COLORS = {
  null: '#94a3b8',
  excellent: '#16a34a',
  stable: '#22c55e',
  warning: '#f59e0b',
  unstable: '#f97316',
  critical: '#dc2626',
};

function strokeColorFor(score) {
  if (score == null) return IEC_STROKE_COLORS.null;
  if (score >= 95) return IEC_STROKE_COLORS.excellent;
  if (score >= 90) return IEC_STROKE_COLORS.stable;
  if (score >= 80) return IEC_STROKE_COLORS.warning;
  if (score >= 70) return IEC_STROKE_COLORS.unstable;
  return IEC_STROKE_COLORS.critical;
}

export default function IECCard({ score, avgCV }) {
  const st = iecStatus(score);
  const pct = score != null ? Math.min(100, Math.max(0, score)) : 0;
  const circumference = 2 * Math.PI * 52;
  const offset = circumference - (pct / 100) * circumference;
  const strokeColor = strokeColorFor(score);

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex items-center gap-6 flex-wrap">
      <div className="relative w-32 h-32 shrink-0">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
          <circle
            cx="60" cy="60" r="52" fill="none"
            stroke={strokeColor}
            strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-foreground">{score ?? '—'}</span>
          <span className="text-[10px] text-muted-foreground">/ 100</span>
        </div>
      </div>
      <div className="flex-1 min-w-[200px]">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">{st.emoji}</span>
          <h3 className="text-sm font-semibold text-foreground">Índice de Estabilidade de Consumo (IEC)</h3>
        </div>
        <p className={`text-lg font-bold ${st.color}`}>{st.label}</p>
        <p className="text-xs text-muted-foreground mt-1">
          CV médio dos insumos: <span className="font-semibold text-foreground">{avgCV != null ? `${avgCV.toFixed(2)}%` : '—'}</span>
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 text-[10px] text-muted-foreground">
          <span>🟢 95–100 Excelente</span>
          <span>🟢 90–94 Estável</span>
          <span>🟡 80–89 Atenção</span>
          <span>🟠 70–79 Instável</span>
          <span>🔴 &lt;70 Imediato</span>
        </div>
      </div>
    </div>
  );
}