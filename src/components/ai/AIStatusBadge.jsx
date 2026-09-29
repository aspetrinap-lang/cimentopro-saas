// Selo do fluxo central de IA: mostra quando a análise exibida é armazenada
// ("Do cache") e a data/hora da última execução. `stale` indica que os dados
// atuais têm fingerprint diferente da análise armazenada.
import { Clock, CheckCircle2, RefreshCw } from 'lucide-react';

export default function AIStatusBadge({ meta, stale }) {
  if (!meta?.created_date) return null;
  const d = new Date(meta.created_date);
  const when = `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  return (
    <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
      <Clock className="w-3 h-3" />
      <span>Última análise: {when}</span>
      {meta.cached && (
        <span className="flex items-center gap-1 text-emerald-600 font-medium">
          <CheckCircle2 className="w-3 h-3" /> Do cache
        </span>
      )}
      {stale && (
        <span className="flex items-center gap-1 text-amber-600 font-medium">
          <RefreshCw className="w-3 h-3" /> Dados atualizados desde a análise
        </span>
      )}
    </div>
  );
}