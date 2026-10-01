import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { extractCompanyIds, isRoleAdminUser, makeAuditor } from '../../shared/companyAccess.ts';

// Aplica as permissões do operador (login por PIN) no SERVIDOR antes de
// executar mutações no Painel do Operador. A sessão autenticada subjacente
// é do administrador do dispositivo; sem esta verificação, um operador com
// PIN poderia executar operações administrativas usando a sessão completa.
//
// A identidade do operador é carregada server-side (UserPin + UserRoleProfile)
// — o cliente nunca informa as permissões; apenas o operator_id (que já foi
// verificado no login por PIN). A mutação é executada com service role,
// escopada à empresa do operador.

const FULL_OPERATIONAL = new Set([
  'INDICATORS_VIEW',
  'PRODUCTION_VIEW', 'PRODUCTION_CREATE', 'PRODUCTION_EDIT', 'PRODUCTION_DELETE',
  'MACHINES_VIEW', 'MACHINES_CREATE', 'MACHINES_EDIT', 'MACHINES_DELETE',
  'MAINTENANCE_VIEW', 'MAINTENANCE_EDIT',
  'QUALITY_VIEW', 'QUALITY_EDIT',
  'COSTS_VIEW', 'COSTS_EDIT',
  'SETTINGS_VIEW', 'SETTINGS_MANAGE',
]);

const ROLE_GRANTS = {
  operador: new Set(['PRODUCTION_VIEW', 'PRODUCTION_CREATE']),
  user: new Set(['PRODUCTION_VIEW', 'PRODUCTION_CREATE']),
  supervisor: new Set([
    'INDICATORS_VIEW', 'PRODUCTION_VIEW', 'PRODUCTION_CREATE', 'PRODUCTION_EDIT',
    'MACHINES_VIEW', 'MACHINES_CREATE', 'MACHINES_EDIT',
    'MAINTENANCE_VIEW', 'MAINTENANCE_EDIT', 'QUALITY_VIEW', 'QUALITY_EDIT', 'COSTS_VIEW',
  ]),
  administrador: FULL_OPERATIONAL,
  admin: FULL_OPERATIONAL,
};

// Permissão exigida para cada operação de mutação do painel do operador.
const REQUIRED_PERMISSION = {
  ProductionOrder: { create: 'PRODUCTION_CREATE', update: 'PRODUCTION_EDIT' },
  MachineDowntime: { create: 'PRODUCTION_CREATE', update: 'PRODUCTION_EDIT' },
};

function resolveOperatorPermissions(role, profilePermissions) {
  if (profilePermissions && typeof profilePermissions === 'object') {
    const set = new Set();
    for (const [key, value] of Object.entries(profilePermissions)) {
      if (value === true) set.add(key);
    }
    if (set.size > 0) return set;
  }
  return ROLE_GRANTS[role] || ROLE_GRANTS.operador;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await base44.auth.me();
    if (!auth) return Response.json({ error: 'Não autenticado' }, { status: 401 });
    const svc = base44.asServiceRole;
    const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || null;
    const companyIds = extractCompanyIds(auth);
    const isRoleAdmin = isRoleAdminUser(auth);
    const audit = makeAuditor(svc, auth, ip, 'ProductionOrder');

    let body = {};
    try { body = await req.json(); } catch (error) { body = {}; }
    const entity = body.entity;
    const operation = body.operation;
    const operatorId = body.operator_id;
    const payload = body.payload || {};
    const entityId = body.entity_id || null;

    if (!['ProductionOrder', 'MachineDowntime'].includes(entity)) {
      return Response.json({ error: 'Entidade não suportada para ação do operador' }, { status: 400 });
    }
    if (!['create', 'update'].includes(operation)) {
      return Response.json({ error: 'Operação inválida' }, { status: 400 });
    }
    if (!operatorId) {
      return Response.json({ error: 'Operador é obrigatório' }, { status: 400 });
    }

    // Carrega o operador server-side (não confia no payload do cliente).
    const op = await svc.entities.UserPin.get(operatorId).catch(() => null);
    if (!op || op.active === false) {
      return Response.json({ error: 'Operador inválido ou inativo' }, { status: 404 });
    }
    // Isolamento por empresa: o operador precisa pertencer a uma empresa do
    // administrador autenticado. Admins da plataforma bypass.
    if (!isRoleAdmin && (!op.company_id || !companyIds.includes(op.company_id))) {
      return Response.json({ error: 'Operador fora do escopo da empresa' }, { status: 403 });
    }

    // Resolve permissões do perfil vinculado (ou fallback por papel).
    let profilePermissions = null;
    if (op.profile_id) {
      const profile = await svc.entities.UserRoleProfile.get(op.profile_id).catch(() => null);
      if (profile) profilePermissions = profile.permissions || null;
    }
    const perms = resolveOperatorPermissions(op.role, profilePermissions);
    const required = REQUIRED_PERMISSION[entity][operation];
    if (!perms.has(required)) {
      await audit('PERMISSION_CHANGE', null, op.company_id, { denied: true, operator: op.id, entity, operation, required });
      return Response.json({ error: `Operador sem permissão (${required}) para ${operation} em ${entity}` }, { status: 403 });
    }

    // Escopa a mutação à empresa do operador — nunca confia em company_id do cliente.
    const scopedPayload = { ...payload, company_id: op.company_id };

    if (entity === 'ProductionOrder') {
      if (operation === 'create') {
        const created = await svc.entities.ProductionOrder.create(scopedPayload);
        await audit('CREATE', created.id, op.company_id, { operator: op.id });
        return Response.json({ result: created });
      } else {
        if (!entityId) return Response.json({ error: 'entity_id é obrigatório para update' }, { status: 400 });
        await svc.entities.ProductionOrder.update(entityId, scopedPayload);
        await audit('UPDATE', entityId, op.company_id, { operator: op.id });
        return Response.json({ result: { id: entityId } });
      }
    }

    if (entity === 'MachineDowntime') {
      if (operation === 'create') {
        const created = await svc.entities.MachineDowntime.create(scopedPayload);
        await audit('CREATE', created.id, op.company_id, { operator: op.id, entity: 'MachineDowntime' });
        return Response.json({ result: created });
      } else {
        if (!entityId) return Response.json({ error: 'entity_id é obrigatório para update' }, { status: 400 });
        await svc.entities.MachineDowntime.update(entityId, scopedPayload);
        await audit('UPDATE', entityId, op.company_id, { operator: op.id, entity: 'MachineDowntime' });
        return Response.json({ result: { id: entityId } });
      }
    }

    return Response.json({ error: 'Operação não tratada' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}