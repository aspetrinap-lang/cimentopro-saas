import React, { createContext, useContext, useMemo, useCallback, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useCompany } from '@/lib/CompanyContext';
import { useOperator } from '@/lib/OperatorContext';
import { ROLE_GRANTS, PLATFORM_GRANTS, resolvePermissions, permissionsToPaths } from '@/lib/permissions';

export const PermissionsContext = createContext();

// Papel na empresa ativa → papel do sistema de permissões.
const COMPANY_ROLE_TO_GRANTS = {
  owner: 'administrador',
  admin: 'administrador',
  supervisor: 'supervisor',
  // Vínculo simplificado: base completa; o perfil vinculado restringe.
  member: 'administrador',
};

// Fonte única de permissões do usuário em sessão:
// - Operador PIN → perfil vinculado (granular) ou fallback pelo papel.
// - Usuário logado → papel na empresa ativa; SUPER_ADMIN recebe a plataforma.
export const PermissionsProvider = ({ children }) => {
  const { user } = useAuth();
  const { currentRole, platformAdmin, currentMembership } = useCompany();
  const { activeOperator } = useOperator();

  // Perfil de acesso do vínculo na empresa ativa: quando o vínculo tem
  // profile_id, o perfil RESTRINGE o papel (interseção). Perfil ausente,
  // inativo ou sem permissões válidas não restringe. SUPER_ADMIN nunca é
  // restringido. Operador PIN mantém a lógica atual (perfil substitui o papel).
  const profileId = currentMembership?.profile_id || '';
  const [membershipProfile, setMembershipProfile] = useState(null);
  useEffect(() => {
    if (!profileId) { setMembershipProfile(null); return; }
    let cancelled = false;
    base44.entities.UserRoleProfile.get(profileId)
      .then((p) => { if (!cancelled) setMembershipProfile(p && p.active !== false ? p : null); })
      .catch(() => { if (!cancelled) setMembershipProfile(null); });
    return () => { cancelled = true; };
  }, [profileId]);

  const permissions = useMemo(() => {
    if (activeOperator) {
      const fromProfile = resolvePermissions(activeOperator.permissions);
      if (fromProfile) return fromProfile;
      return new Set(ROLE_GRANTS[activeOperator.role] || ROLE_GRANTS.operador);
    }
    const grantRole = (currentRole && (COMPANY_ROLE_TO_GRANTS[currentRole] || currentRole)) || user?.role || 'user';
    const set = new Set(ROLE_GRANTS[grantRole] || ROLE_GRANTS.user);
    if (platformAdmin) {
      PLATFORM_GRANTS.forEach((p) => set.add(p));
      return set;
    }
    const profileGrants = resolvePermissions(membershipProfile?.permissions);
    if (profileGrants) return new Set([...set].filter((p) => profileGrants.has(p)));
    // 'member' sem perfil válido: o papel interno não concede nada por si —
    // cai no acesso básico (visualizar e criar produção).
    if (currentRole === 'member') return new Set(ROLE_GRANTS.user);
    return set;
  }, [activeOperator, currentRole, platformAdmin, user, membershipProfile]);

  // Suporte é acessível a todo usuário logado (não é módulo do plano nem do
  // catálogo granular); operador PIN (sessão compartilhada) não acessa.
  const allowedPaths = useMemo(
    () => (activeOperator ? [...permissionsToPaths(permissions), '/marketplace'] : [...permissionsToPaths(permissions), '/suporte', '/lgpd', '/privacidade', '/marketplace']),
    [permissions, activeOperator]
  );
  const can = useCallback((perm) => permissions.has(perm), [permissions]);

  return (
    <PermissionsContext.Provider value={{ permissions, allowedPaths, can }}>
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissions = () => {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error('usePermissions must be used within a PermissionsProvider');
  return ctx;
};