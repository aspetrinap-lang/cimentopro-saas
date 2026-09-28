import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { requirePlatformAdmin, isProtectedPlatformAdmin } from '../../shared/platformAdmin.ts';

// Gestão de usuários e SUPER_ADMINs da plataforma CimentoPro.
//   - list: usuários com vínculos de empresa e status REAL de SUPER_ADMIN
//           (fonte protegida PlatformAdmin — nunca a flag da sessão).
//   - checkAccess: confirmação do guarda do painel /admin.
//   - migrateSuperAdmins: migração única e idempotente da flag da sessão
//     para a fonte protegida (bootstrap da plataforma).
//   - setPlatformAdmin: promover/rebaixar SUPER_ADMIN — exige digitar o
//     e-mail do alvo (confirmação dupla), sincroniza o cache da sessão do
//     alvo e registra PERMISSION_CHANGE na auditoria.
//   - listAudit: registros de auditoria com filtros por empresa e período.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    let body = {};
    try { body = await req.json(); } catch (error) { body = {}; }
    const action = body.action;
    const svc = base44.asServiceRole;
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || null;

    // ── migrateSuperAdmins: migração única (bootstrap) ──
    // Aceita a flag da sessão APENAS enquanto nenhum SUPER_ADMIN existir na
    // fonte protegida. Idempotente: pula quem já tem registro ativo.
    if (action === 'migrateSuperAdmins') {
      let me = null;
      try { me = await base44.auth.me(); } catch (error) { me = null; }
      if (!me || !me.id) return Response.json({ error: 'Não autenticado' }, { status: 401 });
      const adminRecs = await svc.entities.PlatformAdmin.filter({ active: true }, '-created_date', 500).catch(() => []);
      if (adminRecs.length > 0) {
        const ok = await isProtectedPlatformAdmin(svc, me.id);
        if (!ok) return Response.json({ error: 'Forbidden: SUPER_ADMIN required' }, { status: 403 });
      } else {
        const flag = me.is_platform_admin === true || (me.data && me.data.is_platform_admin) === true;
        if (flag !== true) return Response.json({ error: 'Forbidden: SUPER_ADMIN required' }, { status: 403 });
      }
      const users = await svc.entities.User.list('-created_date', 1000);
      const protectedIds = new Set(adminRecs.map((a) => a.user_id));
      const flagged = users.filter((u) => u.is_platform_admin === true || (u.data && u.data.is_platform_admin) === true);
      const toCreate = flagged.filter((u) => !protectedIds.has(u.id));
      if (toCreate.length) {
        await svc.entities.PlatformAdmin.bulkCreate(
          toCreate.map((u) => ({ user_id: u.id, user_email: u.email || '', active: true }))
        );
      }
      await svc.entities.AuditLog.create({
        user_id: me.id,
        user_email: me.email,
        company_id: null,
        action: 'UPDATE',
        entity_name: 'PlatformAdmin',
        entity_id: null,
        ip,
        old_value: { source: 'session_flag', flagged: flagged.length },
        new_value: { source: 'protected_entity', migrated: toCreate.length },
      });
      return Response.json({ migrated: toCreate.length, already: adminRecs.length });
    }

    // ── Demais ações: exigem SUPER_ADMIN verificado na fonte protegida ──
    const auth = await requirePlatformAdmin(base44);
    if (auth.response) return auth.response;
    const user = auth.user;

    if (action === 'list') {
      const users = await svc.entities.User.list('-created_date', 1000);
      const links = await svc.entities.UserCompany.filter({}, '-created_date', 1000);
      const adminRecs = await svc.entities.PlatformAdmin.filter({ active: true }, '-created_date', 500).catch(() => []);
      const adminIds = new Set(adminRecs.map((a) => a.user_id));

      const linksByUser = {};
      for (const link of links) {
        if (!linksByUser[link.user_id]) linksByUser[link.user_id] = [];
        linksByUser[link.user_id].push({
          company_id: link.company_id,
          company_name: link.company_name,
          role: link.role,
          status: link.status,
        });
      }

      // Migração pendente: usuário com a flag da sessão ainda sem registro na
      // fonte protegida. Após a migração, a flag sozinha não vale nada.
      const needsMigration = users.some(
        (u) => (u.is_platform_admin === true || (u.data && u.data.is_platform_admin) === true) && !adminIds.has(u.id)
      );

      return Response.json({
        users: users.map((u) => ({
          id: u.id,
          full_name: u.full_name,
          email: u.email,
          role: u.role,
          is_platform_admin: adminIds.has(u.id),
          companies: linksByUser[u.id] || [],
        })),
        platform_admins: adminRecs.map((a) => ({ user_id: a.user_id, user_email: a.user_email })),
        needs_migration: needsMigration,
      });
    }

    if (action === 'checkAccess') {
      return Response.json({ is_platform_admin: true, user_id: user.id });
    }

    // ── Promover/rebaixar SUPER_ADMIN (confirmação dupla + auditoria) ──
    if (action === 'setPlatformAdmin') {
      const targetId = String(body.user_id || '');
      const active = body.active === true;
      const confirmEmail = String(body.confirm_email || '').trim().toLowerCase();
      if (!targetId) return Response.json({ error: 'user_id é obrigatório' }, { status: 400 });

      const target = await svc.entities.User.get(targetId).catch(() => null);
      if (!target) return Response.json({ error: 'Usuário não encontrado' }, { status: 404 });
      if (String(target.email || '').trim().toLowerCase() !== confirmEmail || !confirmEmail) {
        return Response.json({ error: 'E-mail digitado não corresponde ao usuário — digite novamente para confirmar.' }, { status: 400 });
      }

      const recs = await svc.entities.PlatformAdmin.filter({ user_id: targetId }, '-created_date', 20).catch(() => []);
      const current = recs.find((r) => r.active) || null;
      if (active === (current !== null)) {
        return Response.json({ error: active ? 'Usuário já é SUPER_ADMIN' : 'Usuário não é SUPER_ADMIN' }, { status: 400 });
      }

      if (active) {
        if (current) {
          await svc.entities.PlatformAdmin.update(current.id, { active: true, user_email: target.email || '' });
        } else {
          await svc.entities.PlatformAdmin.create({ user_id: target.id, user_email: target.email || '', active: true });
        }
      } else {
        await svc.entities.PlatformAdmin.update(current.id, { active: false });
      }

      // Cache de exibição da sessão do alvo — nenhuma decisão de autorização
      // depende dele. O alvo precisa sair e entrar novamente para vê-lo.
      await svc.entities.User.update(target.id, { is_platform_admin: active }).catch(() => {});

      await svc.entities.AuditLog.create({
        user_id: user.id,
        user_email: user.email,
        company_id: null,
        action: 'PERMISSION_CHANGE',
        entity_name: 'PlatformAdmin',
        entity_id: target.id,
        ip,
        old_value: { is_platform_admin: !active },
        new_value: { is_platform_admin: active, target_email: target.email },
      });
      return Response.json({ ok: true, is_platform_admin: active, relogin_required: true });
    }

    // ── Auditoria da plataforma (filtros por empresa e período) ──
    if (action === 'listAudit') {
      const companies = await svc.entities.Company.list('name', 500);
      const query = {};
      if (body.company_id) query.company_id = body.company_id;
      let logs = await svc.entities.AuditLog.filter(query, '-created_date', 500).catch(() => []);
      if (body.start_date && /^\d{4}-\d{2}-\d{2}$/.test(String(body.start_date))) {
        logs = logs.filter((l) => String(l.created_date || '') >= `${body.start_date}T00:00:00`);
      }
      if (body.end_date && /^\d{4}-\d{2}-\d{2}$/.test(String(body.end_date))) {
        logs = logs.filter((l) => String(l.created_date || '') <= `${body.end_date}T23:59:59`);
      }
      return Response.json({
        logs,
        companies: companies.map((c) => ({ id: c.id, name: c.name })),
      });
    }

    return Response.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}