import { Building2 } from 'lucide-react';
import { useCompany } from '@/lib/CompanyContext';

// Seletor da empresa ativa (multi-tenant).
// Exibido apenas quando há mais de uma empresa selecionável.
export default function CompanySelector() {
  const { companies, currentCompanyId, selectCompany } = useCompany();
  if (!companies || companies.length < 2) return null;

  function handleChange(e) {
    if (selectCompany(e.target.value)) {
      // Recarrega para que todas as telas busquem com a nova empresa ativa
      window.location.reload();
    }
  }

  return (
    <div className="px-4 pt-3">
      <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/40 mb-1">
        <Building2 className="w-3 h-3" /> Empresa ativa
      </label>
      <select
        value={currentCompanyId || ''}
        onChange={handleChange}
        className="w-full rounded-lg bg-white/10 border border-white/15 px-2 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/30"
      >
        {!currentCompanyId && <option value="">Selecione...</option>}
        {companies.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </div>
  );
}