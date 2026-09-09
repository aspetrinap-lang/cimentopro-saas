import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { requirePlatformAdmin } from '../../shared/platformAdmin.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requirePlatformAdmin(base44);
    if (auth.response) return auth.response;
    const svc = base44.asServiceRole;

    let body = {};
    try { body = await req.json(); } catch (error) { body = {}; }

    if (body.action !== 'list') {
      return Response.json({ error: 'Ação inválida' }, { status: 400 });
    }

    const users = await svc.entities.User.list('-created_date', 1000);
    const links = await svc.entities.UserCompany.filter({}, '-created_date', 1000);

    const linksByUser = {};
    for (const link of links) {
      if (!linksByUser[link.user_id]) linksByUser[link.user_id] = [];
      linksByUser[link.user_id].push({
        company_id: link.company_id,
        company_name: link.company_name,
        role: link.role,
        status: link.status
      });
    }

    return Response.json({
      users: users.map((u) => ({
        id: u.id,
        full_name: u.full_name,
        email: u.email,
        role: u.role,
        is_platform_admin: u.is_platform_admin === true || (u.data && u.data.is_platform_admin) === true,
        companies: linksByUser[u.id] || []
      }))
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}