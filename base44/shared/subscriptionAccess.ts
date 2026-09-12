// Acesso por assinatura: consulta a assinatura/plano vigente de uma empresa e
// valida os limites de cadastro do plano. Compartilhado entre as funções de
// backend (subscriptionManagement e companyMembers) — sem duplicação.
// Regra de compatibilidade: empresa SEM assinatura registrada mantém acesso
// integral (legado) até o SUPER_ADMIN atribuir um plano.

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
      return { blocked: true, reason: 'expired' };
    }
  }
  return { blocked: false, reason: null };
}

// Valida o limite de cadastro do plano vigente. resource: 'users' | 'machines' | 'lines'.
// Retorno: allowed (false = limite atingido), limit (null = ilimitado), current, plan_name.
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