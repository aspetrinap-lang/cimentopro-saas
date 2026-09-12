import { AlertTriangle, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

// Tela de bloqueio integral: assinatura da empresa vencida, suspensa ou
// cancelada. Nenhum dado operacional é apagado — o acesso volta assim que a
// assinatura for regularizada pela administração da plataforma.
const REASONS = {
  expired: {
    title: 'Assinatura vencida',
    message: 'A assinatura do CimentoPro da sua empresa venceu. Nenhum dado foi apagado — o acesso volta assim que a assinatura for renovada.',
  },
  past_due: {
    title: 'Assinatura vencida',
    message: 'A assinatura do CimentoPro da sua empresa venceu. Nenhum dado foi apagado — o acesso volta assim que a assinatura for renovada.',
  },
  suspended: {
    title: 'Acesso suspenso',
    message: 'O acesso da sua empresa está temporariamente suspenso pela administração da plataforma. Nenhum dado foi apagado.',
  },
  cancelled: {
    title: 'Assinatura cancelada',
    message: 'A assinatura da sua empresa foi cancelada. Seus dados continuam salvos e preservados.',
  },
};

export default function BlockedSubscriptionScreen({ reason, plan, subscription }) {
  const { logout } = useAuth();
  const info = REASONS[reason] || REASONS.expired;
  const endDate = subscription?.end_date
    ? new Date(`${subscription.end_date}T00:00:00`).toLocaleDateString('pt-BR')
    : null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 text-center shadow-sm">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-destructive/10 mb-4">
          <AlertTriangle className="w-7 h-7 text-destructive" />
        </div>
        <h1 className="text-lg font-bold text-foreground">{info.title}</h1>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          {info.message} Contate a administração da plataforma CimentoPro para regularizar o acesso da sua empresa.
        </p>
        {plan?.name && (
          <p className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted rounded-full px-3 py-1">
            Plano <strong className="text-foreground font-medium">{plan.name}</strong>
            {endDate && <> · vencimento em {endDate}</>}
          </p>
        )}
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