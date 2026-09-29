// Consumo de IA da empresa ativa — leitura para exibição na UI.
// A contabilização e a aplicação do limite acontecem no backend (função
// aiAnalysis); aqui apenas consultamos a quota atual.
import { base44 } from '@/api/base44Client';
import { activeCompanyId } from '@/lib/companyScope';

export async function getAiUsageInfo() {
  const companyId = activeCompanyId();
  if (!companyId) return { usage_count: null, limit: null, subscription_blocked: false };
  const res = await base44.functions.invoke('aiAnalysis', { action: 'usage', company_id: companyId });
  const d = res.data || {};
  return {
    usage_count: d.usage_count ?? null,
    limit: d.limit ?? null,
    subscription_blocked: !!d.subscription_blocked,
  };
}