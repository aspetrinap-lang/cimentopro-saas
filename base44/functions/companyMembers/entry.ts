import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Gestão de vínculos usuário-empresa (UserCompany) e sincronização do cache
// user.company_ids — base das regras RLS de multi-tenancy.
// Autorização: SUPER_ADMIN da plataforma OU dono/admin da empresa em questão.
// Fluxo de convite direto: quando o e-mail ainda não tem conta, o SUPER ADMIN
// envia o convite da plataforma e registra o vínculo como 'invited' (pendente,
// por e-mail). Ao aceitar o convite e entrar no CimentoPro, o próprio usuário
// ativa o vínculo (ação activateInvites) — o primeiro acesso já entra na
// empresa, sem a tela de "Nenhuma empresa vinculada".
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
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || null;

    // Mantém o cache company_ids do usuário em sincronia com os vínculos ativos.
    const syncUserCompanies = async (userId) => {
      const links = await svc.entities.UserCompany.filter({ user_id: userId, status: 'active' });
      const ids = [...new Set(links.map((l) => l.company_id))];
      await svc.entities.User.update(userId, { company_ids: ids });
    };

    // ── Ativação dos convites pendentes pelo próprio usuário ──
    // Executada no início da sessão (CompanyContext): vincula os convites
    // registrados para o e-mail do usuário ao seu ID, ativa-os e sincroniza o
    // cache company_ids — garantindo empresa visível já no primeiro acesso.
    if (action === 'activateInvites') {
      const email = String(auth.email || '').trim().toLowerCase();
      if (!email) return Response.json({ error: 'E-mail do usuário indisponível' }, { status: 400 });
      const pending = await svc.entities.UserCompany.filter({ status: 'invited' }, '-created_date', 500);
      const mine = pending.filter((l) => String(l.user_email || '').trim().toLowerCase() === email);
      const activated = [];
      for (const link of mine) {
        const company = await svc.entities.Company.get(link.company_id).catch(() => null);
        if (!company || !['active', 'trial'].includes(company.status)) continue;
        await svc.entities.UserCompany.update(link.id, {
          user_id: auth.id,
          user_name: auth.full_name || '',
          status: 'active',
        });
        await svc.entities.AuditLog.create({
          user_id: auth.id,
          user_email: auth.email,
          company_id: link.company_id,
          action: 'UPDATE',
          entity_name: 'UserCompany',
          entity_id: link.id,
          ip,
          old_value: { status: 'invited', user_email: link.user_email, role: link.role },
          new_value: { status: 'active', user_id: auth.id, role: link.role },
        });
        activated.push({ company_id: link.company_id, company_name: company.name, role: link.role });
      }
      if (activated.length) await syncUserCompanies(auth.id);
      return Response.json({ activated });
    }

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
        // E-mail ainda sem conta: apenas o SUPER ADMIN da plataforma pode
        // convidar. O convite da plataforma é enviado (a pessoa define a senha
        // pelo e-mail) e o vínculo fica PENDENTE por e-mail — ativado
        // automaticamente quando a pessoa entra no CimentoPro pela primeira vez.
        if (!isPlatformAdmin) {
          return Response.json({ error: 'Usuário não encontrado. A pessoa precisa criar a conta no CimentoPro antes — ou peça ao administrador da plataforma para enviá-la um convite de acesso.' }, { status: 404 });
        }
        const pending = await svc.entities.UserCompany.filter({ company_id: companyId, status: 'invited' }, '-created_date', 500);
        const myPending = pending.filter((l) => String(l.user_email || '').trim().toLowerCase() === email);
        if (myPending.length) {
          const link = myPending[0];
          if (link.role === role) {
            return Response.json({ error: 'Convite já enviado para este e-mail nesta empresa' }, { status: 400 });
          }
          const updated = await svc.entities.UserCompany.update(link.id, { role, company_name: company.name });
          await audit('PERMISSION_CHANGE', link.id, { role: link.role, status: 'invited' }, { role, status: 'invited' });
          return Response.json({ member: updated, invited: true });
        }
        let inviteError = null;
        try {
          await base44.users.inviteUser(email, 'user');
        } catch (error) {
          // E-mail já convidado anteriormente é o caso comum (re-convite após
          // remoção): o vínculo pendente é criado mesmo assim.
          inviteError = error.message;
        }
        const created = await svc.entities.UserCompany.create({
          user_id: '',
          user_email: email,
          user_name: '',
          company_id: companyId,
          company_name: company.name,
          role,
          status: 'invited',
          is_owner: role === 'owner',
        });
        await audit('CREATE', created.id, null, { user_email: email, role, invited: true });
        return Response.json({ member: created, invited: true, invite_error: inviteError });
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
      await audit('CREATE', created.id, null, { user_email: target.email, role });
      return Response.json({ member: created });
    }

    if (action === 'unlink') {
      // O membro é identificado pelo ID do vínculo — convites pendentes não
      // têm user_id e não podem ser removidos por user_id.
      const linkId = body.link_id;
      const userId = body.user_id;
      let links = [];
      if (linkId) {
        const link = await svc.entities.UserCompany.get(linkId).catch(() => null);
        if (link && link.company_id === companyId) links = [link];
      } else if (userId) {
        links = await svc.entities.UserCompany.filter({ user_id: userId, company_id: companyId });
      }
      if (!links.length) return Response.json({ error: 'Vínculo não encontrado' }, { status: 404 });
      const owners = await svc.entities.UserCompany.filter({ company_id: companyId, role: 'owner', status: 'active' });
      if (owners.length <= 1 && links[0].role === 'owner' && links[0].status === 'active') {
        return Response.json({ error: 'A empresa precisa de pelo menos um dono ativo' }, { status: 400 });
      }
      for (const link of links) await svc.entities.UserCompany.delete(link.id);
      if (links[0].user_id) await syncUserCompanies(links[0].user_id);
      await audit('DELETE', links[0].id, { user_email: links[0].user_email, role: links[0].role, status: links[0].status }, null);
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}