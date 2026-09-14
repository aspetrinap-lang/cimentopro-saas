import { Building2 } from 'lucide-react';
import { useCompany } from '@/lib/CompanyContext';

// Identificação discreta da empresa ativa (logotipo pequeno + nome em texto)
// para cabeçalhos de relatórios e impressões. Sem logotipo cadastrado mostra
// apenas o nome; sem empresa ativa não renderiza nada.
export default function CompanyBrand({ className = '' }) {
  const { currentCompany } = useCompany();
  if (!currentCompany) return null;
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {currentCompany.logo_url ? (
        <img src={currentCompany.logo_url} alt={currentCompany.name} className="h-7 w-7 object-contain shrink-0" />
      ) : (
        <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
      )}
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 truncate">{currentCompany.name}</span>
    </div>
  );
}