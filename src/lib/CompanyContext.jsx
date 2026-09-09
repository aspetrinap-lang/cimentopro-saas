import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { getAllowedPaths } from '@/lib/permissions';

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

const SELECTABLE_COMPANY_STATUS = ['active', 'trial'];

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
        const all = await base44.entities.UserCompany.filter({ user_id: user.id });
        const activeMbs = (all || []).filter((m) => m.status === 'active');
        const ids = [...new Set(activeMbs.map((m) => m.company_id))];
        const comps = ids.length
          ? (await Promise.all(ids.map((id) => base44.entities.Company.get(id).catch(() => null)))).filter(Boolean)
          : [];
        const selectable = comps.filter((c) => SELECTABLE_COMPANY_STATUS.includes(c.status));
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
  const legacyRole = currentMembership
    ? (COMPANY_ROLE_TO_LEGACY[currentMembership.role] || currentMembership.role)
    : user?.role;
  const permissions = getAllowedPaths(legacyRole || 'user');

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