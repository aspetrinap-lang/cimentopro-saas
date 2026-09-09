import { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';
import { Search, Sparkles, FileText, AlertTriangle, Lightbulb, TrendingDown } from 'lucide-react';

export default function OrderAnalysis({ orders, costs, names }) {
  const [selectedId, setSelectedId] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => (b.order_number || '').localeCompare(a.order_number || '')),
    [orders]
  );

  async function analyze() {
    const order = orders.find(o => o.id === selectedId);
    if (!order) return;
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      // Cálculo de refugo e perda financeira
      const refugo = (order.loss_second_line || 0) + (order.loss_discarded || 0);
      const refugoPct = order.actual_quantity > 0
        ? (refugo / order.actual_quantity) * 100
        : 0;

      let totalCost = 0;
      const insumoLines = [];
      INSUMO_KEYS.forEach(k => {
        const qty = order[INSUMO_FIELDS[k].actual] || 0;
        const unitCost = costs[k] || 0;
        const lineCost = qty * unitCost;
        totalCost += lineCost;
        if (qty > 0) {
          insumoLines.push(`- ${names[k]}: ${qty.toFixed(1)} ${INSUMO_FIELDS[k].unit} (R$ ${lineCost.toFixed(2)})`);
        }
      });

      const costPerPiece = order.actual_quantity > 0 ? totalCost / order.actual_quantity : 0;
      const financialLoss = refugo * costPerPiece;

      const prompt = `Você é o "Engenheiro Virtual", especialista em fábricas de artefatos de cimento.
Analise a seguinte ordem de produção e emita um diagnóstico técnico conciso em português.

ORDEM: ${order.order_number || '—'}${order.order_year ? '/' + order.order_year : ''}
Data: ${order.production_date || '—'}
Máquina: ${order.machine_name || '—'}
Produto: ${order.product_type_name || '—'}
Molde: ${order.mold_name || '—'}
Traço: ${order.concrete_trace_id ? 'vinculado' : '—'}

RASTREABILIDADE:
- Operador: ${order.operator_name || 'Não informado'}
- Turno: ${order.shift || 'Não informado'}
- Umidade dos agregados: ${order.raw_material_moisture != null ? order.raw_material_moisture + '%' : 'Não informado'}

PRODUÇÃO:
- Planejada: ${order.planned_quantity || 0} peças
- Realizada: ${order.actual_quantity || 0} peças
- Eficiência: ${order.planned_quantity > 0 ? ((order.actual_quantity / order.planned_quantity) * 100).toFixed(1) : '0'}%
- Refugo (2ª linha): ${order.loss_second_line || 0} peças
- Descartadas: ${order.loss_discarded || 0} peças
- Refugo total: ${refugo} peças (${refugoPct.toFixed(2)}%)
- Motivo das perdas (informado): ${order.loss_reason || 'Não informado'}

INSUMOS CONSUMIDOS (real):
${insumoLines.join('\n') || '- (sem dados)'}

CUSTO ESTIMADO: R$ ${totalCost.toFixed(2)} (R$ ${costPerPiece.toFixed(2)}/peça)
PERDA FINANCEIRA ESTIMADA (refugo): R$ ${financialLoss.toFixed(2)}

OBSERVAÇÕES: ${order.notes || '—'}

Com base nesses dados, identifique o provável motivo principal de perdas e gere recomendações práticas de engenharia (vibração, molde, traço, umidade, etc).

Retorne no formato JSON exato:
{
  "order_label": string,
  "planned": number,
  "actual": number,
  "refugo_percent": number,
  "financial_loss": number,
  "main_reason": string,
  "recommendations": string[]
}

O campo main_reason deve ser uma frase curta. recommendations deve conter 2 a 4 ações práticas, cada uma como string.`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            order_label: { type: 'string' },
            planned: { type: 'number' },
            actual: { type: 'number' },
            refugo_percent: { type: 'number' },
            financial_loss: { type: 'number' },
            main_reason: { type: 'string' },
            recommendations: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      });
      setReport(res);
    } catch (e) {
      setError('Não foi possível gerar a análise agora. Tente novamente.');
    }
    setLoading(false);
  }

  return (
    <section className="bg-card rounded-2xl border border-border shadow-sm p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-1.5">
            Análise de Ordem
            <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
          </h2>
          <p className="text-xs text-muted-foreground">Diagnóstico técnico individual por ordem de produção</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5">
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          className="flex-1 border border-input rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Selecione uma ordem concluída…</option>
          {sortedOrders.map(o => (
            <option key={o.id} value={o.id}>
              {o.order_number}{o.order_year ? '/' + o.order_year : ''} — {o.product_type_name || 'Sem produto'} ({o.production_date || 's/d'})
            </option>
          ))}
        </select>
        <button
          onClick={analyze}
          disabled={!selectedId || loading}
          className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          <Search className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Analisando...' : 'Gerar análise'}
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-3 text-muted-foreground text-sm">
            <div className="w-5 h-5 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
            Diagnosticando ordem…
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-3">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {report && (
        <div className="space-y-4">
          {/* Cabeçalho do diagnóstico */}
          <div className="rounded-xl border border-border bg-gradient-to-br from-slate-50 to-emerald-50/40 p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-base font-bold text-foreground">Análise da Ordem {report.order_label}</h3>
              <span className="text-xs font-semibold text-muted-foreground">Diagnóstico do Engenheiro Virtual</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Metric label="Produção planejada" value={`${(report.planned || 0).toLocaleString('pt-BR')} peças`} />
              <Metric label="Produção realizada" value={`${(report.actual || 0).toLocaleString('pt-BR')} peças`} />
              <Metric label="Refugo" value={`${(report.refugo_percent || 0).toFixed(2)}%`} tone="warn" />
              <Metric label="Perda financeira" value={`R$ ${(report.financial_loss || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} tone="loss" />
            </div>
          </div>

          {/* Motivo principal */}
          <div className="flex items-start gap-3 bg-amber-50 rounded-xl border border-amber-200 p-4">
            <TrendingDown className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Principal motivo</p>
              <p className="text-sm text-foreground mt-1 leading-relaxed">{report.main_reason}</p>
            </div>
          </div>

          {/* Recomendações */}
          <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-emerald-600" />
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Recomendação</p>
            </div>
            <ul className="space-y-2">
              {(report.recommendations || []).map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground leading-relaxed">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value, tone }) {
  const toneClass = tone === 'loss'
    ? 'text-red-600'
    : tone === 'warn'
      ? 'text-amber-600'
      : 'text-foreground';
  return (
    <div className="bg-card rounded-lg border border-border p-3">
      <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
      <p className={`text-sm font-bold mt-1 ${toneClass}`}>{value}</p>
    </div>
  );
}