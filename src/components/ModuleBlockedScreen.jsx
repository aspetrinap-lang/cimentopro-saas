import { Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Bloqueio de módulo fora do plano vigente — cobre o acesso direto pela URL
// (o menu lateral já omite o módulo).
export default function ModuleBlockedScreen({ plan, fallbackPath }) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-4">
          <Lock className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-base font-bold text-foreground">Módulo não incluído no plano</h1>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          {plan?.name
            ? `O plano ${plan.name}, vigente para a sua empresa, não inclui este módulo.`
            : 'O plano vigente para a sua empresa não inclui este módulo.'}
          {' '}Contate a administração da plataforma CimentoPro para ampliar seu plano.
        </p>
        <button
          onClick={() => navigate(fallbackPath || '/')}
          className="mt-5 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Voltar
        </button>
      </div>
    </div>
  );
}