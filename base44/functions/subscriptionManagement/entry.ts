import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { requirePlatformAdmin } from '../../shared/platformAdmin.ts';
import { getCompanySubscription, isSubscriptionBlocked, checkPlanLimit } from '../../shared/subscriptionAccess.ts';

// Gestão de Planos e Assinaturas da plataforma CimentoPro.
// - Ações administrativas (listPlans, savePlan, listSubscriptions,
//   saveSubscription): exclusivas do SUPER_ADMIN, com trilha de auditoria.
// - 'current' e 'checkLimit': disponíveis a membros ativos da empresa e ao
//   SUPER_ADMIN. A assinatura vigente é lida pelo acesso de serviço — não
//   depende do cache da sessão (mesma correção dos vínculos de empresa).
const PLAN_FIELDS = ['name', 'description', 'price', 'max_users', 'max_machines', 'max_production_lines', 'features', 'status'];
const SUB_STATUSES = ['trial', 'active', 'past_due', 'suspended', 'cancelled'];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    let body = {};
    try { body = await req.json(); } catch (error) { body = {}; }
    const action = body.action;
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || null;

    // ── Ações da própria empresa (assinatura vigente e limites do plano) ──
    if (action === 'current' || action === 'checkLimit') {
      const me = await base44.auth.me().catch(() => null);
      if (!me || !me.id) return Response.json({ error: 'Não autenticado' }, { status: 401 });
      const companyId = body.company_id;
      if (!companyId) return Response.json({ error: 'company_id é obrigatório' }, { status: 400 });
      const svc = base44.asServiceRole;
      const platformAdmin = me.is_platform_admin === true || (me.data && me.data.is_platform_admin) === true;
      if (!platformAdmin) {
        const links = await svc.entities.UserCompany.filter({ user_id: me.id, company_id: companyId, status: 'active' }, '-created_date', 10);
        if (!links.length) return Response.json({ error: 'Sem acesso a esta empresa' }, { status: 403 });
      }
      if (action === 'current') {
        const { subscription, plan } = await getCompanySubscription(svc, companyId);
        const { blocked, reason } = isSubscriptionBlocked(subscription);
        return Response.json({
          subscription: subscription ? {
            id: subscription.id,
            status: subscription.status,
            start_date: subscription.start_date,
            end_date: subscription.end_date,
          } : null,
          plan: plan ? {
            id: plan.id,
            name: plan.name,
            price: plan.price,
            features: plan.features || [],
            max_users: plan.max_users,
            max_machines: plan.max_machines,
            max_production_lines: plan.max_production_lines,
          } : null,
          blocked,
          block_reason: reason,
          allowed_modules: plan ? (plan.features || []) : null,
        });
      }
      const result = await checkPlanLimit(svc, companyId, body.resource);
      return Response.json(result);
    }

    // ── Ações administrativas (SUPER_ADMIN) ──
    const auth = await requirePlatformAdmin(base44);
    if (auth.response) return auth.response;
    const user = auth.user;
    const svc = base44.asServiceRole;

    const audit = async (actionName, entityName, entityId, companyId, oldValue, newValue) => {
      await svc.entities.AuditLog.create({
        user_id: user.id,
        user_email: user.email,
        company_id: companyId || null,
        action: actionName,
        entity_name: entityName,
        entity_id: entityId || null,
        ip,
        old_value: oldValue || null,
        new_value: newValue || null,
      });
    };

    if (action === 'listPlans') {
      const plans = await svc.entities.SubscriptionPlan.list('name', 200);
      const subs = await svc.entities.Subscription.filter({}, '-created_date', 500);
      const usage = {};
      for (const s of subs) usage[s.plan_id] = (usage[s.plan_id] || 0) + 1;
      return Response.json({ plans: plans.map((p) => ({ ...p, company_count: usage[p.id] || 0 })) });
    }

    if (action === 'savePlan') {
      const name = String(body.name || '').trim();
      if (!name) return Response.json({ error: 'Nome do plano é obrigatório' }, { status: 400 });
      if (body.status !== undefined && !['active', 'inactive'].includes(body.status)) {
        return Response.json({ error: 'Situação inválida' }, { status: 400 });
      }
      const data = { name };
      for (const field of ['description', 'price', 'max_users', 'max_machines', 'max_production_lines']) {
        if (body[field] !== undefined) data[field] = body[field];
      }
      if (body.features !== undefined) {
        if (!Array.isArray(body.features)) return Response.json({ error: 'Módulos do plano inválidos' }, { status: 400 });
        data.features = body.features;
      }
      if (body.status !== undefined) data.status = body.status;
      if (body.plan_id) {
        const prev = await svc.entities.SubscriptionPlan.get(body.plan_id).catch(() => null);
        if (!prev) return Response.json({ error: 'Plano não encontrado' }, { status: 404 });
        const updated = await svc.entities.SubscriptionPlan.update(body.plan_id, data);
        await audit('UPDATE', 'SubscriptionPlan', updated.id, null,
          Object.fromEntries(PLAN_FIELDS.map((f) => [f, prev[f]])), data);
        return Response.json({ plan: updated });
      }
      const created = await svc.entities.SubscriptionPlan.create({ status: 'active', ...data });
      await audit('CREATE', 'SubscriptionPlan', created.id, null, null, data);
      return Response.json({ plan: created });
    }

    if (action === 'listSubscriptions') {
      const companies = await svc.entities.Company.list('name', 500);
      const subs = await svc.entities.Subscription.filter({}, '-created_date', 500);
      const plans = await svc.entities.SubscriptionPlan.list('name', 200);
      const planById = new Map(plans.map((p) => [p.id, p]));
      const subByCompany = new Map();
      for (const s of subs) if (!subByCompany.has(s.company_id)) subByCompany.set(s.company_id, s);
      return Response.json({
        companies: companies.map((c) => {
          const sub = subByCompany.get(c.id) || null;
          const plan = sub ? (planById.get(sub.plan_id) || null) : null;
          return {
            company_id: c.id,
            company_name: c.name,
            company_status: c.status,
            subscription: sub ? {
              id: sub.id,
              status: sub.status,
              start_date: sub.start_date,
              end_date: sub.end_date,
              plan_id: sub.plan_id,
              plan_name: sub.plan_name || (plan ? plan.name : null),
            } : null,
            plan: plan ? {
              id: plan.id,
              name: plan.name,
              price: plan.price,
              features: plan.features || [],
              max_users: plan.max_users,
              max_machines: plan.max_machines,
              max_production_lines: plan.max_production_lines,
            } : null,
          };
        }),
        plans: plans
          .filter((p) => p.status !== 'inactive')
          .map((p) => ({ id: p.id, name: p.name, price: p.price })),
      });
    }

    if (action === 'saveSubscription') {
      const { company_id, plan_id, status, start_date, end_date } = body;
      if (!company_id) return Response.json({ error: 'company_id é obrigatório' }, { status: 400 });
      if (!plan_id) return Response.json({ error: 'plan_id é obrigatório' }, { status: 400 });
      if (!SUB_STATUSES.includes(status)) return Response.json({ error: 'Situação de assinatura inválida' }, { status: 400 });
      const company = await svc.entities.Company.get(company_id).catch(() => null);
      if (!company) return Response.json({ error: 'Empresa não encontrada' }, { status: 404 });
      const plan = await svc.entities.SubscriptionPlan.get(plan_id).catch(() => null);
      if (!plan) return Response.json({ error: 'Plano não encontrado' }, { status: 404 });
      if (plan.status === 'inactive') {
        return Response.json({ error: 'Plano inativo — reative o plano antes de atribuí-lo a uma empresa' }, { status: 400 });
      }
      const data = {
        company_id,
        company_name: company.name,
        plan_id,
        plan_name: plan.name,
        status,
        start_date: start_date || null,
        end_date: end_date || null,
      };
      const existing = await svc.entities.Subscription.filter({ company_id }, '-created_date', 20);
      if (existing.length) {
        const prev = existing[0];
        const updated = await svc.entities.Subscription.update(prev.id, data);
        await audit('UPDATE', 'Subscription', updated.id, company_id,
          { plan_id: prev.plan_id, plan_name: prev.plan_name, status: prev.status, start_date: prev.start_date, end_date: prev.end_date },
          { plan_id, plan_name: plan.name, status, start_date: start_date || null, end_date: end_date || null });
        return Response.json({ subscription: updated });
      }
      const created = await svc.entities.Subscription.create(data);
      await audit('CREATE', 'Subscription', created.id, company_id, null,
        { plan_id, plan_name: plan.name, status, start_date: start_date || null, end_date: end_date || null });
      return Response.json({ subscription: created });
    }

    return Response.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}