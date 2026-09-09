// Auditoria central de operações importantes.
// Uso: logAudit({ action, entity_name, entity_id, old_value, new_value, company_id })
// A auditoria nunca quebra a operação que a originou (erros silenciosos)
// e nunca registra dados sensíveis (senhas, tokens, credenciais, PIN).
import { base44 } from '@/api/base44Client';
import { getCurrentCompanyId } from '@/lib/CompanyContext';

// Chaves proibidas no log: senhas, tokens, credenciais e afins.
const SENSITIVE_KEYS = /password|senha|pass|token|secret|credential|api_?key|authorization|pin|cookie|session/i;

function sanitize(value, depth = 0) {
  if (value == null || depth > 4) return undefined;
  if (Array.isArray(value)) {
    return value.map((v) => sanitize(v, depth + 1));
  }
  if (typeof value === 'object') {
    const out = {};
    for (const [key, v] of Object.entries(value)) {
      if (SENSITIVE_KEYS.test(key)) continue; // nunca registrar dados sensíveis
      const clean = sanitize(v, depth + 1);
      if (clean !== undefined) out[key] = clean;
    }
    return out;
  }
  return value;
}

export async function logAudit({
  action,
  entity_name,
  entity_id = null,
  company_id,
  old_value = null,
  new_value = null,
}) {
  try {
    let user = null;
    try { user = await base44.auth.me(); } catch { user = null; }
    await base44.entities.AuditLog.create({
      user_id: user?.id || null,
      user_email: user?.email || null,
      company_id: company_id !== undefined ? company_id : (getCurrentCompanyId() || null),
      action,
      entity_name,
      entity_id: entity_id || null,
      old_value: old_value != null ? sanitize(old_value) : null,
      new_value: new_value != null ? sanitize(new_value) : null,
    });
  } catch {
    // Auditoria é best-effort: falhas no log não devem interromper a operação.
  }
}