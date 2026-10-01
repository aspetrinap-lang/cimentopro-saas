import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Função centralizada de auditoria — a identidade do ator é derivada SEMPRE
// da sessão verificada no servidor (base44.auth.me()). Os campos user_id e
// user_email NUNCA são aceitos do cliente, impedindo falsificação da trilha.
// A escrita usa o service role para não depender de RLS de criação do cliente.

const SENSITIVE_KEYS = /password|senha|pass|token|secret|credential|api_?key|authorization|pin|cookie|session/i;

function sanitize(value, depth = 0) {
  if (value == null || depth > 4) return undefined;
  if (Array.isArray(value)) {
    return value.map((v) => sanitize(v, depth + 1));
  }
  if (typeof value === 'object') {
    const out = {};
    for (const [key, v] of Object.entries(value)) {
      if (SENSITIVE_KEYS.test(key)) continue;
      const clean = sanitize(v, depth + 1);
      if (clean !== undefined) out[key] = clean;
    }
    return out;
  }
  return value;
}

const ALLOWED_ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'PERMISSION_CHANGE', 'COMPANY_STATUS_CHANGE'];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || !user.id) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }
    const svc = base44.asServiceRole;
    const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || null;

    let body = {};
    try { body = await req.json(); } catch (error) { body = {}; }

    const action = String(body.action || '').toUpperCase();
    const entityName = String(body.entity_name || '').trim();
    if (!ALLOWED_ACTIONS.includes(action)) {
      return Response.json({ error: 'Ação de auditoria inválida' }, { status: 400 });
    }
    if (!entityName) {
      return Response.json({ error: 'entity_name é obrigatório' }, { status: 400 });
    }

    const record = {
      user_id: user.id,
      user_email: user.email || null,
      company_id: body.company_id || null,
      action,
      entity_name: entityName,
      entity_id: body.entity_id || null,
      old_value: body.old_value != null ? sanitize(body.old_value) : null,
      new_value: body.new_value != null ? sanitize(body.new_value) : null,
      ip,
    };
    await svc.entities.AuditLog.create(record).catch(() => null);
    return Response.json({ ok: true });
  } catch (error) {
    // Auditoria é best-effort: erros não devem interromper a operação originária.
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}