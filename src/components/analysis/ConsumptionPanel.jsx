import { FlaskConical, AlertTriangle } from 'lucide-react';

const STATUS = {
  ok: { label: 'No padrão', pill: 'bg-green-100 text-green-700' },
  atencao: { label: 'Atenção', pill: 'bg-amber-100 text-amber-700' },
  desvio: { label: 'Fora do padrão', pill: 'bg-red-100 text-red-700' },
  'sem-padrao': { label: 'Sem padrão', pill: 'bg-slate-100 text-slate-500' },
};

const CONFIDENCE = {
  alta: {
    label: 'Alta confiabilidade',
    pill: 'bg-green-100 text-green-700',
    note: null,
  },
  media: {
    label: 'Média confiabilidade',
    pill: 'bg-amber-100 text-amber-700',
    note: 'Alguns insumos consumidos não possuem padrão cadastrado no artefato — a análise é parcial.',
  },
  baixa: {
    label: 'Análise preliminar',
    pill: 'bg-red-100 text-red-700',
    note: 'O artefato não possui traço/consumo padrão cadastrado. Cadastre o traço no artefato (Cadastros) para uma análise confiável.',
  },
};

const fmt = (v, d = 0) =>
  v == null || Number.isNaN(v)
    ? '—'
    : v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

const fmtPct = (v, d = 1) =>
  v == null
    ? '—'
    : `${v > 0 ? '+' : ''}${v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })}%`;

export const insumoLabel = (names, key) => names?.[key] || (key === 'water' ? 'Água' : key);

function FlowCard({ label, value, tone }) {
  return (
    <div className="bg-muted/50 rounded-xl px-4 py-3">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${tone || 'text-foreground'}`}>{value}</p>
    </div>
  );
}

export default function ConsumptionPanel({ analysis, names, title = 'Consumo de Matéria-Prima' }) {
  if (!analysis) return null;
  const f = analysis.flow;
  const conf = CONFIDENCE[analysis.confidence] || CONFIDENCE.baixa;

  return (
    <section className="bg-card rounded-2xl border border-border shadow-sm p-5 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
            <FlaskConical className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">{title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Consumo esperado para a produção boa × consumo real — nunca planejado × real
            </p>
          </div>
        </div>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${conf.pill}`}>{conf.label}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <FlowCard label="Produção bruta" value={`${fmt(f.gross)} peças`} />
        <FlowCard label="Produção boa (aprovada)" value={`${fmt(f.good)} peças`} />
        <FlowCard label="Refugo / descarte" value={`${fmt(f.refugo)} peças`} tone="text-amber-600" />
        <FlowCard
          label="% de refugo"
          value={`${fmt(f.refugoPct, 1)}%`}
          tone={f.refugoPct > 5 ? 'text-red-600' : 'text-foreground'}
        />
      </div>

      {conf.note && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">{conf.note}</p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b border-border">
              <th className="py-2 font-semibold">Insumo</th>
              <th className="py-2 font-semibold text-right">Padrão/un</th>
              <th className="py-2 font-semibold text-right">Esperado</th>
              <th className="py-2 font-semibold text-right">Real</th>
              <th className="py-2 font-semibold text-right">Desvio</th>
              <th className="py-2 font-semibold text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {analysis.rows.map((r) => {
              const st = STATUS[r.status] || STATUS['sem-padrao'];
              return (
                <tr key={r.key} className="border-b border-border/60 last:border-0">
                  <td className="py-2.5 font-medium text-foreground">{insumoLabel(names, r.key)}</td>
                  <td className="py-2.5 text-right text-muted-foreground">
                    {r.standardPerUnit != null ? `${fmt(r.standardPerUnit, 2)} ${r.unit}` : '—'}
                  </td>
                  <td className="py-2.5 text-right">{r.expected > 0 ? `${fmt(r.expected)} ${r.unit}` : '—'}</td>
                  <td className="py-2.5 text-right font-medium">{r.actual > 0 ? `${fmt(r.actual)} ${r.unit}` : '—'}</td>
                  <td
                    className={`py-2.5 text-right font-semibold ${
                      r.deviationPct == null
                        ? 'text-muted-foreground'
                        : Math.abs(r.deviationPct) > DEVIATION_ALERT
                          ? 'text-red-600'
                          : 'text-foreground'
                    }`}
                  >
                    {r.deviationPct != null
                      ? `${fmt(r.deviation)} ${r.unit} (${fmtPct(r.deviationPct)})`
                      : 'sem padrão'}
                  </td>
                  <td className="py-2.5 text-right">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.pill}`}>{st.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Desvio acima disso é destacado em vermelho (mesmo limiar do relatório)
const DEVIATION_ALERT = 5;