import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useOperator } from '@/lib/OperatorContext';
import { supportDesk } from '@/lib/supportClient';
import { Trash2, AlertTriangle, X, ShieldCheck, HardDriveDownload, Unlink, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function AccountDeleteSection() {
  const { user, logout } = useAuth();
  const { clearOperator } = useOperator();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [links, setLinks] = useState([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (!user?.id) { setLoadingLinks(false); return; }
    base44.entities.UserCompany.filter({ user_id: user.id, status: 'active' })
      .then(setLinks)
      .catch(() => setLinks([]))
      .finally(() => setLoadingLinks(false));
  }, [user]);

  // Cartão 1 — Limpeza local imediata + encerramento de sessão.
  // Texto fiel: remove apenas dados deste dispositivo e a sessão. NÃO remove
  // dados do servidor, vínculos nem registros operacionais.
  async function handleLocalClear() {
    setClearing(true);
    try {
      clearOperator();
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('cimentopro_') || k === 'theme') localStorage.removeItem(k);
      });
    } catch (e) {
      // ignora falhas de limpeza local
    }
    setClearing(false);
    logout(true);
  }

  // Cartão 2 — Solicitação rastreável de remoção de vínculo com UMA empresa.
  // Reusa o fluxo de suporte (auditoria + isolamento por empresa); o admin da
  // empresa processa. Não promete exclusão imediata.
  async function handleUnlinkRequest() {
    if (!selectedCompany) {
      toast({ title: 'Selecione uma empresa', variant: 'destructive' });
      return;
    }
    const link = links.find(l => l.company_id === selectedCompany);
    if (!link) return;
    setRequesting(true);
    try {
      const res = await supportDesk({
        action: 'create_ticket',
        company_id: selectedCompany,
        subject: `Solicitação de remoção de vínculo — ${link.company_name}`,
        description: `O usuário ${user?.email} solicita a remoção do seu vínculo com a empresa ${link.company_name}. Esta é uma solicitação rastreável; o processamento acontece no backend pelo administrador da empresa.`,
        category: 'USUARIOS_PERMISSOES',
        priority: 'NORMAL',
      });
      toast({ title: 'Solicitação registrada', description: `Chamado ${res?.ticket?.ticket_number ? `#${String(res.ticket.ticket_number).padStart(6, '0')}` : ''} criado.` });
      setSelectedCompany('');
    } catch (err) {
      toast({ title: 'Não foi possível registrar', description: err.response?.data?.error || err.message, variant: 'destructive' });
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-4 h-4 text-destructive" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Conta e Dados</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Escolha a ação adequada. Nenhuma opção promete exclusão imediata de dados do servidor.
          </p>
        </div>
      </div>

      {/* Cartão 1 — Limpeza local imediata */}
      <div className="border border-border rounded-xl p-5 bg-card">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <HardDriveDownload className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-foreground">Limpar dados deste dispositivo</h4>
                <span className="text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">Imediato</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 max-w-md">
                Remove o operador ativo, configurações e backups salvos <strong>neste dispositivo</strong> e encerra a sessão. Não altera dados do servidor, vínculos com empresas nem registros operacionais.
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={handleLocalClear}
          disabled={clearing}
          className="mt-4 flex items-center gap-2 border border-border text-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60"
        >
          {clearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDriveDownload className="w-4 h-4" />} Limpar e sair
        </button>
      </div>

      {/* Cartão 2 — Remoção de vínculo com empresa (rastreável) */}
      <div className="border border-border rounded-xl p-5 bg-card">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
            <Unlink className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-foreground">Solicitar remoção de vínculo com empresa</h4>
              <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">Rastreável</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              Abre uma solicitação rastreável (com protocolo) para remover seu vínculo com <strong>uma</strong> empresa selecionada. O administrador da empresa processa a solicitação no backend. Não é exclusão imediata.
            </p>
            {loadingLinks ? (
              <div className="mt-3"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
            ) : links.length === 0 ? (
              <p className="text-xs text-muted-foreground mt-3">Você não possui vínculos ativos com empresas.</p>
            ) : (
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <select
                  value={selectedCompany}
                  onChange={e => setSelectedCompany(e.target.value)}
                  className="border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Selecione a empresa…</option>
                  {links.map(l => (
                    <option key={l.company_id} value={l.company_id}>{l.company_name}</option>
                  ))}
                </select>
                <button
                  onClick={handleUnlinkRequest}
                  disabled={requesting || !selectedCompany}
                  className="flex items-center gap-2 border border-border text-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60"
                >
                  {requesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />} Solicitar remoção
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cartão 3 — Exclusão de conta via módulo LGPD (rastreável) */}
      <div className="border border-destructive/30 rounded-xl p-5 bg-destructive/5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-destructive" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-foreground">Solicitar exclusão da conta</h4>
              <span className="text-[10px] font-medium text-destructive bg-destructive/10 border border-destructive/20 rounded-full px-2 py-0.5">Rastreável (solicitação)</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              Abre uma solicitação formal no módulo de privacidade (LGPD). A exclusão <strong>não é imediata</strong>: dados sujeitos a obrigações legais, fiscais ou contratuais podem ser mantidos ou anonimizados. O resultado será informado no protocolo.
            </p>
            <button
              onClick={() => navigate('/lgpd')}
              className="mt-4 flex items-center gap-2 bg-destructive text-destructive-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-destructive/90 transition-colors"
            >
              <ShieldCheck className="w-4 h-4" /> Abrir solicitação de exclusão
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}