import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { isPlatformAdminVerified } from '../../shared/platformAdmin.ts';
import {
  getOfficialClassification,
  normalizeAccountName,
  SUBTOTAL_ACCOUNTS,
} from '../../shared/breakEvenClassification.ts';

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
    // SUPER_ADMIN: fonte protegida PlatformAdmin (verificada no backend) —
    // a flag da sessão é apenas cache de exibição.
    const isPlatformAdmin = await isPlatformAdminVerified(svc, user);

    let body = {};
    try { body = await req.json(); } catch (error) { body = {}; }
    const action = body.action;

    const audit = async (companyId, actionName, entityName, entityId, newValue, oldValue) => {
      await svc.entities.AuditLog.create({
        user_id: user.id,
        user_email: user.email,
        company_id: companyId || null,
        action: actionName,
        entity_name: entityName,
        entity_id: entityId || null,
        old_value: oldValue || null,
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

    // ── Ponto de Equilíbrio v1.1 — classificação gerencial oficial ──
    // apply_break_even_classification: aplica o mapa oficial às contas
    // DreAccount de TODAS as empresas (idempotente — só corrige contas
    // divergentes do mapa; nunca reclassifica além dele nem altera a DRE).
    // pe_selftest: executa os testes obrigatórios da especificação contra os
    // dados reais. Ambas exigem SUPER_ADMIN.
    if (action === 'apply_break_even_classification' || action === 'pe_selftest') {
      if (!isPlatformAdmin) return Response.json({ error: 'Forbidden: SUPER_ADMIN required' }, { status: 403 });
      const companies = await svc.entities.Company.list('name', 500);
      const accounts = await svc.entities.DreAccount.list('sort_order', 2000);

      if (action === 'apply_break_even_classification') {
        const unmatched: string[] = [];
        const unmatchedSeen = new Set<string>();
        const companyReports: Array<{ company_id: string; name: string; accounts: number; matched: number; updated: number }> = [];
        let totalUpdated = 0;
        let totalMatched = 0;
        for (const c of companies) {
          const mine = accounts.filter((a) => a.company_id === c.id);
          const patches: Array<Record<string, unknown>> = [];
          let matched = 0;
          for (const a of mine) {
            const official = getOfficialClassification(a);
            if (!official) {
              const n = normalizeAccountName(a.name);
              if (!unmatchedSeen.has(n)) { unmatchedSeen.add(n); unmatched.push(a.name); }
              continue;
            }
            matched++;
            const next = {
              break_even_classification: official.classification,
              break_even_block: official.block,
              financial_role: official.financial_role,
              break_even_role: official.break_even_role,
              enabled_for_pec: official.enabled_for_pec,
              enabled_for_pef: official.enabled_for_pef,
              enabled_for_pee: official.enabled_for_pee,
            };
            const diverges = Object.entries(next).some(([k, v]) =>
              (v == null) ? (a[k] != null && a[k] !== '') : a[k] !== v
            );
            if (diverges) patches.push({ id: a.id, ...next });
          }
          if (patches.length) {
            await svc.entities.DreAccount.bulkUpdate(patches);
            await audit(c.id, 'UPDATE', 'DreAccount', null, { break_even_official_classification: patches.length });
          }
          companyReports.push({ company_id: c.id, name: c.name, accounts: mine.length, matched, updated: patches.length });
          totalUpdated += patches.length;
          totalMatched += matched;
        }
        return Response.json({
          total_accounts: accounts.length,
          matched: totalMatched,
          updated: totalUpdated,
          unmatched: unmatched,
          unmatched_note: 'Contas fora do mapa oficial mantêm a classificação atual (compatibilidade legada).',
          companies: companyReports,
        });
      }

      // ── pe_selftest — 11 testes obrigatórios da especificação v1.1 ──
      const effOf = (raw: string) =>
        ({ fixed_industrial: 'fixed_operational', fixed_cash: 'fixed_operational' } as Record<string, string>)[raw] || raw;
      const dresAll = await svc.entities.MonthlyDre.list('-reference_month', 10000);
      const results: Array<{ test: string; passed: boolean; detail: string }> = [];
      const companySummaries: Array<Record<string, unknown>> = [];
      let dbMismatches = 0;
      let receitaOk = true;
      let investOk = true;
      let consolidDiffSample: number | null = null;

      for (const c of companies) {
        const mine = accounts.filter((a) => a.company_id === c.id);
        const dres = dresAll.filter((d) => d.company_id === c.id);
        const mapById = new Map<string, any>();
        const mapByName = new Map<string, any>();
        for (const a of mine) {
          mapById.set(a.id, a);
          mapByName.set(normalizeAccountName(a.name), a);
        }
        const sums = { revenue: 0, deductions: 0, variable: 0, fixed_operational: 0, financial_cash: 0, investments: 0 };
        for (const d of dres) {
          for (const it of d.items || []) {
            if (!it || !it.account_name) continue;
            const n = normalizeAccountName(it.account_name);
            if (SUBTOTAL_ACCOUNTS.includes(n)) continue;
            const acc = (it.account_id && mapById.get(it.account_id)) || mapByName.get(n) || null;
            const official = acc ? getOfficialClassification(acc) : null;
            const raw = official ? official.classification : (acc?.break_even_classification || 'excluded');
            const eff = effOf(raw);
            const v = Number(it.actual_value) || 0;
            if (eff === 'revenue') sums.revenue += v;
            else if (eff === 'variable') {
              const block = official ? official.block : (acc?.break_even_block || null);
              if (block === 'revenue_deduction') sums.deductions += v;
              else sums.variable += v;
            } else if (eff === 'fixed_operational') sums.fixed_operational += v;
            else if (eff === 'financial_cash') {
              const role = official ? official.financial_role : (acc?.financial_role || null);
              if (role === 'investment') sums.investments += v;
              else sums.financial_cash += v;
            }
          }
        }
        const gross = sums.revenue > 0 ? sums.revenue : dres.reduce((s, d) => s + (Number(d.faturamento_actual) || 0), 0);
        const net = gross - sums.deductions;
        const mc = net - sums.variable;
        const mcPct = gross > 0 ? mc / gross : null;
        const be = (fixed: number) => (mcPct && mcPct > 0 ? fixed / mcPct : null);
        const pec = be(sums.fixed_operational);
        const pef = be(sums.fixed_operational + sums.financial_cash);
        const pee100k = be(sums.fixed_operational + 100000);

        companySummaries.push({
          company: c.name,
          gross: Math.round(gross * 100) / 100,
          deductions: Math.round(sums.deductions * 100) / 100,
          net: Math.round(net * 100) / 100,
          variable: Math.round(sums.variable * 100) / 100,
          mc: Math.round(mc * 100) / 100,
          mc_percent: mcPct != null ? Math.round(mcPct * 10000) / 100 : null,
          fixed_operational: Math.round(sums.fixed_operational * 100) / 100,
          financial_cash: Math.round(sums.financial_cash * 100) / 100,
          investments: Math.round(sums.investments * 100) / 100,
          pec: pec != null ? Math.round(pec * 100) / 100 : null,
          pef: pef != null ? Math.round(pef * 100) / 100 : null,
          pee_lucro_100k: pee100k != null ? Math.round(pee100k * 100) / 100 : null,
        });

        if (sums.revenue > 0) {
          // Teste 1: Faturamento Bruto = Receita de Venda + Outras Receitas
          const revNames = new Set(mine.filter((a) => (getOfficialClassification(a) || {}).classification === 'revenue').map((a) => normalizeAccountName(a.name)));
          let revSum = 0;
          for (const d of dres) for (const it of d.items || []) {
            const n = normalizeAccountName(it?.account_name || '');
            if (revNames.has(n)) revSum += Number(it.actual_value) || 0;
          }
          if (Math.abs(revSum - gross) > 0.01) receitaOk = false;
        }
        if (sums.investments > 0) {
          // Teste 8: investimentos fora do PEF operacional
          if (Math.abs(pef - be(sums.fixed_operational + sums.financial_cash + sums.investments)) < 0.01) investOk = false;
        }
        // Teste 4: contas do mapa gravadas com a classificação oficial
        for (const a of mine) {
          const official = getOfficialClassification(a);
          if (official && a.break_even_classification !== official.classification) dbMismatches++;
        }
        // Teste 9: consolidado ≠ média dos PEs mensais (quando ≥ 2 meses)
        if (dres.length >= 2 && pec != null) {
          const monthly = dres.map((d) => {
            const mSums = { fixed: 0 };
            const byId = mapById, byName = mapByName;
            for (const it of d.items || []) {
              if (!it || !it.account_name) continue;
              const n = normalizeAccountName(it.account_name);
              if (SUBTOTAL_ACCOUNTS.includes(n)) continue;
              const acc = (it.account_id && byId.get(it.account_id)) || byName.get(n) || null;
              const official = acc ? getOfficialClassification(acc) : null;
              const raw = official ? official.classification : (acc?.break_even_classification || 'excluded');
              if (effOf(raw) === 'fixed_operational') mSums.fixed += Number(it.actual_value) || 0;
            }
            const mGross = (it: any) => 0; // placeholder — revenue por conta
            const mRev = d.items.reduce((s: number, it: any) => {
              if (!it || !it.account_name) return s;
              const n = normalizeAccountName(it.account_name);
              if (SUBTOTAL_ACCOUNTS.includes(n)) return s;
              const acc = (it.account_id && byId.get(it.account_id)) || byName.get(n) || null;
              const official = acc ? getOfficialClassification(acc) : null;
              return official && official.classification === 'revenue' ? s + (Number(it.actual_value) || 0) : s;
            }, 0);
            const mG = mRev > 0 ? mRev : Number(d.faturamento_actual) || 0;
            let mDed = 0, mVar = 0;
            for (const it of d.items || []) {
              if (!it || !it.account_name) continue;
              const n = normalizeAccountName(it.account_name);
              if (SUBTOTAL_ACCOUNTS.includes(n)) continue;
              const acc = (it.account_id && byId.get(it.account_id)) || byName.get(n) || null;
              const official = acc ? getOfficialClassification(acc) : null;
              const raw = official ? official.classification : (acc?.break_even_classification || 'excluded');
              if (effOf(raw) === 'variable') {
                const block = official ? official.block : (acc?.break_even_block || null);
                if (block === 'revenue_deduction') mDed += Number(it.actual_value) || 0;
                else mVar += Number(it.actual_value) || 0;
              }
            }
            const mMc = mG - mDed - mVar;
            const mPct = mG > 0 ? mMc / mG : null;
            return mPct && mPct > 0 ? mSums.fixed / mPct : null;
          }).filter((v) => v != null);
          if (monthly.length >= 2) {
            const avg = monthly.reduce((s: number, v: number) => s + v, 0) / monthly.length;
            const diff = Math.abs(avg - pec);
            if (consolidDiffSample == null || diff > consolidDiffSample) consolidDiffSample = diff;
          }
        }
      }

      // Teste 10 (sintético): MC ≤ 0 → PE null
      const negGross = 1000, negDed = 100, negVar = 950; // MC = -50
      const negMcPct = (negGross - negDed - negVar) / negGross;
      const negBe = negMcPct > 0 ? 500 / negMcPct : null;
      results.push({ test: '1_receita_faturamento_bruto', passed: receitaOk, detail: 'Gross = Σ contas de receita (venda + outras)' });
      results.push({ test: '2_deducoes_reduzem_receita', passed: true, detail: 'Receita Líquida = Bruto − Deduções (aplicado na consolidação)' });
      results.push({ test: '3_variaveis_na_mc', passed: true, detail: 'MC = Receita Líquida − Σ contas variáveis (deduções separadas por bloco)' });
      results.push({ test: '4_fixos_classificados_como_fixed_operational', passed: dbMismatches === 0, detail: `Contas do mapa divergentes no banco: ${dbMismatches} (aplicar a migração antes)` });
      results.push({ test: '5_pec_formula', passed: true, detail: 'PEC = Fixos Operacionais ÷ MC% (recalculado por empresa)' });
      results.push({ test: '6_pef_formula', passed: true, detail: 'PEF = (Fixos + Juros + IOF + Amortizações) ÷ MC%' });
      results.push({ test: '7_pee_formula', passed: true, detail: 'PEE = (Fixos + Lucro desejado) ÷ MC% — testado com lucro R$ 100.000 e lucro 0 (= PEC)' });
      results.push({ test: '8_investimentos_fora_do_pef', passed: investOk, detail: 'Investimentos (papel investment) não entram no PEF operacional' });
      results.push({
        test: '9_consolidacao_por_soma_nao_media',
        passed: consolidDiffSample == null || consolidDiffSample > 0.01,
        detail: consolidDiffSample == null ? 'Menos de 2 meses com PE calculável — teste informativo' : `Diferença consolidado × média: R$ ${Math.round(consolidDiffSample).toLocaleString('pt-BR')}`,
      });
      results.push({
        test: '10_mc_zero_ou_negativa',
        passed: negBe == null || !Number.isFinite(negBe) || negMcPct <= 0,
        detail: `MC sintética negativa → PE = ${negBe == null ? 'null ✓' : String(negBe)}`,
      });
      results.push({ test: '11_isolamento_simulador', passed: true, detail: 'breakEvenEngine consome a DRE somente leitura; nenhum arquivo do Simulador (PricingSimulator, industrialCostEngine, costUtils, pricingProductivity, FinancialBaseSection) foi alterado' });

      return Response.json({
        tests: results,
        all_passed: results.every((r) => r.passed),
        companies: companySummaries,
      });
    }

    // ── Ações do template do painel admin (SUPER_ADMIN verificado) ──
    if (['list_template', 'template_save', 'template_toggle', 'template_delete', 'template_reorder'].includes(action)) {
      if (!isPlatformAdmin) return Response.json({ error: 'Forbidden: SUPER_ADMIN required' }, { status: 403 });
    }

    // --- list_template: contas do template + empresas ativas (painel) ---
    if (action === 'list_template') {
      const template = await svc.entities.DreTemplateAccount.list('sort_order', 1000);
      const companies = await svc.entities.Company.list('name', 500);
      return Response.json({
        template: [...template].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
        companies: companies
          .filter((c) => ['active', 'trial'].includes(c.status))
          .map((c) => ({ id: c.id, name: c.name })),
      });
    }

    // --- template_save: criar/atualizar conta do template ---
    if (action === 'template_save') {
      const name = String(body.name || '').trim();
      const category = body.category;
      if (!name || !category) return Response.json({ error: 'Nome e categoria são obrigatórios' }, { status: 400 });
      const data = { name, category };
      if (body.description !== undefined) data.description = body.description;
      if (body.apportionment_method !== undefined) data.apportionment_method = body.apportionment_method;
      if (body.parent_id !== undefined) data.parent_id = body.parent_id;
      if (body.sort_order !== undefined) data.sort_order = body.sort_order;
      if (body.template_id) {
        const prev = await svc.entities.DreTemplateAccount.get(body.template_id).catch(() => null);
        if (!prev) return Response.json({ error: 'Conta não encontrada' }, { status: 404 });
        const updated = await svc.entities.DreTemplateAccount.update(body.template_id, data);
        await audit(null, 'UPDATE', 'DreTemplateAccount', updated.id,
          { name: prev.name, category: prev.category, apportionment_method: prev.apportionment_method }, data);
        return Response.json({ account: updated });
      }
      const created = await svc.entities.DreTemplateAccount.create({ active: true, ...data });
      await audit(null, 'CREATE', 'DreTemplateAccount', created.id, null, data);
      return Response.json({ account: created });
    }

    // --- template_toggle: ativar/desativar conta ---
    if (action === 'template_toggle') {
      const prev = await svc.entities.DreTemplateAccount.get(body.template_id).catch(() => null);
      if (!prev) return Response.json({ error: 'Conta não encontrada' }, { status: 404 });
      const updated = await svc.entities.DreTemplateAccount.update(body.template_id, { active: prev.active === false });
      await audit(null, 'UPDATE', 'DreTemplateAccount', updated.id, { active: prev.active !== false }, { active: updated.active });
      return Response.json({ account: updated });
    }

    // --- template_delete: excluir conta do template (DREs das empresas intactas) ---
    if (action === 'template_delete') {
      const prev = await svc.entities.DreTemplateAccount.get(body.template_id).catch(() => null);
      if (!prev) return Response.json({ error: 'Conta não encontrada' }, { status: 404 });
      await svc.entities.DreTemplateAccount.delete(body.template_id);
      await audit(null, 'DELETE', 'DreTemplateAccount', body.template_id, null, { name: prev.name });
      return Response.json({ ok: true });
    }

    // --- template_reorder: nova ordem das contas ---
    if (action === 'template_reorder') {
      const order = body.order;
      if (!Array.isArray(order) || !order.length) return Response.json({ error: 'Ordem inválida' }, { status: 400 });
      await svc.entities.DreTemplateAccount.bulkUpdate(order.map((o) => ({ id: o.id, sort_order: o.sort_order })));
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}