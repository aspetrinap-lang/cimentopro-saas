import { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Printer } from 'lucide-react';
import { aggregateAges, growthReading } from '@/lib/resistanceCurve';
import ResistanceGrowthReport from '@/components/reports/ResistanceGrowthReport';

// Cartão "Curva de Crescimento de Resistência": agrega os corpos de prova dos
// laudos por idade, com filtros coerentes de Traço × Artefato.
export default function ResistanceGrowthCard({ reports, productTypes, traces }) {
  const [artifactFilter, setArtifactFilter] = useState('all');
  const [traceFilter, setTraceFilter] = useState('all');
  const [showReport, setShowReport] = useState(false);

  const ptMap = useMemo(() => {
    const m = {};
    (productTypes || []).forEach(p => { m[p.id] = p; });
    return m;
  }, [productTypes]);

  const traceMap = useMemo(() => {
    const m = {};
    (traces || []).forEach(t => { m[t.id] = t; });
    return m;
  }, [traces]);

  // Artefatos com laudos emitidos
  const laudoArtifacts = useMemo(() => {
    const ids = new Set();
    (reports || []).forEach(r => { if (r.product_type_id) ids.add(r.product_type_id); });
    return [...ids];
  }, [reports]);

  // Coerência dos filtros: traço selecionado → só artefatos com esse traço;
  // artefato selecionado → só o traço vinculado a ele.
  const artifactOptions = useMemo(() =>
    laudoArtifacts.filter(id => traceFilter === 'all' || ptMap[id]?.concrete_trace_id === traceFilter),
  [laudoArtifacts, traceFilter, ptMap]);

  const traceOptions = useMemo(() => {
    if (artifactFilter !== 'all') {
      const t = ptMap[artifactFilter]?.concrete_trace_id;
      return t ? [t] : [];
    }
    const set = new Set();
    laudoArtifacts.forEach(id => { const t = ptMap[id]?.concrete_trace_id; if (t) set.add(t); });
    return [...set];
  }, [artifactFilter, laudoArtifacts, ptMap]);

  const filteredReports = useMemo(() => (reports || []).filter(r => {
    if (artifactFilter !== 'all' && r.product_type_id !== artifactFilter) return false;
    if (traceFilter !== 'all' && ptMap[r.product_type_id]?.concrete_trace_id !== traceFilter) return false;
    return true;
  }), [reports, artifactFilter, traceFilter, ptMap]);

  const rows = useMemo(() => aggregateAges(filteredReports), [filteredReports]);

  const target = useMemo(() => {
    const ts = filteredReports.map(r => Number(r.target_resistance) || 0).filter(v => v > 0);
    return ts.length ? +(ts.reduce((a, b) => a + b, 0) / ts.length).toFixed(1) : 0;
  }, [filteredReports]);

  const reading = useMemo(() => growthReading(rows, target, filteredReports.length), [rows, target, filteredReports]);

  function handleArtifactChange(id) {
    setArtifactFilter(id);
    if (id !== 'all' && traceFilter !== 'all' && ptMap[id]?.concrete_trace_id !== traceFilter) {
      setTraceFilter('all');
    }
  }

  function handleTraceChange(id) {
    setTraceFilter(id);
    if (id !== 'all' && artifactFilter !== 'all' && ptMap[artifactFilter]?.concrete_trace_id !== id) {
      setArtifactFilter('all');
    }
  }

  const artifactName = artifactFilter !== 'all' ? ptMap[artifactFilter]?.name || '—' : null;
  const traceName = traceFilter !== 'all' ? traceMap[traceFilter]?.name || '—' : null;

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          <div>
            <h3 className="text-sm font-bold text-foreground">Curva de Crescimento de Resistência</h3>
            <p className="text-xs text-muted-foreground">Corpos de prova agregados por idade — resistência média e fck estimado</p>
          </div>
        </div>
        <button onClick={() => setShowReport(true)} disabled={rows.length === 0}
          className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40">
          <Printer className="w-3.5 h-3.5" /> Relatório A4
        </button>
      </div>

      {/* Filtros coerentes traço × artefato */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Traço de Concreto</label>
          <select
            className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={traceFilter} onChange={e => handleTraceChange(e.target.value)}>
            <option value="all">Todos os traços</option>
            {traceOptions.map(id => (
              <option key={id} value={id}>{traceMap[id]?.name || id}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo de Artefato</label>
          <select
            className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={artifactFilter} onChange={e => handleArtifactChange(e.target.value)}>
            <option value="all">Todos os artefatos</option>
            {artifactOptions.map(id => (
              <option key={id} value={id}>{ptMap[id]?.name || id}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Gráfico */}
      {rows.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
          Nenhum corpo de prova com resultados para o filtro selecionado.
        </div>
      ) : (
        <div className="w-full h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="age_days" tick={{ fontSize: 11 }} tickFormatter={v => `${v}d`} />
              <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} width={44} />
              <Tooltip
                labelFormatter={l => `${l} dias`}
                formatter={(v, name) => [`${v} MPa`, name]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {target > 0 && (
                <ReferenceLine y={target} stroke="#ef4444" strokeDasharray="6 4"
                  label={{ value: `fck alvo ${target} MPa`, fontSize: 10, position: 'insideTopRight', fill: '#ef4444' }} />
              )}
              <Line type="monotone" dataKey="average" name="Resistência média" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="fck_est" name="fck estimado" stroke="#10b981" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Leitura técnica */}
      <p className="text-xs text-muted-foreground leading-relaxed bg-muted/40 rounded-lg p-3 border border-border">
        {reading}
      </p>

      {showReport && (
        <ResistanceGrowthReport
          rows={rows}
          target={target}
          reading={reading}
          traceName={traceName}
          artifactName={artifactName}
          reportCount={filteredReports.length}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}