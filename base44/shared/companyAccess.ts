// Helpers compartilhados de acesso multi-tenant para funções backend.
// Evita duplicação de lógica de empresa (vínculo, papéis, auditoria).

export function extractCompanyIds(auth) {
  return (Array.isArray(auth.company_ids) && auth.company_ids)
    || (auth.data && Array.isArray(auth.data.company_ids) && auth.data.company_ids) || [];
}

export function isRoleAdminUser(auth) {
  return ['admin', 'administrador'].includes(auth.role);
}

export function hasCompanyAccess(companyIds, isPlatformAdmin, isRoleAdmin, cid) {
  if (!cid) return false;
  if (isPlatformAdmin || isRoleAdmin) return true;
  return companyIds.includes(cid);
}

export async function canManageCompany(svc, auth, isPlatformAdmin, isRoleAdmin, cid) {
  if (isPlatformAdmin || isRoleAdmin) return true;
  if (!cid) return false;
  const links = await svc.entities.UserCompany.filter({ user_id: auth.id, company_id: cid });
  return links.some((l) => l.status === 'active' && ['owner', 'admin'].includes(l.role));
}

// Auditor compatível com chamadas de 4 args (newValue) e 5 args (oldValue, newValue).
export function makeAuditor(svc, auth, ip, entityName) {
  return async (actionName, entityId, companyId, arg4, arg5) => {
    const hasOld = arg5 !== undefined;
    const oldValue = hasOld ? arg4 : null;
    const newValue = hasOld ? arg5 : arg4;
    await svc.entities.AuditLog.create({
      user_id: auth.id,
      user_email: auth.email,
      company_id: companyId || null,
      action: actionName,
      entity_name: entityName,
      entity_id: entityId || null,
      old_value: oldValue || null,
      new_value: newValue || null,
      ip,
    }).catch(() => null);
  };
}