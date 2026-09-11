import { Gauge } from 'lucide-react';
import { insumoLabel } from './ConsumptionPanel';

const fmt = (v, d = 1) =>
  v == null || Number.isNaN(v)
    ? '—'
    : v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

export default function SpecificConsumptionPanel({ analysis, names }) {
  if (!analysis) return null;
  const rows = analysis.rows.filter((r) => r.per1000 != null || r.perPiece != null || r.perM3 != null);
  const hasM3 = rows.some((r) => r.perM3 != null);

  return (
    <section className="bg-card rounded-2xl border border-border shadow-sm p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
          <Gauge className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Consumo Específico</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Indicador industrial normalizado — permite comparar produções de tamanhos diferentes
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Sem consumo real registrado para calcular o consumo específico.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="py-2 font-semibold">Insumo</th>
                <th className="py-2 font-semibold text-right">Por peça</th>
                <th className="py-2 font-semibold text-right">Por 1.000 peças</th>
                <th className="py-2 font-semibold text-right">Por m³ produzido</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-border/60 last:border-0">
                  <td className="py-2.5 font-medium text-foreground">{insumoLabel(names, r.key)}</td>
                  <td className="py-2.5 text-right text-muted-foreground">
                    {r.perPiece != null ? `${fmt(r.perPiece, 2)} ${r.unit}` : '—'}
                  </td>
                  <td className="py-2.5 text-right font-semibold">
                    {r.per1000 != null ? `${fmt(r.per1000)} ${r.unit}` : '—'}
                  </td>
                  <td className="py-2.5 text-right text-muted-foreground">
                    {r.perM3 != null ? `${fmt(r.perM3)} ${r.unit}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && !hasM3 && (
        <p className="text-xs text-muted-foreground">
          Volume por unidade não cadastrado no artefato — o consumo por m³ não pôde ser calculado.
        </p>
      )}
    </section>
  );
}