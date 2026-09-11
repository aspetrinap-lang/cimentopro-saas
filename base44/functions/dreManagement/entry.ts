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
const INSUMO_ACTUAL_FIELDS = {
  cement: 'actual_cement',
  sand_artificial: 'actual_sand_artificial',
  sand_medium: 'actual_sand_medium',
  sand_fine: 'actual_sand_fine',
  gravel: 'actual_gravel',
  additive: 'actual_additive',
  pigment: 'actual_pigment',
  water: 'actual_water',
};
const INSUMO_PT_FIELDS = {
  cement: 'cement_per_unit',
  sand_artificial: 'sand_artificial_per_unit',
  sand_medium: 'sand_medium_per_unit',
  sand_fine: 'sand_fine_per_unit',
  gravel: 'gravel_per_unit',
  additive: 'additive_per_unit',
  pigment: 'pigment_per_unit',
  water: 'water_per_unit',
};
const DEFAULT_INSUMO_NAMES = {
  cement: 'Cimento', sand_artificial: 'Areia Artificial', sand_medium: 'Areia Média',
  sand_fine: 'Areia Fina', gravel: 'Brita', additive: 'Aditivo', pigment: 'Pigmento', water: 'Água',
};
const MONTH_LABELS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

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

// Autorização por empresa: SUPER_ADMIN ou vínculo ativo com papel gestor —
// sempre derivado do usuário autenticado, nunca do payload do frontend.
async function companyMemberAllowed(svc, user, isPlatformAdmin, companyId) {
  if (isPlatformAdmin) return true;
  const links = await svc.entities.UserCompany.filter({ user_id: user.id, company_id: companyId });
  return links.some((l) => l.status === 'active' && COMPANY_ROLES.includes(l.role));
}

// Recalcula os caches totais da DRE a partir das linhas (mesma fórmula do frontend)
function dreTotals(items) {
  const sum = (pred, field) => items.reduce((s, it) => (pred(it) ? s + (Number(it[field]) || 0) : s), 0);
  return {
    total_planned: sum(() => true, 'planned_value'),
    total_actual: sum(() => true, 'actual_value'),
    total_apportionable: sum((it) => (it.apportionment_method || 'none') !== 'none', 'actual_value'),
    total_receita_planned: sum((it) => it.category === 'Receita', 'planned_value'),
    total_receita_actual: sum((it) => it.category === 'Receita', 'actual_value'),
    total_despesa_planned: sum((it) => it.category !== 'Receita', 'planned_value'),
    total_despesa_actual: sum((it) => it.category !== 'Receita', 'actual_value'),
  };
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
      const allowed = await companyMemberAllowed(svc, user, isPlatformAdmin, companyId);
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

    // --- sync_period: preenche as contas com origem em módulo (Fase 2 — automação) ---
    if (action === 'sync_period') {
      const companyId = body.company_id;
      const referenceMonth = String(body.reference_month || '');
      if (!companyId || !/^\d{4}-\d{2}$/.test(referenceMonth)) {
        return Response.json({ error: 'company_id e reference_month (YYYY-MM) são obrigatórios' }, { status: 400 });
      }
      const allowed = await companyMemberAllowed(svc, user, isPlatformAdmin, companyId);
      if (!allowed) return Response.json({ error: 'Sem permissão para sincronizar esta empresa' }, { status: 403 });

      const existing = await svc.entities.MonthlyDre.filter({ company_id: companyId, reference_month: referenceMonth });
      const dre = existing[0] || null;
      if (dre && dre.closed === true) {
        return Response.json({ error: 'Período fechado — reabra-o para sincronizar (os valores fechados são preservados).' }, { status: 409 });
      }

      const accounts = await svc.entities.DreAccount.filter({ company_id: companyId }, 'sort_order', 500);
      const sourceAccounts = accounts.filter((a) => a.active !== false && a.source_type && a.source_type !== 'manual');
      if (!sourceAccounts.length) {
        return Response.json({ error: 'Nenhuma conta ativa com origem em módulo (matéria-prima, energia, manutenção, vendas) na estrutura da DRE.' }, { status: 422 });
      }

      // Dados do mês: ordens concluídas, cadastros e configurações da empresa
      const orders = (await svc.entities.ProductionOrder.filter({ company_id: companyId, status: 'Concluída' }, '-production_date', 10000))
        .filter((o) => String(o.production_date || '').startsWith(referenceMonth));
      const productTypes = await svc.entities.ProductType.filter({ company_id: companyId }, 'name', 1000);
      const ptMap = new Map(productTypes.map((p) => [p.id, p]));
      const lines = await svc.entities.ProductionLine.filter({ company_id: companyId }, 'name', 500);
      const costRows = await svc.entities.AppSettings.filter({ company_id: companyId, key: 'insumo_costs' });
      const insumoCosts = (costRows[0] && costRows[0].value) || {};
      const matRows = await svc.entities.AppSettings.filter({ company_id: companyId, key: 'raw_materials' });
      const matItems = matRows[0] && Array.isArray(matRows[0].value && matRows[0].value.items) ? matRows[0].value.items : [];

      // Matéria-prima: consumo real quando lançado na ordem; senão estimativa do
      // cadastro (por peça × quantidade) — mesma base do Engenheiro Virtual.
      const consumption = {};
      for (const key of Object.keys(INSUMO_ACTUAL_FIELDS)) consumption[key] = 0;
      for (const o of orders) {
        const pt = ptMap.get(o.product_type_id);
        const sf = pt && String(pt.unit || 'un').toLowerCase() !== 'un' && Number(pt.pieces_per_m) > 0 ? Number(pt.pieces_per_m) : 1;
        for (const [key, actualField] of Object.entries(INSUMO_ACTUAL_FIELDS)) {
          const real = Number(o[actualField]);
          if (Number.isFinite(real) && real > 0) {
            consumption[key] += real;
          } else if (pt) {
            consumption[key] += (Number(o.actual_quantity) || 0) * sf * (Number(pt[INSUMO_PT_FIELDS[key]]) || 0);
          }
        }
      }
      const insumoName = (key) => {
        const m = matItems.find((x) => x.key === key);
        return (m && m.name) || DEFAULT_INSUMO_NAMES[key] || key;
      };
      const insumoCostTotal = {};
      let rawMaterialTotal = 0;
      for (const key of Object.keys(consumption)) {
        insumoCostTotal[key] = consumption[key] * (Number(insumoCosts[key]) || 0);
        rawMaterialTotal += insumoCostTotal[key];
      }

      // Energia: horas por linha × potência × custo do kWh (mesma fórmula da Análise de Custos)
      const machineToLine = {};
      lines.forEach((l) => (l.machines || []).forEach((m) => { if (m.machine_id) machineToLine[m.machine_id] = l.id; }));
      const lineHours = {};
      lines.forEach((l) => { lineHours[l.id] = 0; });
      for (const o of orders) {
        const lid = o.production_line_id || machineToLine[o.machine_id];
        if (lid && lineHours[lid] != null) lineHours[lid] += (Number(o.production_minutes) || 0) / 60;
      }
      const energyTotal = lines.reduce((s, l) => s + (lineHours[l.id] || 0) * (Number(l.used_power_kw) || 0) * (Number(l.energy_cost_per_kwh) || 0), 0);

      // Vendas: estimativa Σ quantidade produzida concluída × preço de venda do artefato
      const salesTotal = orders.reduce((s, o) => {
        const pt = ptMap.get(o.product_type_id);
        return s + (Number(o.actual_quantity) || 0) * (Number(pt && pt.selling_price) || 0);
      }, 0);

      // Distribui os valores nas contas configuradas com origem em módulo
      const countBySource = {};
      sourceAccounts.forEach((a) => { countBySource[a.source_type] = (countBySource[a.source_type] || 0) + 1; });
      const matchInsumoAccount = (a) => {
        const n = normName(a.name);
        for (const key of Object.keys(consumption)) {
          const nm = normName(insumoName(key));
          if (nm && (n.includes(nm) || nm.includes(n))) return key;
        }
        return null;
      };
      const filled = [];
      const skipped = [];
      for (const a of sourceAccounts) {
        if (a.source_type === 'raw_material') {
          const key = matchInsumoAccount(a);
          if (key) filled.push({ account: a, value: insumoCostTotal[key] });
          else if (countBySource.raw_material === 1) filled.push({ account: a, value: rawMaterialTotal });
          else skipped.push({ account_name: a.name, reason: 'não foi possível identificar o insumo pela conta — use o nome do insumo ou uma única conta de matéria-prima' });
        } else if (a.source_type === 'energy') {
          if (countBySource.energy === 1) filled.push({ account: a, value: energyTotal });
          else skipped.push({ account_name: a.name, reason: 'configure apenas uma conta com origem energia' });
        } else if (a.source_type === 'sales') {
          if (countBySource.sales === 1) filled.push({ account: a, value: salesTotal });
          else skipped.push({ account_name: a.name, reason: 'configure apenas uma conta com origem vendas' });
        } else if (a.source_type === 'maintenance') {
          skipped.push({ account_name: a.name, reason: 'o módulo de manutenção ainda não lança custos financeiros' });
        }
      }

      // Idempotente: lançamentos manuais preservados; automáticos regenerados
      const manualItems = ((dre && dre.items) || []).filter((it) => it.automatic !== true);
      const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
      const automaticItems = filled.map((f) => ({
        account_name: f.account.name,
        account_id: f.account.id,
        planned_value: 0,
        actual_value: round2(f.value),
        category: f.account.category,
        apportionment_method: f.account.apportionment_method || 'none',
        source_type: f.account.source_type,
        automatic: true,
      }));
      const items = [...manualItems, ...automaticItems];
      const totals = dreTotals(items);
      const [yStr, mStr] = referenceMonth.split('-');
      const monthLabel = `${MONTH_LABELS[Number(mStr) - 1]}/${yStr}`;
      if (dre) {
        await svc.entities.MonthlyDre.update(dre.id, { items, ...totals });
      } else {
        await svc.entities.MonthlyDre.create({
          company_id: companyId,
          reference_month: referenceMonth,
          month_label: monthLabel,
          items,
          ...totals,
          notes: 'Preenchida pela sincronização com os módulos do CimentoPro',
        });
      }
      await audit(companyId, dre ? 'UPDATE' : 'CREATE', 'MonthlyDre', dre ? dre.id : null, {
        synced_month: referenceMonth,
        automatic_items: automaticItems.length,
        filled: filled.map((f) => f.account.name),
      });
      return Response.json({
        reference_month: referenceMonth,
        dre_created: !dre,
        manual_items: manualItems.length,
        automatic_items: automaticItems.length,
        computed: { orders: orders.length, raw_material: round2(rawMaterialTotal), energy: round2(energyTotal), sales: round2(salesTotal) },
        filled: filled.map((f) => ({ account_name: f.account.name, source_type: f.account.source_type, value: round2(f.value) })),
        skipped,
      });
    }

    return Response.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}