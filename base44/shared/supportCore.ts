// Núcleo do módulo de Suporte — compartilhado pelas funções backend.
// Constantes, validações, numeração de chamados, notificações in-app + e-mail
// e auditoria. Autorização multi-tenant é SEMPRE resolvida no backend
// (UserCompany + PlatformAdmin) — o frontend nunca decide empresa/acesso.

export const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'WAITING_INTERNAL', 'RESOLVED', 'CLOSED'];
export const TICKET_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
export const TICKET_SOURCES = ['IN_APP', 'HELP_CENTER', 'ERROR_REPORT', 'EMAIL', 'WHATSAPP', 'SYSTEM'];
export const TICKET_CATEGORIES = [
  'DUVIDA', 'ERRO_SISTEMA', 'PRODUCAO', 'QUALIDADE', 'MANUTENCAO', 'CUSTOS', 'DRE',
  'SIMULADOR_PRECOS', 'PONTO_EQUILIBRIO', 'LAUDOS', 'IA', 'USUARIOS_PERMISSOES',
  'ASSINATURA', 'SUGESTAO', 'OUTROS',
];
export const SENDER_TYPES = ['CUSTOMER', 'SUPPORT', 'SYSTEM', 'AI'];
export const NOTIFICATION_TYPES = ['NEW_TICKET', 'NEW_MESSAGE', 'STATUS_CHANGED', 'ASSIGNED', 'RESOLVED', 'SATISFACTION'];
export const ATTACHMENT_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'pdf', 'xlsx', 'csv'];
export const MAX_ATTACHMENT_MB = 10;
export const MAX_ATTACHMENTS = 5;
export const PRIORITY_ORDER = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };

// Próximo número sequencial de chamado por empresa.
export async function nextTicketNumber(svc, companyId) {
  const last = await svc.entities.SupportTicket.filter({ company_id: companyId }, '-ticket_number', 1).catch(() => []);
  return (last[0]?.ticket_number || 0) + 1;
}

// Usuários SUPER_ADMIN ativos (destinatários das notificações do suporte).
export async function activePlatformAdmins(svc) {
  const recs = await svc.entities.PlatformAdmin.filter({ active: true }, '-created_date', 50).catch(() => []);
  const users = (await Promise.all(recs.map((r) => svc.entities.User.get(r.user_id).catch(() => null)))).filter(Boolean);
  return users.map((u) => ({ id: u.id, email: u.email || '', full_name: u.full_name || u.email || '' }));
}

// Auditoria do suporte — usa o AuditLog existente (sem alterar o enum de ações):
// CREATE/UPDATE + entity_name do suporte + detalhe da mudança em new_value.
export async function auditSupport(svc, { user_id, user_email, company_id, entity_name, entity_id, action, old_value, new_value, ip }) {
  await svc.entities.AuditLog.create({
    user_id,
    user_email,
    company_id: company_id || null,
    action,
    entity_name,
    entity_id: entity_id || null,
    old_value: old_value || null,
    new_value: new_value || null,
    ip: ip || null,
  }).catch(() => { /* auditoria é best-effort, nunca interrompe a operação */ });
}

// Notificações in-app (+ e-mail opcional) — destinatários são usuários
// registrados do app. Best-effort: falha de notificação não interrompe a ação.
export async function notifyUsers(svc, {
  recipients, excludeUserId, type, ticket, title, body,
  emailSubject, emailBody, email = false,
}) {
  const list = (recipients || []).filter((r) => r && r.id && r.id !== excludeUserId);
  for (const r of list) {
    await svc.entities.SupportNotification.create({
      recipient_user_id: r.id,
      ticket_id: ticket.id,
      ticket_number: ticket.ticket_number,
      company_id: ticket.company_id,
      type,
      title,
      body: (body || '').slice(0, 300),
      read: false,
    }).catch(() => {});
    if (email && r.email) {
      await svc.integrations.Core.SendEmail({
        to: r.email,
        subject: emailSubject,
        body: emailBody,
      }).catch(() => { /* e-mail é complementar */ });
    }
  }
}

// Valida anexos: extensão permitida, tamanho e quantidade. Retorna os válidos.
export function sanitizeAttachments(attachments) {
  const list = Array.isArray(attachments) ? attachments : [];
  const valid = [];
  for (const a of list.slice(0, MAX_ATTACHMENTS)) {
    if (!a || !a.file_uri) continue;
    const name = String(a.file_name || 'arquivo');
    const ext = name.split('.').pop().toLowerCase();
    if (!ATTACHMENT_EXTENSIONS.includes(ext)) continue;
    const size = Number(a.file_size) || 0;
    if (size > MAX_ATTACHMENT_MB * 1024 * 1024) continue;
    valid.push({
      file_name: name,
      file_uri: a.file_uri,
      mime_type: a.mime_type || '',
      file_size: size,
    });
  }
  return valid;
}

// #000124
export function padTicketNumber(n) {
  return `#${String(Number(n) || 0).padStart(6, '0')}`;
}