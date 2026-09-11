import { useEffect, useState } from 'react';
import { scopedFilter } from '@/lib/companyScope';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { INSUMO_KEYS, INSUMO_FIELDS } from '@/lib/insumos';
import { analyzeConsumptionByArtifact, mergeAnalyses } from '@/lib/consumptionEngine';
import { Bot, RefreshCw, ChevronRight, AlertCircle, Sparkles } from 'lucide-react';

const PRIORITY = {
  critical: { label: 'Crítico', badge: 'bg-red-100 text-red-700',    border: 'border-l-red-500' },
  high:     { label: 'Alto',    badge: 'bg-orange-100 text-orange-700', border: 'border-l-orange-500' },
  medium:   { label: 'Médio',   badge: 'bg-amber-100 text-amber-700',  border: 'border-l-amber-500' },
  info:     { label: 'Info',    badge: 'bg-blue-100 text-blue-700',    border: 'border-l-blue-500' },
};

const PAGE_ROUTES = {
  machines: '/machines', maintenance: '/maintenance', history: '/history',
  analysis: '/analysis', orders: '/orders', molds: '/molds', settings: '/settings',
};
const PAGE_LABELS = {
  machines: 'Máquinas', maintenance: 'Manutenção', history: 'Histórico',
  analysis: 'Análise', orders: 'Ordens', molds: 'Moldes', settings: 'Configurações',
};

function buildSummary(orders, downtimes, costs, names, productTypesById) {
  const concluded = orders.filter(o => o.status === 'Concluída');
  let s = '';
  s += `TOTAL: ${orders.length} ordens (${concluded.length} concluídas).\n\n`;

  // Motor de consumo: esperado p/ a produção boa vs real — nunca planejado × real
  const analyses = analyzeConsumptionByArtifact(concluded, productTypesById);
  const merged = mergeAnalyses(analyses);
  if (merged) {
    const f = merged.flow;
    s += `PRODUÇÃO (base do consumo): bruta ${Math.round(f.gross)} peças | refugo ${Math.round(f.refugo)} peças (${f.refugoPct.toFixed(1)}%) | boa (aprovada) ${Math.round(f.good)} peças\n\n`;
    s += 'CONSUMO — esperado para a produção boa vs real, consumo específico por 1.000 peças e por m³:\n';
    merged.rows.forEach(r => {
      const label = names[r.key] || (r.key === 'water' ? 'Água' : r.key);
      s += `- ${label}: esperado ${r.expected.toFixed(0)}${r.unit} | real ${r.actual.toFixed(0)}${r.unit}`;
      if (r.deviationPct != null) s += ` | desvio ${r.deviationPct >= 0 ? '+' : ''}${r.deviationPct.toFixed(1)}%`;
      else s += ' | SEM padrão cadastrado no artefato';
      if (r.per1000 != null) s += ` | ${r.per1000.toFixed(1)}${r.unit}/1.000 peças`;
      if (r.perM3 != null) s += ` | ${r.perM3.toFixed(1)}${r.unit}/m³`;
      s += '\n';
    });
    if (merged.confidence !== 'alta') {
      s += `\nCONFIABILIDADE DA ANÁLISE: ${merged.confidence.toUpperCase()} — insumos sem traço/padrão cadastrado reduzem a confiabilidade.\n`;
    }
    s += '\n';
  }

  // Machine efficiency + downtime
  const byMachine = {};
  concluded.forEach(o => {
    if (!o.machine_name) return;
    if (!byMachine[o.machine_name]) byMachine[o.machine_name] = { planned: 0, actual: 0, orders: 0, minutes: 0, downtime: 0 };
    byMachine[o.machine_name].planned += o.planned_quantity || 0;
    byMachine[o.machine_name].actual += o.actual_quantity || 0;
    byMachine[o.machine_name].orders += 1;
    byMachine[o.machine_name].minutes += o.production_minutes || 0;
  });
  downtimes.forEach(d => {
    const m = d.machine_name; if (!m) return;
    if (!byMachine[m]) byMachine[m] = { planned: 0, actual: 0, orders: 0, minutes: 0, downtime: 0 };
    byMachine[m].downtime = (byMachine[m].downtime || 0) + (d.duration_minutes || 0);
  });
  s += 'MÁQUINAS (eficiência = real/planejado):\n';
  Object.entries(byMachine).forEach(([name, d]) => {
    const eff = d.planned > 0 ? ((d.actual / d.planned) * 100).toFixed(1) : '—';
    s += `- ${name}: eficiência ${eff}%, ${d.orders} ordens, ${d.actual} un produzidas, ${d.minutes} min produção, ${d.downtime} min parada\n`;
  });

  // Proporções do traço por artefato (real vs padrão)
  analyses.forEach(a => {
    const p = a.proportions;
    const lines = [];
    if (p.cementAggregate.actual != null) lines.push(`Cimento/Agregados ${p.cementAggregate.actual.toFixed(3)} (padrão ${p.cementAggregate.standard != null ? p.cementAggregate.standard.toFixed(3) : '—'})`);
    if (p.aggregateCement.actual != null) lines.push(`Agregado total/Cimento ${p.aggregateCement.actual.toFixed(3)} (padrão ${p.aggregateCement.standard != null ? p.aggregateCement.standard.toFixed(3) : '—'})`);
    if (p.waterCement.actual != null) lines.push(`Água/Cimento ${p.waterCement.actual.toFixed(3)} (padrão ${p.waterCement.standard != null ? p.waterCement.standard.toFixed(3) : '—'})`);
    if (p.sandAggregate.actual != null) lines.push(`Areia/Agregado total ${p.sandAggregate.actual.toFixed(3)} (padrão ${p.sandAggregate.standard != null ? p.sandAggregate.standard.toFixed(3) : '—'})`);
    if (lines.length > 0) {
      s += `\nPROPORÇÕES DO TRAÇO — ${a.artifactName} (real vs padrão):\n`;
      lines.forEach(l => { s += `- ${l}\n`; });
    }
  });

  // Downtime by category
  const dtByCat = {};
  let totalDT = 0;
  downtimes.forEach(d => {
    const c = d.failure_category || 'Outros';
    dtByCat[c] = (dtByCat[c] || 0) + (d.duration_minutes || 0);
    totalDT += d.duration_minutes || 0;
  });
  s += `\nPARADAS: ${totalDT} min total, ${downtimes.length} ocorrências.\n`;
  Object.entries(dtByCat).sort((a, b) => b[1] - a[1]).forEach(([c, m]) => {
    s += `- ${c}: ${m} min\n`;
  });

  // Production by product with cost
  const byProd = {};
  concluded.forEach(o => {
    const n = o.product_type_name || 'Desconhecido';
    if (!byProd[n]) byProd[n] = { qty: 0, cost: 0 };
    byProd[n].qty += o.actual_quantity || 0;
    INSUMO_KEYS.forEach(k => {
      byProd[n].cost += (o[INSUMO_FIELDS[k].actual] || 0) * (costs[k] || 0);
    });
  });
  s += '\nPRODUTOS (quantidade e custo/un):\n';
  Object.entries(byProd).sort((a, b) => b[1].qty - a[1].qty).forEach(([n, d]) => {
    const uc = d.qty > 0 ? (d.cost / d.qty).toFixed(2) : '—';
    s += `- ${n}: ${d.qty} un, R$ ${uc}/un\n`;
  });

  // Historical comparison — consumo específico (kg/1.000 peças boas)
  if (concluded.length >= 4) {
    const sorted = [...concluded].sort((a, b) => (a.production_date || '').localeCompare(b.production_date || ''));
    const mid = Math.floor(sorted.length / 2);
    const older = sorted.slice(0, mid);
    const recent = sorted.slice(mid);
    const avgEff = arr => {
      const e = arr.filter(o => o.planned_quantity > 0).map(o => (o.actual_quantity || 0) / o.planned_quantity * 100);
      return e.length > 0 ? (e.reduce((a, b) => a + b, 0) / e.length).toFixed(1) : null;
    };
    const specCement = arr => {
      const good = arr.reduce((sm, o) => sm + Math.max((Number(o.actual_quantity) || 0) - (Number(o.loss_second_line) || 0) - (Number(o.loss_discarded) || 0), 0), 0);
      const cem = arr.reduce((sm, o) => sm + (Number(o.actual_cement) || 0), 0);
      return good > 0 ? (cem / good) * 1000 : null;
    };
    s += '\nHISTÓRICO (período anterior → recente):\n';
    const oEff = avgEff(older), rEff = avgEff(recent);
    if (oEff && rEff) s += `- Eficiência média: ${oEff}% → ${rEff}%\n`;
    const oCem = specCement(older), rCem = specCement(recent);
    if (oCem != null && rCem != null) s += `- Consumo específico de cimento: ${oCem.toFixed(1)} → ${rCem.toFixed(1)} kg/1.000 peças boas\n`;
  }

  return s;
}

export default function VirtualEngineer({ orders, costs, names, productTypesById }) {
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [downtimes, setDowntimes] = useState([]);
  const [machines, setMachines] = useState([]);
  const [autoTriggered, setAutoTriggered] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.entities.MachineDowntime.filter(scopedFilter({}), '-date', 500),
      base44.entities.Machine.filter(scopedFilter({}), 'name'),
    ]).then(([d, m]) => { setDowntimes(d); setMachines(m); });
  }, []);

  async function analyze() {
    if (orders.length === 0) return;
    setAnalyzing(true);
    setError(null);
    try {
      const summary = buildSummary(orders, downtimes, costs, names, productTypesById);
      const prompt = `Você é o "Engenheiro Virtual", um assistente de IA especializado em análise de fábricas de artefatos de cimento.
Analise os dados abaixo e emita recomendações automáticas, práticas e acionáveis.

METODOLOGIA OBRIGATÓRIA DE CONSUMO:
1. Compare SEMPRE o consumo REAL com o "esperado para a produção boa" (já calculado nos dados). NUNCA compare com o consumo planejado.
2. NUNCA conclua "economia de material" porque o consumo real ficou abaixo do planejado — produção menor naturalmente consome menos. Uma redução de consumo só pode ser classificada como "possível otimização" quando produção, refugo e qualidade seguem estáveis; caso contrário, recomende investigação do processo.
3. O indicador principal de consumo é o específico por 1.000 peças (e por m³, quando disponível). Use-o para avaliar o comportamento do processo.
4. Nas recomendações, diferencie FATO (desvio medido), PADRÃO (eventos simultâneos) e HIPÓTESE ("os dados indicam possível associação — recomenda-se investigar"). Nunca apresente hipótese como fato e nunca afirme causalidade.
5. Insumos marcados "SEM padrão cadastrado" devem gerar recomendação de cadastrar o traço no artefato.

Analise continuamente:
1. Consumo de insumos (desvios do esperado para a produção boa, consumo específico fora do comportamento)
2. Proporções do traço (cimento/agregados, água/cimento, areia/agregado) frente ao padrão cadastrado
3. Eficiência das máquinas (quedas de performance, máquinas abaixo do esperado)
4. Custos (produtos mais caros, desperdícios com impacto financeiro)
5. Tempo de parada (máquinas com mais paradas, categorias frequentes)
6. Histórico (tendências entre períodos, com base no consumo específico)

Exemplos do tom e estilo esperado:
- "O consumo específico de cimento está 7% acima do esperado para a produção realizada."
- "Os dados indicam possível associação entre a queda da relação cimento/agregados e o aumento de refugo — recomenda-se investigar a dosagem."

Para cada recomendação, retorne:
- priority: "critical", "high", "medium" ou "info"
- category: categoria da análise (ex: "Consumo", "Traço", "Máquinas", "Custos", "Paradas", "Produção", "Histórico")
- title: título curto (máx 5 palavras)
- text: descrição em linguagem natural, 1-2 frases em português
- action_page: página recomendada para ação ("machines", "maintenance", "history", "analysis", "orders", "molds", "settings")

Gere entre 4 e 8 recomendações, priorizando as mais urgentes.

DADOS:
${summary}`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            recommendations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  priority: { type: 'string' },
                  category: { type: 'string' },
                  title: { type: 'string' },
                  text: { type: 'string' },
                  action_page: { type: 'string' },
                },
              },
            },
          },
        },
      });
      setRecommendations(res.recommendations || []);
    } catch (e) {
      setError('Não foi possível gerar recomendações agora. Tente novamente.');
    }
    setAnalyzing(false);
  }

  // Auto-analyze when data is ready
  useEffect(() => {
    if (orders.length > 0 && machines.length > 0 && !autoTriggered && !analyzing) {
      setAutoTriggered(true);
      analyze();
    }
  }, [orders, machines, autoTriggered, analyzing]);

  const sortedRecs = [...recommendations].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, info: 3 };
    return (order[a.priority] ?? 9) - (order[b.priority] ?? 9);
  });

  return (
    <section className="bg-gradient-to-br from-indigo-50 via-white to-blue-50 rounded-2xl border border-indigo-100 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-1.5">
              Engenheiro Virtual
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            </h2>
            <p className="text-xs text-muted-foreground">IA analisa eficiência, consumo, custos, paradas, produção e histórico</p>
          </div>
        </div>
        <button onClick={analyze} disabled={analyzing || orders.length === 0}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${analyzing ? 'animate-spin' : ''}`} />
          {analyzing ? 'Analisando...' : 'Analisar'}
        </button>
      </div>

      {analyzing && recommendations.length === 0 && (
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-3 text-muted-foreground text-sm">
            <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            Analisando indicadores de produção...
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {sortedRecs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {sortedRecs.map((rec, i) => {
            const p = PRIORITY[rec.priority] || PRIORITY.info;
            const route = PAGE_ROUTES[rec.action_page] || '/analysis';
            const label = PAGE_LABELS[rec.action_page] || 'Análise';
            return (
              <div key={i} className={`bg-card rounded-xl border border-border border-l-4 ${p.border} p-4 flex flex-col gap-2 shadow-sm`}>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold text-foreground">{rec.category}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.badge}`}>{p.label}</span>
                </div>
                <p className="text-sm font-medium text-foreground leading-snug">{rec.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed flex-1">{rec.text}</p>
                <button onClick={() => navigate(route)}
                  className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors self-end">
                  {label} <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}