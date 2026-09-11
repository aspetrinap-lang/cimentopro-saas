import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Gestão de vínculos usuário-empresa (UserCompany) e sincronização do cache
// user.company_ids — base das regras RLS de multi-tenancy.
// Autorização: SUPER_ADMIN da plataforma OU dono/admin da empresa em questão.
const ROLES = ['owner', 'admin', 'supervisor'];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await base44.auth.me();
    if (!auth) return Response.json({ error: 'Não autenticado' }, { status: 401 });
    const svc = base44.asServiceRole;

    let body = {};
    try { body = await req.json(); } catch (error) { body = {}; }
    const action = body.action;
    const companyId = body.company_id;
    if (!companyId) return Response.json({ error: 'company_id é obrigatório' }, { status: 400 });

    const isPlatformAdmin = auth.is_platform_admin === true || (auth.data && auth.data.is_platform_admin) === true;
    const myLinks = await svc.entities.UserCompany.filter({ user_id: auth.id, company_id: companyId });
    const isCompanyManager = myLinks.some((l) => l.status === 'active' && ['owner', 'admin'].includes(l.role));
    if (!isPlatformAdmin && !isCompanyManager) {
      return Response.json({ error: 'Sem permissão para gerenciar esta empresa' }, { status: 403 });
    }

    const company = await svc.entities.Company.get(companyId).catch(() => null);
    if (!company) return Response.json({ error: 'Empresa não encontrada' }, { status: 404 });

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || null;

    const audit = async (actionName, entityId, oldValue, newValue) => {
      await svc.entities.AuditLog.create({
        user_id: auth.id,
        user_email: auth.email,
        company_id: companyId,
        action: actionName,
        entity_name: 'UserCompany',
        entity_id: entityId,
        ip,
        old_value: oldValue || null,
        new_value: newValue || null,
      });
    };

    // Mantém o cache company_ids do usuário em sincronia com os vínculos ativos.
    const syncUserCompanies = async (userId) => {
      const links = await svc.entities.UserCompany.filter({ user_id: userId, status: 'active' });
      const ids = [...new Set(links.map((l) => l.company_id))];
      await svc.entities.User.update(userId, { company_ids: ids });
    };

    if (action === 'list') {
      const links = await svc.entities.UserCompany.filter({ company_id: companyId }, '-created_date', 500);
      return Response.json({ members: links });
    }

    if (action === 'link') {
      const email = String(body.email || '').trim().toLowerCase();
      const role = body.role;
      if (!email || !ROLES.includes(role)) {
        return Response.json({ error: 'E-mail e papel (owner, admin ou supervisor) são obrigatórios' }, { status: 400 });
      }
      const users = await svc.entities.User.filter({ email });
      let target = users && users[0];
      let invited = false;
      if (!target) {
        // E-mail sem conta: apenas o SUPER ADMIN da plataforma pode convidar
        // (o convite cria a conta e envia o e-mail de acesso). O vínculo é
        // criado na mesma ação, garantindo que o primeiro login já entre na
        // empresa com o cache company_ids sincronizado.
        if (!isPlatformAdmin) {
          return Response.json({ error: 'Usuário não encontrado. A pessoa precisa criar a conta no CimentoPro antes — ou peça ao administrador da plataforma para enviá-la um convite de acesso.' }, { status: 404 });
        }
        await base44.users.inviteUser(email, 'user');
        const invitedUsers = await svc.entities.User.filter({ email });
        target = invitedUsers && invitedUsers[0];
        if (!target) {
          return Response.json({ error: 'Convite enviado, mas a conta ainda não foi criada pelo servidor. Tente vincular novamente em instantes.' }, { status: 409 });
        }
        invited = true;
      }
      const existing = await svc.entities.UserCompany.filter({ user_id: target.id, company_id: companyId });
      if (existing.length) {
        const link = existing[0];
        if (link.status === 'active' && link.role === role) {
          return Response.json({ error: 'Usuário já está vinculado a esta empresa com este papel' }, { status: 400 });
        }
        const updated = await svc.entities.UserCompany.update(link.id, {
          role, status: 'active', user_email: target.email, user_name: target.full_name, company_name: company.name,
        });
        await syncUserCompanies(target.id);
        await audit('PERMISSION_CHANGE', link.id, { role: link.role, status: link.status }, { role, status: 'active' });
        return Response.json({ member: updated });
      }
      const created = await svc.entities.UserCompany.create({
        user_id: target.id,
        user_email: target.email,
        user_name: target.full_name,
        company_id: companyId,
        company_name: company.name,
        role,
        status: 'active',
        is_owner: role === 'owner',
      });
      await syncUserCompanies(target.id);
      await audit('CREATE', created.id, null, { user_email: target.email, role, invited });
      return Response.json({ member: created, invited });
    }

    if (action === 'unlink') {
      const userId = body.user_id;
      if (!userId) return Response.json({ error: 'user_id é obrigatório' }, { status: 400 });
      const links = await svc.entities.UserCompany.filter({ user_id: userId, company_id: companyId });
      if (!links.length) return Response.json({ error: 'Vínculo não encontrado' }, { status: 404 });
      const owners = await svc.entities.UserCompany.filter({ company_id: companyId, role: 'owner', status: 'active' });
      if (owners.length <= 1 && links[0].role === 'owner' && links[0].status === 'active') {
        return Response.json({ error: 'A empresa precisa de pelo menos um dono ativo' }, { status: 400 });
      }
      for (const link of links) await svc.entities.UserCompany.delete(link.id);
      await syncUserCompanies(userId);
      await audit('DELETE', links[0].id, { user_email: links[0].user_email, role: links[0].role }, null);
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}