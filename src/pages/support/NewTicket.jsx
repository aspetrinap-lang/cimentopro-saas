import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, LifeBuoy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TicketForm from '@/components/support/TicketForm';
import { useCompany } from '@/lib/CompanyContext';
import { activeCompanyId } from '@/lib/companyScope';
import { captureSupportContext, moduleLabelForPath } from '@/lib/supportContextCapture';

// Abertura de chamado — contexto (módulo, página, navegador, versão) é
// capturado automaticamente; o usuário só descreve o problema.
export default function NewTicket() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { currentCompany } = useCompany();
  const companyId = activeCompanyId();

  const reportedPage = params.get('page') && params.get('page') !== '/suporte/novo' ? params.get('page') : null;
  const context = captureSupportContext(reportedPage || '/suporte/novo');
  if (reportedPage) context.source = 'ERROR_REPORT';

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-6 md:py-10">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5 mb-4 text-muted-foreground">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Button>
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <LifeBuoy className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">Abrir Chamado</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          {reportedPage
            ? `Relato para o módulo: ${moduleLabelForPath(reportedPage)}.`
            : 'Descreva sua solicitação — a equipe de suporte será notificada.'}
          {currentCompany ? ` Empresa: ${currentCompany.name}.` : ''}
        </p>
        {!companyId ? (
          <p className="text-sm text-red-600">Nenhuma empresa ativa selecionada — selecione uma empresa para abrir o chamado.</p>
        ) : (
          <TicketForm
            companyId={companyId}
            context={context}
            onCreated={(ticket) => navigate(`/suporte/chamado/${ticket.id}`)}
          />
        )}
      </div>
    </div>
  );
}