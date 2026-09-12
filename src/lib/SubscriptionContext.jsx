import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useCompany } from '@/lib/CompanyContext';
import { moduleForPath } from '@/lib/planModules';

// Contexto da assinatura vigente da empresa ativa. Lida do backend pelo
// acesso de serviço (independente do cache da sessão) sempre que a empresa
// ativa muda. Empresa SEM assinatura registrada mantém acesso integral
// (compatibilidade) até o SUPER_ADMIN atribuir um plano.
const SubscriptionContext = createContext(null);

const EMPTY = {
  loading: false,
  subscription: null,
  plan: null,
  blocked: false,
  blockReason: null,
  allowedModules: null,
};

export const SubscriptionProvider = ({ children }) => {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const { currentCompanyId } = useCompany();
  const [data, setData] = useState(EMPTY);

  useEffect(() => {
    if (isLoadingAuth || !isAuthenticated || !currentCompanyId) {
      setData(EMPTY);
      return;
    }
    let cancelled = false;
    setData((s) => ({ ...s, loading: true }));
    base44.functions.invoke('subscriptionManagement', { action: 'current', company_id: currentCompanyId })
      .then((res) => {
        if (cancelled) return;
        setData({
          loading: false,
          subscription: res.data?.subscription || null,
          plan: res.data?.plan || null,
          blocked: !!res.data?.blocked,
          blockReason: res.data?.block_reason || null,
          allowedModules: res.data?.allowed_modules || null,
        });
      })
      .catch(() => {
        if (!cancelled) setData(EMPTY);
      });
    return () => { cancelled = true; };
  }, [isLoadingAuth, isAuthenticated, currentCompanyId]);

  const moduleAllowed = useCallback((path) => {
    if (!data.subscription || !data.plan) return true;
    const mod = moduleForPath(path);
    if (!mod || !data.allowedModules) return true;
    return data.allowedModules.includes(mod);
  }, [data.subscription, data.plan, data.allowedModules]);

  return (
    <SubscriptionContext.Provider value={{ ...data, moduleAllowed }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within a SubscriptionProvider');
  return ctx;
};