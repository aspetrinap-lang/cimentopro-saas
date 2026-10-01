import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, ChevronDown, ChevronRight, AlertTriangle, ArrowLeft } from 'lucide-react';
import { getActiveNotice } from '@/lib/privacyClient';

const PENDING_LABEL = 'PENDENTE — a definir pelo controlador';

function Pending() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5">
      <AlertTriangle className="w-3 h-3" /> {PENDING_LABEL}
    </span>
  );
}

function Section({ title, items, emptyLabel }) {
  const [open, setOpen] = useState(true);
  if (!items || items.length === 0) {
    return (
      <div className="border border-border rounded-xl overflow-hidden">
        <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 py-4 bg-muted/30 hover:bg-muted/50 transition-colors">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </button>
        {open && (
          <div className="px-5 py-4">
            <Pending />
            <p className="text-xs text-muted-foreground mt-2">{emptyLabel || 'Sem informações cadastradas.'}</p>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 py-4 bg-muted/30 hover:bg-muted/50 transition-colors">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-5 py-4 space-y-2">
          {items.map((it, i) => (
            <div key={i} className="text-sm text-foreground">
              {it.title && <p className="font-medium">{it.title}</p>}
              {it.description && <p className="text-muted-foreground">{it.description}</p>}
              {it.detail && <p className="text-xs text-muted-foreground mt-0.5">{it.detail}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Privacy() {
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getActiveNotice()
      .then((data) => setNotice(data?.notice || null))
      .catch(() => setNotice(null))
      .finally(() => setLoading(false));
  }, []);

  const content = notice?.content || {};
  const hasContent = notice && (content.categories?.length || content.purposes?.length || content.legal_bases?.length);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-12">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar ao aplicativo
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Aviso de Privacidade</h1>
            <p className="text-sm text-muted-foreground">CimentoPro — Plataforma de Gestão Industrial</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-4 border-muted border-t-primary rounded-full animate-spin" />
          </div>
        ) : !hasContent ? (
          <div className="mt-6 border border-amber-200 bg-amber-50 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Aviso em construção</p>
                <p className="text-xs text-amber-700 mt-1">
                  O aviso de privacidade ainda não foi publicado pelo controlador. As informações abaixo estão pendentes e serão preenchidas após validação dos responsáveis. Nenhum dado jurídico ou contratual é inventado pelo sistema.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 mt-4 mb-6 text-xs text-muted-foreground">
              {notice.version && <span className="bg-muted px-2.5 py-1 rounded-full font-medium">Versão {notice.version}</span>}
              {notice.effective_date && <span>Vigência: {new Date(notice.effective_date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
              {notice.published_at && <span>Publicado em {new Date(notice.published_at).toLocaleDateString('pt-BR')}</span>}
            </div>

            <div className="space-y-4">
              <Section title="Controlador e Encarregado (DPO)" items={[
                content.controller ? { title: 'Controlador', description: content.controller } : null,
                content.dpo ? { title: 'Encarregado (DPO)', description: content.dpo } : null,
              ].filter(Boolean)} emptyLabel="Os dados do controlador e do encarregado serão divulgados após definição." />

              <Section title="Categorias de Dados Pessoais" items={content.categories} emptyLabel="As categorias de dados coletados serão detalhadas pelo controlador." />
              <Section title="Finalidades do Tratamento" items={content.purposes} emptyLabel="As finalidades serão detalhadas pelo controlador." />
              <Section title="Bases Legais" items={content.legal_bases} emptyLabel="As bases legais serão indicadas pelo controlador." />
              <Section title="Retenção e Descarte" items={content.retention} emptyLabel="A política de retenção está pendente — o mecanismo de descarte permanece desativado por padrão até aprovação do controlador." />
              <Section title="Fornecedores e Subprocessadores" items={content.vendors} emptyLabel="Os fornecedores que recebem dados pessoais serão documentados pelo controlador." />
              <Section title="Contatos e Canal do Titular" items={content.contacts} emptyLabel="Os canais de contato serão divulgados após definição." />
            </div>
          </>
        )}

        <div className="mt-10 border-t border-border pt-6 text-xs text-muted-foreground space-y-2">
          <p>
            Este aviso é uma evidência técnica da configuração da plataforma. Decisões jurídicas e contratuais permanecem pendentes até validação dos responsáveis. O sistema não emite declaração de conformidade à LGPD.
          </p>
          <p>
            Para exercer seus direitos como titular (acesso, correção, portabilidade, exclusão), acesse o <Link to="/lgpd" className="text-primary hover:underline">módulo de privacidade</Link> após o login.
          </p>
        </div>
      </div>
    </div>
  );
}