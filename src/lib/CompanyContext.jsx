import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { getAllowedPaths } from '@/lib/permissions';
import { isPlatformAdmin } from '@/lib/platformAdmin';
import { setPlatformAdminScope } from '@/lib/companyScope';

const CompanyContext = createContext();

// company_id ativo disponível globalmente, inclusive fora da árvore React
let activeCompanyIdGlobal = null;
export function getCurrentCompanyId() {
  return activeCompanyIdGlobal;
}

// Mapeia o papel na empresa (UserCompany) para o papel do sistema de permissões existente
const COMPANY_ROLE_TO_LEGACY = {
  owner: 'administrador',
  admin: 'administrador',
  supervisor: 'supervisor',
};

function readStoredCompanyId(userId) {
  try {
    return localStorage.getItem(`cimentopro:active-company:${userId}`);
  } catch {
    return null;
  }
}

function storeCompanyId(userId, companyId) {
  try {
    if (companyId) localStorage.setItem(`cimentopro:active-company:${userId}`, companyId);
    else localStorage.removeItem(`cimentopro:active-company:${userId}`);
  } catch {
    /* armazenamento indisponível — ignora */
  }
}

export const CompanyProvider = ({ children }) => {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const [memberships, setMemberships] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [currentCompanyId, setCurrentCompanyId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activatedInvites, setActivatedInvites] = useState([]);

  const applyCompanyId = useCallback((companyId) => {
    activeCompanyIdGlobal = companyId;
    setCurrentCompanyId(companyId);
    if (user?.id) storeCompanyId(user.id, companyId);
  }, [user?.id]);

  // Logout / usuário não autenticado: limpa o contexto de empresa
  useEffect(() => {
    if (!isLoadingAuth && !user) {
      setMemberships([]);
      setCompanies([]);
      setActivatedInvites([]);
      setCurrentCompanyId(null);
      activeCompanyIdGlobal = null;
    }
  }, [isLoadingAuth, user]);

  // Login: identifica o usuário autenticado e busca as empresas associadas (UserCompany)
  useEffect(() => {
    if (isLoadingAuth || !user || !isAuthenticated) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        // Convite direto: ativa os convites pendentes enviados a este e-mail
        // ANTES de carregar as empresas — o primeiro acesso já entra vinculado.
        let activated = [];
        try {
          const res = await base44.functions.invoke('companyMembers', { action: 'activateInvites' });
          activated = res.data?.activated || [];
        } catch { /* sem convites pendentes — segue o fluxo normal */ }
        setActivatedInvites(activated);
        // Vínculos e empresas vêm do backend (acesso de serviço): não dependem
        // do cache de empresas embutido na sessão, que pode estar desatualizado.
        let activeMbs = [];
        let selectable = [];
        try {
          const res = await base44.functions.invoke('companyMembers', { action: 'myCompanies' });
          activeMbs = res.data?.memberships || [];
          selectable = res.data?.companies || [];
        } catch { /* sem vínculos legíveis — segue com lista vazia */ }
        // Sincroniza o cache de empresas na própria sessão pelo caminho oficial
        // da plataforma (dados do usuário): RLS e consultas passam a enxergar o
        // vínculo já neste acesso, sem precisar sair e entrar novamente.
        try {
          await base44.auth.updateMe({ company_ids: [...new Set(activeMbs.map((m) => m.company_id))] });
        } catch { /* indisponível — o próximo acesso sincroniza */ }
        if (cancelled) return;
        setMemberships(activeMbs);
        setCompanies(selectable);
        if (selectable.length === 1) {
          // Uma única empresa: seleção automática
          applyCompanyId(selectable[0].id);
        } else if (selectable.length > 1) {
          // Múltiplas empresas: restaura a última escolhida ou aguarda seleção
          const stored = readStoredCompanyId(user.id);
          applyCompanyId(selectable.some((c) => c.id === stored) ? stored : null);
        } else {
          // Usuário sem empresa
          applyCompanyId(null);
        }
      } catch {
        if (!cancelled) {
          setMemberships([]);
          setCompanies([]);
          applyCompanyId(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isLoadingAuth, user, isAuthenticated, applyCompanyId]);

  // Seleção de empresa (estrutura pronta para o seletor da próxima etapa)
  const selectCompany = useCallback((companyId) => {
    if (!companies.some((c) => c.id === companyId)) return false;
    applyCompanyId(companyId);
    return true;
  }, [companies, applyCompanyId]);

  const currentCompany = companies.find((c) => c.id === currentCompanyId) || null;
  const currentMembership = memberships.find((m) => m.company_id === currentCompanyId) || null;
  const currentRole = currentMembership?.role || user?.role || null;
  // Convites recém-ativados cuja empresa não carrega nesta sessão: o token foi
  // emitido antes do vínculo existir — basta sair e entrar novamente.
  const sessionRefreshNeeded = memberships.length > 0 && companies.length === 0;
  const legacyRole = currentMembership
    ? (COMPANY_ROLE_TO_LEGACY[currentMembership.role] || currentMembership.role)
    : user?.role;
  const permissions = getAllowedPaths(legacyRole || 'user');

  // Mantém o escopo global (scopedFilter) ciente do SUPER_ADMIN —
  // consultas fora da árvore React preservam a visão de plataforma dele.
  setPlatformAdminScope(isPlatformAdmin(user));

  return (
    <CompanyContext.Provider value={{
      companies,            // empresas às quais o usuário pertence
      memberships,          // vínculos UserCompany ativos
      currentCompany,       // empresa ativa (objeto Company)
      currentCompanyId,     // id da empresa ativa
      currentUser: user,     // usuário autenticado
      currentRole,          // papel na empresa ativa (ou papel da plataforma)
      permissions,          // rotas permitidas (mesma base do sistema atual)
      loading,              // carregando vínculos/empresas
      hasCompany: companies.length > 0,
      activatedInvites,      // convites ativados nesta sessão
      sessionRefreshNeeded,  // convite ativado, mas o token não enxerga a empresa ainda
      needsCompanySelection: isAuthenticated && companies.length > 1 && !currentCompanyId,
      selectCompany,        // seleciona a empresa ativa
      clearCompany: () => applyCompanyId(null),
    }}>
      {children}
    </CompanyContext.Provider>
  );
};

export const useCompany = () => {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be used within a CompanyProvider');
  return ctx;
};