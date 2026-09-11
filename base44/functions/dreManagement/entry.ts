import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Gestão do DRE Padrão CimentoPro (multiempresa):
//   - seed_template: extrai a ESTRUTURA das DREs existentes (contas, categorias,
//     rateio) para o template DreTemplateAccount — sem valores financeiros.
//   - migrate_legacy: associa company_id às DREs históricas sem empresa
//     (migração não destrutiva — nenhum outro campo é tocado) e devolve o
//     relatório de conferência antes/depois.
//   - copy_to_company: copia o template para a estrutura da empresa
//     (DreAccount) — cópia independente; alterações no template NUNCA
//     propagam automaticamente para as empresas.
// A empresa autorizada é SEMPRE derivada do usuário autenticado (vínculos
// UserCompany) — nunca do payload do frontend.

const COMPANY_ROLES = ['owner', 'admin', 'supervisor'];

function normName(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function topKey(counts) {
  let best = null;
  for (const k of Object.keys(counts || {})) {
    if (best == null || counts[k] > counts[best]) best = k;
  }
  return best;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !user.id) return Response.json({ error: 'Não autenticado' }, { status: 401 });
    const svc = base44.asServiceRole;
    const isPlatformAdmin = user.is_platform_admin === true || (user.data && user.data.is_platform_admin) === true;

    let body = {};
    try { body = await req.json(); } catch (error) { body = {}; }
    const action = body.action;

    const audit = async (companyId, actionName, entityName, entityId, newValue) => {
      await svc.entities.AuditLog.create({
        user_id: user.id,
        user_email: user.email,
        company_id: companyId || null,
        action: actionName,
        entity_name: entityName,
        entity_id: entityId || null,
        new_value: newValue || null,
      });
    };

    // --- seed_template: DRE atual → DRE Padrão CimentoPro (SUPER_ADMIN) ---
    if (action === 'seed_template') {
      if (!isPlatformAdmin) return Response.json({ error: 'Forbidden: SUPER_ADMIN required' }, { status: 403 });
      const dres = await svc.entities.MonthlyDre.list('-reference_month', 1000);
      const template = await svc.entities.DreTemplateAccount.list('sort_order', 1000);
      const existing = new Set(template.map((t) => normName(t.name)));

      // Estrutura apenas: nome, categoria e método de rateio mais frequentes,
      // ordem de primeira aparição. Nenhum valor financeiro é copiado.
      const stats = new Map();
      let order = 0;
      for (const dre of dres) {
        const items = [...(dre.items || [])];
        if (dre.faturamento_account) {
          items.push({ account_name: dre.faturamento_account, category: 'Receita', apportionment_method: 'none' });
        }
        for (const it of items) {
          if (!it || !it.account_name) continue;
          const key = normName(it.account_name);
          if (existing.has(key)) continue;
          let s = stats.get(key);
          if (!s) {
            s = { name: String(it.account_name).trim(), category: {}, method: {}, order: order++ };
            stats.set(key, s);
          }
          if (it.category) s.category[it.category] = (s.category[it.category] || 0) + 1;
          if (it.apportionment_method) s.method[it.apportionment_method] = (s.method[it.apportionment_method] || 0) + 1;
        }
      }
      const toCreate = [...stats.values()].map((s) => ({
        name: s.name,
        category: topKey(s.category) || 'Despesa Fixa',
        apportionment_method: topKey(s.method) || 'none',
        sort_order: s.order + 1,
        active: true,
      }));
      let created = [];
      if (toCreate.length) created = await svc.entities.DreTemplateAccount.bulkCreate(toCreate);
      await audit(null, 'CREATE', 'DreTemplateAccount', null, { seeded_from_current_dre: created.length, accounts: toCreate.map((t) => t.name) });
      return Response.json({ created: created.length, existing: existing.size });
    }

    // --- migrate_legacy: associa company_id às DREs sem empresa (SUPER_ADMIN) ---
    if (action === 'migrate_legacy') {
      if (!isPlatformAdmin) return Response.json({ error: 'Forbidden: SUPER_ADMIN required' }, { status: 403 });
      let companyId = body.company_id || null;
      if (!companyId) {
        const myLinks = await svc.entities.UserCompany.filter({ user_id: user.id, status: 'active' });
        const myCompanies = [...new Set(myLinks.map((l) => l.company_id))];
        if (myCompanies.length === 1) companyId = myCompanies[0];
      }
      if (!companyId) {
        const activeCompanies = await svc.entities.Company.filter({ status: 'active' });
        if (activeCompanies.length === 1) companyId = activeCompanies[0].id;
      }
      if (!companyId) {
        return Response.json({ error: 'company_id é obrigatório: não foi possível determinar a empresa de destino.' }, { status: 400 });
      }
      const company = await svc.entities.Company.get(companyId).catch(() => null);
      if (!company) return Response.json({ error: 'Empresa não encontrada' }, { status: 404 });

      const dres = await svc.entities.MonthlyDre.list('-reference_month', 10000);
      const legacy = dres.filter((d) => !d.company_id);
      const before = dres.map((d) => ({
        id: d.id,
        reference_month: d.reference_month,
        company_id: d.company_id || null,
        items: (d.items || []).length,
        total_planned: d.total_planned,
        total_actual: d.total_actual,
      }));
      if (legacy.length) {
        // Migração NÃO destrutiva: apenas acrescenta company_id — nenhum
        // outro campo, conta ou cache é recalculado/tocado.
        await svc.entities.MonthlyDre.bulkUpdate(legacy.map((d) => ({ id: d.id, company_id: companyId })));
      }
      const afterRecords = await svc.entities.MonthlyDre.list('-reference_month', 10000);
      const after = afterRecords.map((d) => ({
        id: d.id,
        reference_month: d.reference_month,
        company_id: d.company_id || null,
        items: (d.items || []).length,
        total_planned: d.total_planned,
        total_actual: d.total_actual,
      }));
      const report = {
        target_company_id: companyId,
        target_company_name: company.name,
        total_records: dres.length,
        legacy_before: legacy.length,
        legacy_after: afterRecords.filter((d) => !d.company_id).length,
        migrated_months: legacy.map((d) => d.reference_month),
        before,
        after,
      };
      if (legacy.length) {
        await audit(companyId, 'UPDATE', 'MonthlyDre', null, { migrated: legacy.map((d) => d.id), company_id: companyId });
      }
      return Response.json(report);
    }

    // --- copy_to_company: DRE Padrão → estrutura da empresa (SUPER_ADMIN ou gestor da empresa) ---
    if (action === 'copy_to_company') {
      const companyId = body.company_id;
      if (!companyId) return Response.json({ error: 'company_id é obrigatório' }, { status: 400 });
      const company = await svc.entities.Company.get(companyId).catch(() => null);
      if (!company) return Response.json({ error: 'Empresa não encontrada' }, { status: 404 });
      let allowed = isPlatformAdmin;
      if (!allowed) {
        const links = await svc.entities.UserCompany.filter({ user_id: user.id, company_id: companyId });
        allowed = links.some((l) => l.status === 'active' && COMPANY_ROLES.includes(l.role));
      }
      if (!allowed) return Response.json({ error: 'Sem permissão para configurar esta empresa' }, { status: 403 });

      const template = await svc.entities.DreTemplateAccount.list('sort_order', 1000);
      const activeTemplate = template.filter((t) => t.active !== false);
      const existingAccounts = await svc.entities.DreAccount.filter({ company_id: companyId });
      const existingNames = new Set(existingAccounts.map((a) => normName(a.name)));

      const toCreate = activeTemplate
        .filter((t) => !existingNames.has(normName(t.name)))
        .map((t) => ({
          company_id: companyId,
          template_id: t.id,
          name: t.name,
          description: t.description || '',
          category: t.category,
          apportionment_method: t.apportionment_method || 'none',
          parent_id: null,
          sort_order: t.sort_order || 0,
          source_type: 'manual',
          active: true,
        }));
      if (!toCreate.length) {
        return Response.json({ created: 0, skipped: existingNames.size });
      }
      const created = await svc.entities.DreAccount.bulkCreate(toCreate);

      // Remapeia subcontas: parent_id do template → id novo da conta criada
      const byName = new Map(created.map((c) => [normName(c.name), c.id]));
      const tplById = new Map(template.map((t) => [t.id, t]));
      const parentPatches = [];
      for (const c of created) {
        const tpl = c.template_id ? tplById.get(c.template_id) : null;
        const parentTpl = tpl && tpl.parent_id ? tplById.get(tpl.parent_id) : null;
        if (!parentTpl) continue;
        const newParentId = byName.get(normName(parentTpl.name))
          || (existingAccounts.find((a) => normName(a.name) === normName(parentTpl.name)) || {}).id;
        if (newParentId) parentPatches.push({ id: c.id, parent_id: newParentId });
      }
      if (parentPatches.length) await svc.entities.DreAccount.bulkUpdate(parentPatches);

      await audit(companyId, 'CREATE', 'DreAccount', null, { copied_from_template: created.length, company_id: companyId });
      return Response.json({ created: created.length, skipped: existingNames.size });
    }

    return Response.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}