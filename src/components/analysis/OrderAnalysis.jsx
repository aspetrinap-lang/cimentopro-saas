import { useEffect, useMemo, useState } from 'react';
import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';
import { computeFingerprint, loadLatestAnalysis, runAnalysis } from '@/lib/ai/aiService';
import AIStatusBadge from '@/components/ai/AIStatusBadge';
import { Search, Sparkles, FileText, AlertTriangle, Lightbulb, TrendingDown } from 'lucide-react';

const EVIDENCE_LABELS = {
  fact: 'Fato',
  pattern: 'Padrão',
  hypothesis: 'Hipótese',
  recommendation: 'Recomendação',
};

function fingerprintInputs(order, costs) {
  return {
    order_id: order.id,
    order_updated: order.updated_date || '',
    planned: order.planned_quantity || 0,
    actual: order.actual_quantity || 0,
    loss_second_line: order.loss_second_line || 0,
    loss_discarded: order.loss_discarded || 0,
    loss_reason: order.loss_reason || '',
    notes: order.notes || '',
    costs: costs || {},
  };
}

export default function OrderAnalysis({ orders, costs, names }) {
  const [selectedId, setSelectedId] = useState('');
  const [report, setReport] = useState(null);
  const [reportMeta, setReportMeta] = useState(null);
  const [staleData, setStaleData] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [errorKind, setErrorKind] = useState(null);

  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => (b.order_number || '').localeCompare(a.order_number || '')),
    [orders]
  );

  // Cálculos determinísticos — SEMPRE do sistema, nunca da IA (planned, actual,
  // refugo, custo, custo/peça e perda financeira).
  const metrics = useMemo(() => {
    const order = orders.find((o) => o.id === selectedId);
    if (!order) return null;
    const refugo = (order.loss_second_line || 0) + (order.loss_discarded || 0);
    const refugoPct = order.actual_quantity > 0 ? (refugo / order.actual_quantity) * 100 : 0;
    let totalCost = 0;
    const insumoLines = [];
    INSUMO_KEYS.forEach(k => {
      const qty = order[INSUMO_FIELDS[k].actual] || 0;
      const lineCost = qty * (costs[k] || 0);
      totalCost += lineCost;
      if (qty > 0) {
        insumoLines.push(`- ${names[k]}: ${qty.toFixed(1)} ${INSUMO_FIELDS[k].unit} (R$ ${lineCost.toFixed(2)})`);
      }
    });
    const costPerPiece = order.actual_quantity > 0 ? totalCost / order.actual_quantity : 0;
    const financialLoss = refugo * costPerPiece;
    return { order, refugo, refugoPct, totalCost, insumoLines, costPerPiece, financialLoss };
  }, [selectedId, orders, costs, names]);

  // Ao selecionar a ordem: exibe a análise ARMZENADA correspondente.
  // Abrir/selecionar NUNCA executa IA.
  useEffect(() => {
    let cancelled = false;
    setReport(null);
    setReportMeta(null);
    setStaleData(false);
    setError(null);
    setErrorKind(null);
    if (!metrics) return undefined;
    (async () => {
      try {
        const fingerprint = await computeFingerprint('order_analysis', fingerprintInputs(metrics.order, costs));
        const { analysis } = await loadLatestAnalysis('order_analysis');
        if (cancelled) return;
        if (analysis && analysis.data_fingerprint === fingerprint) {
          setReport(analysis.result);
          setReportMeta({ created_date: analysis.created_date, cached: true });
        } else if (analysis) {
          setStaleData(true);
        }
      } catch (e) {
        // Sem análise armazenada — o botão "Gerar análise" inicia a primeira.
      }
    })();
    return () => { cancelled = true; };
  }, [metrics, costs]);

  // Executa a análise —somente por ação EXPLÍCITA do usuário. O fluxo central
  // (função backend protegida) aplica fingerprint, cache, assinatura/limite,
  // persiste em AIAnalysis e registra o uso.
  async function analyze() {
    if (!metrics || loading) return;
    setLoading(true);
    setError(null);
    setErrorKind(null);
    const { order, refugo, refugoPct, totalCost, insumoLines, costPerPiece, financialLoss } = metrics;
    try {
      const prompt = `Você é o "Engenheiro Virtual", especialista em fábricas de artefatos de cimento.
Analise a seguinte ordem de produção e emita um diagnóstico técnico conciso em português.

IMPORTANTE: produção, refugo, custo e perda financeira JÁ FORAM CALCULADOS pelo sistema nos dados abaixo. NÃO recalcule nem substitua esses números — apenas interprete-os.

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

PRODUÇÃO (calculada pelo sistema):
- Planejada: ${order.planned_quantity || 0} peças
- Realizada: ${order.actual_quantity || 0} peças
- Eficiência: ${order.planned_quantity > 0 ? ((order.actual_quantity / order.planned_quantity) * 100).toFixed(1) : '0'}%
- Refugo (2ª linha): ${order.loss_second_line || 0} peças
- Descartadas: ${order.loss_discarded || 0} peças
- Refugo total: ${refugo} peças (${refugoPct.toFixed(2)}%)
- Motivo das perdas (informado): ${order.loss_reason || 'Não informado'}

INSUMOS CONSUMIDOS (real):
${insumoLines.join('\n') || '- (sem dados)'}

CUSTO ESTIMADO (calculado): R$ ${totalCost.toFixed(2)} (R$ ${costPerPiece.toFixed(2)}/peça)
PERDA FINANCEIRA ESTIMADA (refugo, calculada): R$ ${financialLoss.toFixed(2)}

OBSERVAÇÕES: ${order.notes || '—'}

Com base nesses dados, identifique o provável motivo principal de perdas e gere recomendações práticas de engenharia (vibração, molde, traço, umidade, etc).

Cada item deve ser classificado como FATO (diretamente suportado pelos dados), PADRÃO (observado nos dados) ou HIPÓTESE (possível causa a confirmar — nunca apresente hipótese como fato). Informe a confiança ('alta', 'média' ou 'baixa') e a evidência (dado concreto que sustenta o item).

Retorne no formato JSON exato:
{
  "main_reason": string,
  "evidence_type": "fact" | "pattern" | "hypothesis",
  "confidence": string,
  "evidence": string,
  "recommendations": [
    { "text": string, "evidence_type": "fact" | "pattern" | "hypothesis" | "recommendation", "confidence": string, "evidence": string }
  ]
}

O campo main_reason deve ser uma frase curta. recommendations deve conter 2 a 4 ações práticas.`;

      const res = await runAnalysis({
        analysis_type: 'order_analysis',
        fingerprint_inputs: fingerprintInputs(order, costs),
        prompt,
        schema: {
          type: 'object',
          properties: {
            main_reason: { type: 'string' },
            evidence_type: { type: 'string' },
            confidence: { type: 'string' },
            evidence: { type: 'string' },
            recommendations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  text: { type: 'string' },
                  evidence_type: { type: 'string' },
                  confidence: { type: 'string' },
                  evidence: { type: 'string' },
                },
                required: ['text'],
              },
            },
          },
          required: ['main_reason', 'recommendations'],
        },
        period_start: order.production_date,
        period_end: order.production_date,
        input_summary: prompt,
      });

      if (!res.ok) {
        setErrorKind(res.code);
        setError(res.error || 'Não foi possível gerar a análise agora. Tente novamente.');
      } else {
        setReport(res.analysis.result);
        setReportMeta({ created_date: res.analysis.created_date, cached: res.source === 'cache' });
        setStaleData(false);
      }
    } catch (e) {
      setErrorKind('error');
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
          {loading ? 'Analisando...' : report ? 'Atualizar análise' : 'Gerar análise'}
        </button>
      </div>

      {reportMeta && <AIStatusBadge meta={reportMeta} stale={staleData} />}

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-3 text-muted-foreground text-sm">
            <div className="w-5 h-5 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
            Diagnosticando ordem…
          </div>
        </div>
      )}

      {!report && !loading && !error && (
        <div className="bg-card border border-dashed border-border rounded-xl p-6 text-center text-sm text-muted-foreground">
          {staleData
            ? 'Há uma análise armazenada para dados anteriores. Clique em “Gerar análise” para analisar esta ordem.'
            : 'Nenhuma análise realizada ainda. Selecione a ordem e clique em “Gerar análise”.'}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-3">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {report && metrics && (
        <div className="space-y-4">
          {/* Cabeçalho do diagnóstico — números SEMPRE calculados pelo sistema */}
          <div className="rounded-xl border border-border bg-gradient-to-br from-slate-50 to-emerald-50/40 p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-base font-bold text-foreground">Análise da Ordem {metrics.order.order_number}{metrics.order.order_year ? '/' + metrics.order.order_year : ''}</h3>
              <span className="text-xs font-semibold text-muted-foreground">Diagnóstico do Engenheiro Virtual</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Metric label="Produção planejada" value={`${(metrics.order.planned_quantity || 0).toLocaleString('pt-BR')} peças`} />
              <Metric label="Produção realizada" value={`${(metrics.order.actual_quantity || 0).toLocaleString('pt-BR')} peças`} />
              <Metric label="Refugo" value={`${metrics.refugoPct.toFixed(2)}%`} tone="warn" />
              <Metric label="Perda financeira" value={`R$ ${metrics.financialLoss.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} tone="loss" />
            </div>
          </div>

          {/* Motivo principal */}
          <div className="flex items-start gap-3 bg-amber-50 rounded-xl border border-amber-200 p-4">
            <TrendingDown className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Principal motivo</p>
                {report.evidence_type && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                    {EVIDENCE_LABELS[report.evidence_type] || report.evidence_type}{report.confidence ? ` · ${report.confidence}` : ''}
                  </span>
                )}
              </div>
              <p className="text-sm text-foreground mt-1 leading-relaxed">{report.main_reason}</p>
              {report.evidence && <p className="text-[11px] text-muted-foreground mt-1.5">Evidência: {report.evidence}</p>}
            </div>
          </div>

          {/* Recomendações */}
          <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-emerald-600" />
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Recomendação</p>
            </div>
            <ul className="space-y-2">
              {(report.recommendations || []).map((rec, i) => {
                const text = typeof rec === 'string' ? rec : rec?.text || '';
                const etype = typeof rec === 'object' ? rec?.evidence_type : null;
                const conf = typeof rec === 'object' ? rec?.confidence : null;
                const ev = typeof rec === 'object' ? rec?.evidence : null;
                return (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground leading-relaxed">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                    <span className="flex-1">
                      {text}
                      {etype && (
                        <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200 align-middle">
                          {EVIDENCE_LABELS[etype] || etype}{conf ? ` · ${conf}` : ''}
                        </span>
                      )}
                      {ev && <span className="block text-[11px] text-muted-foreground mt-0.5">Evidência: {ev}</span>}
                    </span>
                  </li>
                );
              })}
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