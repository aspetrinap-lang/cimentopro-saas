import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Database } from 'lucide-react';

const ACCENT_ACTION = {
  indigo: 'text-indigo-600 hover:text-indigo-800',
  emerald: 'text-emerald-700 hover:text-emerald-900',
};

// Card de recomendação/achado do Engenheiro Virtual e da Análise de Qualidade.
// Clique expande o card inline (sem sair da página) mostrando a origem
// determinística dos dados: contadores da análise executada + data_source
// gerado pela IA. Clique novamente recolhe. Análises antigas em cache, sem
// data_source, exibem apenas a evidência atual.
export default function RecommendationCard({
  item, priorityMap, evidenceLabels, route, label,
  accent = 'indigo', originLines = [], dataSource,
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const p = priorityMap[item.priority] || priorityMap.info;
  const text = item.text || item.diagnosis;
  const hasOrigin = Boolean(dataSource) || originLines.length > 0;

  return (
    <div
      onClick={() => hasOrigin && setOpen(o => !o)}
      className={`bg-card rounded-xl border border-border border-l-4 ${p.border} p-4 flex flex-col gap-2 shadow-sm transition-shadow ${
        hasOrigin ? 'cursor-pointer hover:shadow-md' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold text-foreground">{item.category}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.badge}`}>{p.label}</span>
          {hasOrigin && (
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          )}
        </div>
      </div>

      <p className="text-sm font-medium text-foreground leading-snug">{item.title}</p>
      <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>

      {(item.evidence_type || item.evidence) && (
        <p className="text-[10px] text-muted-foreground border-t border-border pt-2">
          {item.evidence_type && (
            <span className="font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 mr-1.5">
              {evidenceLabels[item.evidence_type] || item.evidence_type}{item.confidence ? ` · ${item.confidence}` : ''}
            </span>
          )}
          {item.evidence ? `Evidência: ${item.evidence}` : ''}
        </p>
      )}

      {item.parameters?.length > 0 && (
        <ul className="text-[11px] text-muted-foreground list-disc pl-4 space-y-0.5 border-t border-border pt-2">
          {item.parameters.map((param, j) => <li key={j}>{param}</li>)}
        </ul>
      )}

      {open && hasOrigin && (
        <div className="border-t border-border pt-2.5 mt-0.5 bg-muted/40 rounded-lg p-2.5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
            <Database className="w-3.5 h-3.5 text-muted-foreground" />
            De onde veio a informação
          </div>
          {dataSource && (
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">Origem: </span>{dataSource}
            </p>
          )}
          <ul className="text-[11px] text-muted-foreground space-y-0.5">
            {originLines.map((line, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="text-muted-foreground/50">·</span>
                <span className="leading-relaxed">{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={(e) => { e.stopPropagation(); navigate(route); }}
        className={`flex items-center gap-1 text-xs font-medium transition-colors self-end ${ACCENT_ACTION[accent] || ACCENT_ACTION.indigo}`}
      >
        {label} <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  );
}