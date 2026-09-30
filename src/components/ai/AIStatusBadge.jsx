// Selo do fluxo central de IA: mostra quando a análise exibida é armazenada
// ("Do cache") e a data/hora da última execução. `stale` indica que os dados
// atuais têm fingerprint diferente da análise armazenada.
import { Clock, CheckCircle2, RefreshCw } from 'lucide-react';
import { formatDateTimeBR } from '@/lib/dateFormat';

export default function AIStatusBadge({ meta, stale }) {
  if (!meta?.created_date) return null;
  const when = formatDateTimeBR(meta.created_date);
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