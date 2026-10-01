import { base44 } from '@/api/base44Client';

// Cliente do módulo LGPD — todas as operações passam pela função backend `privacy`,
// que resolve autenticação, isolamento (titular vê apenas os próprios pedidos),
// protocolo aleatório, acesso excepcional auditado e retenção desativada por padrão.
export async function privacy(payload) {
  const res = await base44.functions.invoke('privacy', payload);
  return res?.data ?? res;
}

export async function createPrivacyRequest(request_type, description) {
  return privacy({ action: 'createRequest', request_type, description });
}

export async function listMyPrivacyRequests() {
  return privacy({ action: 'listMyRequests' });
}

export async function getPrivacyRequest(request_id) {
  return privacy({ action: 'getRequest', request_id });
}

export async function exportMyData() {
  return privacy({ action: 'exportMyData' });
}

export async function getActiveNotice() {
  return privacy({ action: 'getActiveNotice' });
}

export async function submitConsent(purpose, notice_version, { revoke, reason } = {}) {
  return privacy({ action: 'submitConsent', purpose, notice_version, revoke: !!revoke, reason });
}