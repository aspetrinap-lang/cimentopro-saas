import { Scale } from 'lucide-react';

const PROPORTIONS = [
  { key: 'cementAggregate', label: 'Cimento / Agregados' },
  { key: 'aggregateCement', label: 'Agregado total / Cimento' },
  { key: 'waterCement', label: 'Água / Cimento' },
  { key: 'sandAggregate', label: 'Areia / Agregado total' },
];

const fmt = (v, d = 3) =>
  v == null || Number.isNaN(v)
    ? '—'
    : v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

const fmtPct = (v, d = 1) =>
  v == null
    ? '—'
    : `${v > 0 ? '+' : ''}${v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })}%`;

export default function TraceProportionsPanel({ analysis }) {
  if (!analysis || !analysis.proportions) return null;
  const rows = PROPORTIONS.map((p) => ({ ...p, data: analysis.proportions[p.key] })).filter(
    (r) => r.data && r.data.actual != null
  );
  if (rows.length === 0) return null;

  return (
    <section className="bg-card rounded-2xl border border-border shadow-sm p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
          <Scale className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Proporções do Traço</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Relação entre os componentes — consumo real vs traço cadastrado
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[420px]">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b border-border">
              <th className="py-2 font-semibold">Proporção</th>
              <th className="py-2 font-semibold text-right">Padrão</th>
              <th className="py-2 font-semibold text-right">Real</th>
              <th className="py-2 font-semibold text-right">Variação</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const dev = r.data.deviationPct;
              return (
                <tr key={r.key} className="border-b border-border/60 last:border-0">
                  <td className="py-2.5 font-medium text-foreground">{r.label}</td>
                  <td className="py-2.5 text-right text-muted-foreground">{fmt(r.data.standard)}</td>
                  <td className="py-2.5 text-right font-semibold">{fmt(r.data.actual)}</td>
                  <td
                    className={`py-2.5 text-right font-semibold ${
                      dev != null && Math.abs(dev) > 5 ? 'text-red-600' : 'text-foreground'
                    }`}
                  >
                    {dev != null ? fmtPct(dev) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Variação significativa nas proporções indica possível alteração no equilíbrio do traço — investigar a
        dosagem antes de alterar cadastros.
      </p>
    </section>
  );
}