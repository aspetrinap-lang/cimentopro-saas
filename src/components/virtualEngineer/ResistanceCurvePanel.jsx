import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Database, ShieldCheck, AlertTriangle, Info } from 'lucide-react';
import { buildResistanceCurve, buildChartSeries } from '@/lib/quality/resistanceCurveEngine';
import { loadPredictions, syncPredictions } from '@/lib/quality/predictionStore';
import { formatDateBR } from '@/lib/dateFormat';
import ResistanceCurveChart from './ResistanceCurveChart';

const STATUS_STYLE = {
  insuficiente: 'bg-red-100 text-red-700',
  formacao: 'bg-amber-100 text-amber-700',
  consistente: 'bg-blue-100 text-blue-700',
  robusta: 'bg-green-100 text-green-700',
};
const CONF_STYLE = { ALTA: 'bg-green-100 text-green-700', MÉDIA: 'bg-amber-100 text-amber-700', BAIXA: 'bg-red-100 text-red-700' };

function Metric({ label, value }) {
  return (
    <div className="bg-muted/40 rounded-lg px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

// Bloco de curva do Engenheiro Virtual — consome resistanceCurveEngine.
// Nenhuma matemática aqui: apenas seleção, persistência de previsões e exibição.
export default function ResistanceCurvePanel({ reports, productTypes, traces, predictions, onPredictionsChanged }) {
  const productTypesById = useMemo(() => Object.fromEntries(productTypes.map((p) => [p.id, p])), [productTypes]);
  const traceMap = useMemo(() => Object.fromEntries(traces.map((t) => [t.id, t])), [traces]);

  const products = useMemo(() => {
    const ids = new Set(reports.map((r) => r.product_type_id).filter(Boolean));
    return productTypes.filter((p) => ids.has(p.id));
  }, [reports, productTypes]);

  const [productId, setProductId] = useState('');
  useEffect(() => {
    if (!productId && products.length > 0) setProductId(products[0].id);
  }, [products, productId]);

  const generatedAt = useMemo(() => new Date().toISOString(), [reports, productId, predictions]);

  const curve = useMemo(() => {
    if (!productId) return null;
    const pt = productTypesById[productId];
    return buildResistanceCurve({
      company_id: pt?.company_id,
      product_id: productId,
      product_name: pt?.name,
      dimensions: pt ? `${pt.length_mm || '—'}×${pt.width_mm || '—'}×${pt.height_mm || '—'} mm` : null,
      trace_id: pt?.concrete_trace_id || null,
      trace_name: pt?.concrete_trace_id ? traceMap[pt.concrete_trace_id]?.name : null,
      product_target: Number(pt?.target_resistance) || 0,
      reports,
      productTypesById,
      storedPredictions: predictions,
      generated_at: generatedAt,
    });
  }, [reports, productId, predictions, productTypesById, traceMap, generatedAt]);

  const series = useMemo(() => (curve ? buildChartSeries(curve) : []), [curve]);

  // Persistência + validação (PREVER → MEDIR → COMPARAR → VALIDAR) — por seleção/laudos.
  const syncedKeyRef = useRef(null);
  const [syncing, setSyncing] = useState(false);
  const [syncInfo, setSyncInfo] = useState(null);
  useEffect(() => {
    if (!curve?.product_id || curve.base.result_count === 0) return undefined;
    const key = `${curve.product_id}|${curve.trace_id}|${reports.length}|${reports[0]?.updated_date || ''}`;
    if (syncedKeyRef.current === key) return undefined;
    syncedKeyRef.current = key;
    let cancelled = false;
    (async () => {
      setSyncing(true);
      try {
        const res = await syncPredictions(curve);
        const preds = await loadPredictions();
        if (!cancelled) {
          setSyncInfo(res);
          if (onPredictionsChanged) onPredictionsChanged(preds);
        }
      } catch (e) {
        // falha de persistência não bloqueia a visualização da curva
      }
      if (!cancelled) setSyncing(false);
    })();
    return () => { cancelled = true; };
  }, [curve]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!curve || products.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-violet-600" />
          <h2 className="text-base font-semibold text-foreground">Curva de Desenvolvimento da Resistência</h2>
        </div>
        <p className="text-sm text-muted-foreground">Nenhum laudo com corpos de prova ainda — a curva nasce do histórico de laudos existentes.</p>
      </div>
    );
  }

  const refLabel = { product_target: 'resistência de referência do produto', historical_28: 'média histórica de 28 dias', actual_28: 'resultado real de 28 dias' };

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-violet-600" />
          <div>
            <h2 className="text-base font-semibold text-foreground">Curva de Desenvolvimento da Resistência</h2>
            <p className="text-xs text-muted-foreground">Referência histórica × Real CimentoPro × Projeção IA — {curve.engine_version}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {curve.base.status && (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[curve.base.status.key]}`}>{curve.base.status.label}</span>
          )}
          {curve.ai.confidence && (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${CONF_STYLE[curve.ai.confidence]}`}>Confiança {curve.ai.confidence}</span>
          )}
          <select value={productId} onChange={(e) => setProductId(e.target.value)}
            className="border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring">
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {/* Base histórica visível */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Metric label="Resultados" value={curve.base.result_count} />
        <Metric label="Lotes" value={curve.base.lot_count} />
        <Metric label="Período" value={curve.base.period_start ? `${formatDateBR(curve.base.period_start)} – ${formatDateBR(curve.base.period_end)}` : '—'} />
        <Metric label="Idades" value={curve.real.points.map((p) => `${p.age_days}d`).join(', ') || '—'} />
      </div>

      <ResistanceCurveChart series={series} targetStrength={curve.target_strength} />

      {curve.scope.fallback_reason && (
        <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {curve.scope.fallback_reason}
        </div>
      )}
      {curve.r28.source && (
        <p className="text-xs text-muted-foreground">R28 (100% da referência): {curve.r28.value?.toFixed(2)} MPa — {refLabel[curve.r28.source]}. Sem R28 conhecido, a referência é exibida apenas em percentual (nunca inventada).</p>
      )}
      {curve.ai.note && <p className="text-xs text-muted-foreground">{curve.ai.note}</p>}

      {/* Validação contínua */}
      {curve.validation ? (
        <div className="border border-border rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-foreground">Validação das Provisões IA (previsão × resultado real)</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <Metric label="Previsões validadas" value={curve.validation.count} />
            <Metric label="MAE" value={curve.validation.mae != null ? `${curve.validation.mae} MPa` : '—'} />
            <Metric label="RMSE" value={curve.validation.rmse != null ? `${curve.validation.rmse} MPa` : '—'} />
            <Metric label="Viés" value={curve.validation.bias != null ? `${curve.validation.bias} MPa` : '—'} />
            <Metric label="Cobertura do intervalo" value={curve.validation.coverage_pct != null ? `${curve.validation.coverage_pct}%` : '—'} />
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Ainda sem previsões validadas — os próximos laudos compararão a projeção com o resultado real (a previsão original é preservada).</p>
      )}
      {syncing && <p className="text-xs text-muted-foreground flex items-center gap-2"><span className="w-3 h-3 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin inline-block" /> Registrando previsões e validando contra laudos existentes...</p>}
      {!syncing && syncInfo && syncInfo.created + syncInfo.validated > 0 && (
        <p className="text-xs text-muted-foreground">{syncInfo.created} previsão(ões) registrada(s) · {syncInfo.validated} validação(ões) atualizada(s).</p>
      )}

      {/* Alertas analíticos */}
      {curve.alerts.length > 0 && (
        <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-800">Alertas Analíticos (informativos — não são critério normativo)</h3>
          </div>
          <ul className="space-y-1">
            {curve.alerts.map((a, i) => (
              <li key={i} className="text-xs text-amber-800">{a.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Auditoria da origem dos dados */}
      <div className="border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Database className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Origem dos Dados (auditoria)</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-muted-foreground">
          <p>Fonte: {curve.audit.data_source}</p>
          <p>Laudos: {curve.base.report_count} · Escopo: {curve.scope.level}</p>
          <p>Método: {curve.ai.method} · {curve.engine_version}</p>
          <p>Backtesting: {curve.ai.backtest ? `${curve.ai.backtest.n} previsões, MAE ${curve.ai.backtest.mae} MPa` : 'sem dados suficientes'}</p>
          <p>Gerado em: {formatDateBR(curve.audit.generated_at)}</p>
          <p>{curve.product_name}{curve.trace_name ? ` · Traço ${curve.trace_name}` : ''}</p>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground bg-muted/40 rounded-lg p-3 border border-border">
        Curva de referência utilizada para análise do desenvolvimento da resistência. Não substitui requisitos normativos, ensaios laboratoriais ou critérios de aceitação. Projeções são estimativas sujeitas a validação com novos ensaios.
      </p>
    </div>
  );
}