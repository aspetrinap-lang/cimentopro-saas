import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useCompany } from '@/lib/CompanyContext';
import { useOperator } from '@/lib/OperatorContext';
import { isPlatformAdmin } from '@/lib/platformAdmin';
import { ROLE_GRANTS, PLATFORM_GRANTS, resolvePermissions, permissionsToPaths } from '@/lib/permissions';

const PermissionsContext = createContext();

// Papel na empresa ativa → papel do sistema de permissões.
const COMPANY_ROLE_TO_GRANTS = {
  owner: 'administrador',
  admin: 'administrador',
  supervisor: 'supervisor',
};

// Fonte única de permissões do usuário em sessão:
// - Operador PIN → perfil vinculado (granular) ou fallback pelo papel.
// - Usuário logado → papel na empresa ativa; SUPER_ADMIN recebe a plataforma.
export const PermissionsProvider = ({ children }) => {
  const { user } = useAuth();
  const { currentRole } = useCompany();
  const { activeOperator } = useOperator();

  const permissions = useMemo(() => {
    if (activeOperator) {
      const fromProfile = resolvePermissions(activeOperator.permissions);
      if (fromProfile) return fromProfile;
      return new Set(ROLE_GRANTS[activeOperator.role] || ROLE_GRANTS.operador);
    }
    const grantRole = (currentRole && (COMPANY_ROLE_TO_GRANTS[currentRole] || currentRole)) || user?.role || 'user';
    const set = new Set(ROLE_GRANTS[grantRole] || ROLE_GRANTS.user);
    if (isPlatformAdmin(user)) PLATFORM_GRANTS.forEach((p) => set.add(p));
    return set;
  }, [activeOperator, currentRole, user]);

  const allowedPaths = useMemo(() => permissionsToPaths(permissions), [permissions]);
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