import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

const ICON_TONES = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-green-50 text-green-600',
  red: 'bg-red-50 text-red-600',
  amber: 'bg-amber-50 text-amber-600',
};

const fmtDelta = (v) => `${v > 0 ? '+' : ''}${v.toFixed(1).replace('.', ',')}`;

// Cartão de KPI com variação opcional vs. período anterior.
// `delta` só deve ser passado quando existe base de comparação válida —
// nunca inventada. goodWhen: 'up' (subir é bom), 'down' (cair é bom)
// ou 'neutral' (informativo). unit: '%' ou ' pp' (pontos percentuais).
export default function KpiCard({ icon: Icon, label, value, sub, delta, iconTone = 'blue', valueTone }) {
  let tone = 'neutral';
  let Dir = Minus;
  if (delta && delta.value != null) {
    if (delta.value > 0) Dir = ArrowUpRight;
    else if (delta.value < 0) Dir = ArrowDownRight;
    if (delta.goodWhen === 'neutral' || delta.value === 0) {
      tone = 'neutral';
    } else {
      tone = (delta.value > 0) === (delta.goodWhen === 'up') ? 'good' : 'bad';
    }
  }
  const deltaCls = tone === 'good'
    ? 'text-green-700 bg-green-50'
    : tone === 'bad'
      ? 'text-red-700 bg-red-50'
      : 'text-blue-700 bg-blue-50';
  const valueCls = valueTone === 'good' ? 'text-green-600' : valueTone === 'bad' ? 'text-red-600' : 'text-slate-800';
  const hasDelta = delta && delta.value != null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${ICON_TONES[iconTone] || ICON_TONES.blue}`}>
            <Icon className="w-5 h-5" />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 leading-tight">{label}</p>
        </div>
        {hasDelta && (
          <span
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold shrink-0 ${deltaCls}`}
            title="Variação vs. período anterior de mesma duração"
          >
            <Dir className="w-3 h-3" />
            {fmtDelta(delta.value)}{delta.unit}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className={`text-xl font-bold leading-tight ${valueCls}`}>{value}</p>
        {sub && <p className="text-[11px] text-slate-500 mt-0.5 leading-snug truncate" title={sub}>{sub}</p>}
      </div>
    </div>
  );
}