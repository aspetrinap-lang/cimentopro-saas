import { Building2, LogOut, MailCheck, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useCompany } from '@/lib/CompanyContext';

// Tela de bloqueio para usuário autenticado sem vínculo empresarial.
// Nenhuma página operacional monta (nem consulta dados) enquanto ativa.
export default function NoCompanyScreen() {
  const { user, logout } = useAuth();
  const { sessionRefreshNeeded, activatedInvites } = useCompany();

  // Convite direto: o vínculo foi ativado neste acesso, mas o token da sessão
  // foi emitido antes dele existir — sair e entrar novamente resolve.
  if (sessionRefreshNeeded) {
    const names = activatedInvites.map((a) => a.company_name).join(', ');
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 text-center shadow-sm">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
            <MailCheck className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-lg font-bold text-foreground">Convite ativado!</h1>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Sua conta <span className="font-medium text-foreground">{user?.email}</span> foi vinculada a
            <span className="font-medium text-foreground"> {names || 'sua empresa'}</span>.
            Para o acesso entrar em vigor, entre novamente com seu e-mail e senha.
          </p>
          <button
            onClick={() => logout(true)}
            className="mt-6 w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Entrar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 text-center shadow-sm">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
          <Building2 className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-lg font-bold text-foreground">Nenhuma empresa vinculada</h1>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Sua conta <span className="font-medium text-foreground">{user?.email}</span> ainda não está vinculada a nenhuma
          empresa. Contate o administrador da plataforma CimentoPro para receber acesso.
        </p>
        <button
          onClick={() => logout(true)}
          className="mt-6 w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <LogOut className="w-4 h-4" /> Sair
        </button>
      </div>
    </div>
  );
}