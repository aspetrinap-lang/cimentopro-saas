// Acesso por assinatura: consulta a assinatura/plano vigente de uma empresa e
// valida os limites de cadastro do plano. Compartilhado entre as funções de
// backend (subscriptionManagement, companyMembers e adminCompanies) — sem
// duplicação.
// Regra de compatibilidade: empresa SEM assinatura registrada mantém acesso
// integral (legado) até o SUPER_ADMIN atribuir um plano.

// Configuração GLOBAL de assinatura (AppSettings, chave fixa — sem company_id).
// trial_days é usado apenas em NOVOS trials; trials existentes não mudam.
export const SUBSCRIPTION_CONFIG_KEY = 'subscription_config';

export async function getSubscriptionConfig(svc) {
  const rows = await svc.entities.AppSettings.filter({ key: SUBSCRIPTION_CONFIG_KEY }, '-created_date', 5).catch(() => []);
  const days = Number(rows[0]?.value?.trial_days);
  return { trial_days: Number.isFinite(days) && days > 0 ? days : 15 };
}

// Datas em ISO (YYYY-MM-DD) calculadas em UTC — determinístico no backend.
export function todayISO() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function addDaysISO(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

// Vigência padrão por ciclo: mensal = +30 dias; anual = +365 dias.
export function computeEndDate(startDate, billingCycle) {
  const start = startDate || todayISO();
  return addDaysISO(start, billingCycle === 'annual' ? 365 : 30);
}

// Cria automaticamente a assinatura trial de uma empresa recém-criada.
// Idempotente: se a empresa já tiver QUALQUER assinatura, não cria nada.
// Trial sem plano — acesso integral durante o período (plan_id vazio).
export async function ensureTrialSubscription(svc, company) {
  const existing = await svc.entities.Subscription.filter({ company_id: company.id }, '-created_date', 5).catch(() => []);
  if (existing.length) return null;
  const { trial_days } = await getSubscriptionConfig(svc);
  const start = todayISO();
  return svc.entities.Subscription.create({
    company_id: company.id,
    company_name: company.name || '',
    plan_id: '',
    plan_name: 'Trial',
    status: 'trial',
    billing_cycle: 'monthly',
    start_date: start,
    end_date: addDaysISO(start, trial_days),
  });
}

export async function getCompanySubscription(svc, companyId) {
  const subs = await svc.entities.Subscription.filter({ company_id: companyId }, '-created_date', 20).catch(() => []);
  const subscription = subs[0] || null;
  if (!subscription || !subscription.plan_id) return { subscription, plan: null };
  const plan = await svc.entities.SubscriptionPlan.get(subscription.plan_id).catch(() => null);
  return { subscription, plan };
}

export function isSubscriptionBlocked(subscription) {
  if (!subscription) return { blocked: false, reason: null };
  if (['suspended', 'cancelled', 'past_due'].includes(subscription.status)) {
    return { blocked: true, reason: subscription.status };
  }
  if (subscription.end_date) {
    const end = new Date(`${subscription.end_date}T23:59:59`);
    if (!isNaN(end.getTime()) && end.getTime() < Date.now()) {
      return { blocked: true, reason: subscription.status === 'trial' ? 'trial_expired' : 'expired' };
    }
  }
  return { blocked: false, reason: null };
}

// Valida o limite de cadastro do plano vigente. resource: 'users' | 'machines' | 'lines'.
// Retorno: allowed (false = limite atingido), limit (null = ilimitado), current, plan_name.
// Bloqueia apenas NOVAS inclusões — registros existentes nunca são excluídos
// nem alterados quando o plano é reduzido.
export async function checkPlanLimit(svc, companyId, resource) {
  const { subscription, plan } = await getCompanySubscription(svc, companyId);
  if (!subscription || !plan) {
    return { allowed: true, limit: null, current: null, plan_name: null };
  }
  const field = { users: 'max_users', machines: 'max_machines', lines: 'max_production_lines' }[resource];
  if (!field) return { allowed: true, limit: null, current: null, plan_name: plan.name };
  const limit = plan[field];
  if (limit === null || limit === undefined || Number(limit) === 0) {
    return { allowed: true, limit: null, current: null, plan_name: plan.name };
  }
  let current = 0;
  if (resource === 'users') {
    const links = await svc.entities.UserCompany.filter({ company_id: companyId, status: 'active' }, '-created_date', 500).catch(() => []);
    current = links.length;
  } else if (resource === 'machines') {
    const items = await svc.entities.Machine.filter({ company_id: companyId }, '-created_date', 500).catch(() => []);
    current = items.length;
  } else {
    const items = await svc.entities.ProductionLine.filter({ company_id: companyId }, '-created_date', 500).catch(() => []);
    current = items.length;
  }
  return { allowed: current < Number(limit), limit: Number(limit), current, plan_name: plan.name };
}