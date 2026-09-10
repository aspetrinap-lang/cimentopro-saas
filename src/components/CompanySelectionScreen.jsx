import { Building2, Factory } from 'lucide-react';
import { useCompany } from '@/lib/CompanyContext';

// Seleção da empresa ativa para usuários com múltiplos vínculos legítimos.
// Lista apenas as empresas dos vínculos UserCompany ativos do usuário
// (selectCompany valida a posse antes de aplicar).
export default function CompanySelectionScreen() {
  const { companies, selectCompany } = useCompany();

  function handleSelect(companyId) {
    if (selectCompany(companyId)) {
      // Recarrega para que todas as telas busquem com a nova empresa ativa
      window.location.reload();
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-6 justify-center">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <Factory className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-sm text-foreground">CimentoPro</p>
            <p className="text-xs text-muted-foreground">Selecione a empresa para entrar</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-3 space-y-1.5 shadow-sm">
          {companies.map((c) => (
            <button
              key={c.id}
              onClick={() => handleSelect(c.id)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                {(c.city || c.state) && (
                  <p className="text-xs text-muted-foreground truncate">
                    {[c.city, c.state].filter(Boolean).join(' — ')}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}