import { useEffect, useState } from 'react';
import { scopedFilter } from '@/lib/companyScope';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, RefreshCw, ChevronRight, AlertCircle, Sparkles } from 'lucide-react';
import ResistanceGrowthCard from './ResistanceGrowthCard';

const PRIORITY = {
  critical: { label: 'Crítico', badge: 'bg-red-100 text-red-700',    border: 'border-l-red-500' },
  high:     { label: 'Alto',    badge: 'bg-orange-100 text-orange-700', border: 'border-l-orange-500' },
  medium:   { label: 'Médio',   badge: 'bg-amber-100 text-amber-700',  border: 'border-l-amber-500' },
  info:     { label: 'Info',    badge: 'bg-blue-100 text-blue-700',    border: 'border-l-blue-500' },
};

const PAGE_ROUTES = {
  quality: '/quality', history: '/history', maintenance: '/maintenance',
  machines: '/machines', orders: '/orders', analysis: '/analysis',
};
const PAGE_LABELS = {
  quality: 'Qualidade', history: 'Histórico', maintenance: 'Manutenção',
  machines: 'Máquinas', orders: 'Ordens', analysis: 'Análise',
};

// Monta o sumário técnico determinístico que fundamenta a análise da IA:
// laudos × produção da ordem × paradas × manutenções, tendência de fck por
// artefato, média de fck por categoria e leitura da curva entre idades.
function buildQualitySummary(reports, orders, downtimes, maintenances, productTypes, traces) {
  const orderMap = {}; orders.forEach(o => { orderMap[o.id] = o; });
  const ptMap = {}; (productTypes || []).forEach(p => { ptMap[p.id] = p; });
  const traceMap = {}; (traces || []).forEach(t => { traceMap[t.id] = t; });
  const today = new Date().toISOString().slice(0, 10);

  let s = `LAUDOS DE QUALIDADE: ${reports.length} laudos.\n\nLAUDOS DETALHADOS:\n`;
  reports.slice(0, 25).forEach(r => {
    const o = orderMap[r.order_id];
    const pt = ptMap[r.product_type_id];
    const trace = pt?.concrete_trace_id ? traceMap[pt.concrete_trace_id] : null;
    const testDate = r.test_date || today;
    s += `Laudo ${r.report_number} (${r.norm_reference}) — artefato ${r.product_type_name}, moldagem ${r.molding_date}, ensaio ${r.test_date || '—'}, média ${r.average_resistance ?? '—'} MPa, fck est ${r.estimated_fck ?? '—'} MPa vs alvo ${r.target_resistance ?? '—'} MPa, ${r.is_compliant ? 'CONFORME' : 'NÃO CONFORME'}.`;
    if (o) {
      const cemP = Number(o.planned_cement) || 0;
      const cemA = Number(o.actual_cement) || 0;
      const dev = cemP > 0 && cemA > 0 ? `desvio ${((cemA / cemP - 1) * 100).toFixed(1)}%` : 'sem lançamento real';
      s += ` Ordem ${o.order_number}: cimento planejado ${cemP || '—'} kg vs real ${cemA || '—'} kg (${dev}), umidade agregados ${o.raw_material_moisture ?? '—'}%, ${o.actual_quantity ?? '—'} peças produzidas, traço ${trace ? trace.name : 'não vinculado'}.`;
    }
    const machineId = o?.machine_id;
    const dts = machineId ? downtimes.filter(d => d.machine_id === machineId && d.date >= r.molding_date && d.date <= testDate) : [];
    if (dts.length) {
      const mins = dts.reduce((a, d) => a + (d.duration_minutes || 0), 0);
      const cats = {};
      dts.forEach(d => { const c = d.failure_category || 'Outros'; cats[c] = (cats[c] || 0) + (d.duration_minutes || 0); });
      s += ` Paradas entre moldagem e ensaio: ${dts.length} ocorrências, ${mins} min (${Object.entries(cats).map(([c, m]) => `${c}: ${m} min`).join(', ')}).`;
    }
    const mts = machineId ? maintenances.filter(m => m.machine_id === machineId && m.date >= r.molding_date && m.date <= testDate) : [];
    if (mts.length) s += ` Manutenções da máquina no período: ${mts.length} (${mts.map(m => `${m.date} ${m.maintenance_type}`).join('; ')}).`;
    s += '\n';
  });

  const byArt = {};
  reports.forEach(r => { (byArt[r.product_type_name || '—'] = byArt[r.product_type_name || '—'] || []).push(r); });
  Object.values(byArt).forEach(rs => rs.sort((a, b) =>
    String(a.test_date || a.molding_date || '').localeCompare(String(b.test_date || b.molding_date || ''))));

  s += '\nTENDÊNCIA DE fck ESTIMADO POR ARTEFATO (cronológico):\n';
  Object.entries(byArt).forEach(([name, rs]) => {
    s += `- ${name}: ${rs.map(r => `${String(r.test_date || r.molding_date || '').slice(0, 7)}=${r.estimated_fck ?? '—'}MPa`).join(' → ')}\n`;
  });

  s += '\nMÉDIA DE fck ESTIMADO POR CATEGORIA:\n';
  const byCat = {};
  reports.forEach(r => {
    if (r.estimated_fck) (byCat[r.category || 'Sem categoria'] = byCat[r.category || 'Sem categoria'] || []).push(Number(r.estimated_fck));
  });
  Object.entries(byCat).forEach(([c, vals]) => {
    s += `- ${c}: ${(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)} MPa (${vals.length} laudos)\n`;
  });

  s += '\nCURVA DE CRESCIMENTO POR ARTEFATO (resistência média por idade, ganho 7→28 dias):\n';
  Object.entries(byArt).forEach(([name, rs]) => {
    const byAge = {};
    rs.forEach(r => (r.specimens || []).forEach(sp => {
      const age = Number(sp.age_days) || 0;
      const res = Number(sp.resistance_mpa) || 0;
      if (!age || !res) return;
      (byAge[age] = byAge[age] || []).push(res);
    }));
    const ages = Object.keys(byAge).map(Number).sort((a, b) => a - b);
    if (ages.length >= 2) {
      const avg = a => byAge[a].reduce((x, y) => x + y, 0) / byAge[a].length;
      const g728 = ages.includes(7) && ages.includes(28) ? ((avg(28) / avg(7) - 1) * 100).toFixed(0) : null;
      s += `- ${name}: ${ages.map(a => `${a}d=${avg(a).toFixed(1)}MPa(n=${byAge[a].length})`).join(', ')}${g728 != null ? ` — ganho 7→28: ${g728}%` : ''}\n`;
    }
  });

  return s;
}

// Análise de Qualidade assistida por IA: cruza laudos × produção × paradas ×
// manutenções. Roda automaticamente ao abrir a página e pelo botão.
export default function QualityAnalysis({ orders }) {
  const navigate = useNavigate();
  const [reports, setReports] = useState(null);
  const [downtimes, setDowntimes] = useState([]);
  const [maintenances, setMaintenances] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [traces, setTraces] = useState([]);
  const [findings, setFindings] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [autoTriggered, setAutoTriggered] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.entities.QualityReport.filter(scopedFilter(), '-test_date', 200),
      base44.entities.MachineDowntime.filter(scopedFilter({}), '-date', 500),
      base44.entities.PreventiveMaintenance.filter(scopedFilter({}), '-date', 300),
      base44.entities.ProductType.filter(scopedFilter({}), 'name', 500),
      base44.entities.ConcreteTrace.filter(scopedFilter({}), 'name', 500),
    ]).then(([r, d, m, pt, t]) => {
      setReports(r);
      setDowntimes(d);
      setMaintenances(m);
      setProductTypes(pt);
      setTraces(t);
    }).catch(() => setReports([]));
  }, []);

  async function analyze() {
    if (!reports || reports.length === 0) return;
    setAnalyzing(true);
    setError(null);
    try {
      const summary = buildQualitySummary(reports, orders || [], downtimes, maintenances, productTypes, traces);
      const prompt = `Você é o "Engenheiro Virtual" especializado em controle de qualidade de fábricas de artefatos de cimento.
Analise os dados de qualidade abaixo (laudos, produção, paradas e manutenções) e emita achados técnicos em português, citando valores concretos dos dados.

Analise continuamente:
1. Conformidade dos lotes (fck estimado vs alvo, não conformidades recentes)
2. Desvios de consumo de cimento real vs planejado nas ordens vinculadas aos laudos
3. Influência de umidade dos agregados e do traço na resistência
4. Paradas de máquina e manutenções entre a moldagem e o ensaio (possíveis causas de perda de resistência)
5. Tendência histórica de fck por artefato e média por categoria (piora ou melhora)
6. Curva de crescimento entre idades (ganho 7→28 dias baixo, estagnação ou queda)

Para cada achado, retorne:
- priority: "critical", "high", "medium" ou "info"
- category: categoria (ex: "Qualidade", "Conformidade", "Produção", "Paradas", "Manutenção", "Tendência", "Curva de Crescimento")
- title: título curto (máx 6 palavras)
- diagnosis: diagnóstico em português, 2-3 frases, citando valores concretos
- parameters: lista de 2 a 4 parâmetros curtos que fundamentam o achado (ex: "fck est: 32,1 MPa vs alvo 35 MPa")
- action_page: página recomendada para ação, uma de: "quality", "history", "maintenance", "machines", "orders", "analysis"

Gere entre 3 e 8 achados, priorizando os mais urgentes.

DADOS:
${summary}`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            findings: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  priority: { type: 'string' },
                  category: { type: 'string' },
                  title: { type: 'string' },
                  diagnosis: { type: 'string' },
                  parameters: { type: 'array', items: { type: 'string' } },
                  action_page: { type: 'string' },
                },
              },
            },
          },
        },
      });
      setFindings(res.findings || []);
    } catch (e) {
      setError('Não foi possível gerar a análise de qualidade agora. Tente novamente.');
    }
    setAnalyzing(false);
  }

  // Roda automaticamente ao abrir a página (assim que os laudos carregarem)
  useEffect(() => {
    if (reports && reports.length > 0 && !autoTriggered && !analyzing) {
      setAutoTriggered(true);
      analyze();
    }
  }, [reports, autoTriggered, analyzing]);

  const sortedFindings = [...findings].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, info: 3 };
    return (order[a.priority] ?? 9) - (order[b.priority] ?? 9);
  });

  return (
    <section className="bg-gradient-to-br from-emerald-50 via-white to-teal-50 rounded-2xl border border-emerald-100 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-1.5">
              Análise de Qualidade
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
            </h2>
            <p className="text-xs text-muted-foreground">IA cruza laudos, produção, paradas e manutenções do período</p>
          </div>
        </div>
        <button onClick={analyze} disabled={analyzing || !reports || reports.length === 0}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${analyzing ? 'animate-spin' : ''}`} />
          {analyzing ? 'Analisando...' : 'Analisar Qualidade'}
        </button>
      </div>

      {reports === null ? (
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-3 text-muted-foreground text-sm">
            <div className="w-5 h-5 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
            Carregando laudos de qualidade...
          </div>
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-card border border-dashed border-emerald-200 rounded-xl p-6 text-center text-sm text-muted-foreground">
          Nenhum laudo de qualidade emitido ainda. Emita laudos na página <strong>Qualidade</strong> para habilitar a análise.
        </div>
      ) : (
        <>
          {analyzing && findings.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-3 text-muted-foreground text-sm">
                <div className="w-5 h-5 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                Cruzando laudos, produção, paradas e manutenções...
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {sortedFindings.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {sortedFindings.map((f, i) => {
                const p = PRIORITY[f.priority] || PRIORITY.info;
                const route = PAGE_ROUTES[f.action_page] || '/quality';
                const label = PAGE_LABELS[f.action_page] || 'Qualidade';
                return (
                  <div key={i} className={`bg-card rounded-xl border border-border border-l-4 ${p.border} p-4 flex flex-col gap-2 shadow-sm`}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground">{f.category}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.badge}`}>{p.label}</span>
                    </div>
                    <p className="text-sm font-medium text-foreground leading-snug">{f.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{f.diagnosis}</p>
                    {f.parameters?.length > 0 && (
                      <ul className="text-[11px] text-muted-foreground list-disc pl-4 space-y-0.5 border-t border-border pt-2">
                        {f.parameters.map((p2, j) => <li key={j}>{p2}</li>)}
                      </ul>
                    )}
                    <button onClick={() => navigate(route)}
                      className="flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-900 transition-colors self-end">
                      {label} <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <ResistanceGrowthCard reports={reports || []} productTypes={productTypes} traces={traces} />
    </section>
  );
}