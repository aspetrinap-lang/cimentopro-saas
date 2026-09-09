import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { requirePlatformAdmin } from '../../shared/platformAdmin.ts';

const EDITABLE_FIELDS = ['name', 'legal_name', 'document', 'email', 'phone', 'address', 'city', 'state', 'zip_code'];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requirePlatformAdmin(base44);
    if (auth.response) return auth.response;
    const user = auth.user;
    const svc = base44.asServiceRole;

    let body = {};
    try { body = await req.json(); } catch (error) { body = {}; }
    const action = body.action;
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || null;

    const audit = async (actionName, companyId, metadata) => {
      await svc.entities.AuditLog.create({
        user_id: user.id,
        user_email: user.email,
        company_id: companyId,
        action: actionName,
        resource: 'company',
        resource_id: companyId,
        ip,
        metadata: metadata || {}
      });
    };

    if (action === 'list') {
      const companies = await svc.entities.Company.list('-created_date', 500);
      const links = await svc.entities.UserCompany.filter({ status: 'active' }, '-created_date', 1000);
      const counts = {};
      for (const link of links) counts[link.company_id] = (counts[link.company_id] || 0) + 1;
      return Response.json({
        companies: companies.map((c) => ({
          id: c.id,
          name: c.name,
          legal_name: c.legal_name,
          document: c.document,
          email: c.email,
          phone: c.phone,
          address: c.address,
          city: c.city,
          state: c.state,
          zip_code: c.zip_code,
          status: c.status,
          user_count: counts[c.id] || 0
        }))
      });
    }

    if (action === 'create') {
      if (!body.name || !String(body.name).trim()) {
        return Response.json({ error: 'Nome da empresa é obrigatório' }, { status: 400 });
      }
      const data = { status: 'active' };
      for (const field of EDITABLE_FIELDS) data[field] = body[field] !== undefined ? body[field] : '';
      data.name = String(body.name).trim();
      const created = await svc.entities.Company.create(data);
      await audit('COMPANY_CREATED', created.id, { name: created.name });
      return Response.json({ company: created });
    }

    if (action === 'update') {
      if (!body.company_id) {
        return Response.json({ error: 'company_id é obrigatório' }, { status: 400 });
      }
      const data = {};
      for (const field of EDITABLE_FIELDS) {
        if (body[field] !== undefined) data[field] = body[field];
      }
      if (data.name !== undefined) {
        if (!String(data.name).trim()) {
          return Response.json({ error: 'Nome da empresa é obrigatório' }, { status: 400 });
        }
        data.name = String(data.name).trim();
      }
      const updated = await svc.entities.Company.update(body.company_id, data);
      await audit('COMPANY_UPDATED', body.company_id, data);
      return Response.json({ company: updated });
    }

    if (action === 'suspend' || action === 'reactivate') {
      if (!body.company_id) {
        return Response.json({ error: 'company_id é obrigatório' }, { status: 400 });
      }
      const status = action === 'suspend' ? 'suspended' : 'active';
      const updated = await svc.entities.Company.update(body.company_id, { status });
      await audit(action === 'suspend' ? 'COMPANY_SUSPENDED' : 'COMPANY_REACTIVATED', body.company_id, { status });
      return Response.json({ company: updated });
    }

    return Response.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}