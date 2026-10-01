import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { isPlatformAdminVerified } from '../../shared/platformAdmin.ts';
import { extractCompanyIds, makeAuditor } from '../../shared/companyAccess.ts';

// Módulo LGPD — Direitos do Titular e Privacidade (rev. 2)
//
// Princípios:
// - O titular acessa APENAS os próprios pedidos (filtro por user_id autenticado).
// - Administradores de empresa NÃO recebem acesso automático a pedidos de titulares.
// - A equipe de privacidade começa VAZIA (ninguém processa por padrão).
// - Qualquer consulta fora do titular exige acesso excepcional de superadmin,
//   verificado no servidor (isPlatformAdminVerified), com justificativa e auditoria.
// - Protocolo aleatório e não previsível (crypto) — numeração sequencial apenas interna.
// - Validação de identidade proporcional: sessão autenticada por padrão, sem
//   coleta de documentos. Verificação adicional é opcional e com prazo de descarte.
// - Retenção/descarte DESATIVADO por padrão — nenhuma exclusão ou anonimização
//   automática até aprovação do controlador.
// - Nenhuma declaração de conformidade é emitida pelo código.

const REQUEST_TYPES = ['acesso', 'correcao', 'portabilidade', 'exclusao'];
const REQUEST_STATUSES = ['RECEBIDA', 'EM_ANALISE', 'AGUARDANDO_JURIDICO', 'CONCLUIDA', 'RECUSADA'];

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Protocolo aleatório e não previsível: LGPD- + base36 de 8 bytes aleatórios.
// Não revela volume nem facilita enumeração.
async function generateProtocol() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let num = 0n;
  for (const b of bytes) num = (num << 8n) | BigInt(b);
  let str = num.toString(36).toUpperCase();
  while (str.length < 12) str = '0' + str;
  return `LGPD-${str}`;
}

// Equipe de privacidade: lista de user_ids armazenada em AppSettings (key privacy_team_members).
// Começa VAZIA por padrão — ninguém processa pedidos até designação no backend.
async function getPrivacyTeamMembers(svc) {
  const settings = await svc.entities.AppSettings.filter({ key: 'privacy_team_members' }).catch(() => []);
  const value = settings?.[0]?.value;
  if (Array.isArray(value)) return value;
  return [];
}

async function isPrivacyTeamMember(svc, auth) {
  const team = await getPrivacyTeamMembers(svc);
  return team.includes(auth.id);
}

// Acesso excepcional: apenas superadmin validado no servidor, com justificativa
// registrada. Não aceita flag enviada pelo navegador como autorização.
async function assertExceptionalAccess(svc, auth, ip, justification) {
  const isPlatformAdmin = await isPlatformAdminVerified(svc, auth);
  if (!isPlatformAdmin) {
    return { ok: false, status: 403, body: { error: 'Acesso excepcional exige validação de superadmin no servidor.' } };
  }
  if (!justification || String(justification).trim().length < 10) {
    return { ok: false, status: 400, body: { error: 'Justificativa obrigatória para acesso excepcional.' } };
  }
  const audit = makeAuditor(svc, auth, ip, 'PrivacyRequest');
  await audit('PERMISSION_CHANGE', null, null, { exceptional_access: true, justification: String(justification).trim().slice(0, 500) });
  return { ok: true };
}

// Exportação individual por titular: dados que identificam a pessoa em registros
// de vínculo, operador, auditoria, suporte e IA — nunca dados de terceiros.
async function exportTitularData(svc, auth) {
  const userId = auth.id;
  const companyIds = extractCompanyIds(auth);
  const out = { user: { id: auth.id, email: auth.email, full_name: auth.full_name, role: auth.role } };

  // Vínculos usuário-empresa
  const links = await svc.entities.UserCompany.filter({ user_id: userId }).catch(() => []);
  out.user_companies = links;

  // Operadores (UserPin) onde o titular é criador ou o e-mail coincide
  const pinsByCreator = await svc.entities.UserPin.filter({ created_by_id: userId }).catch(() => []);
  let pins = pinsByCreator;
  if (auth.email) {
    const pinsByEmail = await svc.entities.UserPin.filter({ email: auth.email }).catch(() => []);
    const ids = new Set(pins.map((p) => p.id));
    for (const p of pinsByEmail) if (!ids.has(p.id)) { pins.push(p); ids.add(p.id); }
  }
  // Sanitiza: hash e salt nunca saem na exportação
  out.user_pins = pins.map((p) => {
    const { pin_hash, pin_salt, pin, ...rest } = p;
    return rest;
  });

  // Auditoria onde o titular é o ator
  const auditByUser = await svc.entities.AuditLog.filter({ user_id: userId }).catch(() => []);
  const auditByCreator = await svc.entities.AuditLog.filter({ created_by_id: userId }).catch(() => []);
  out.audit_logs = [...auditByUser, ...auditByCreator];

  // Suporte
  const tickets = await svc.entities.SupportTicket.filter({ created_by: userId }).catch(() => []);
  out.support_tickets = tickets;
  const messages = await svc.entities.SupportMessage.filter({ sender_user_id: userId }).catch(() => []);
  out.support_messages = messages;
  const notifications = await svc.entities.SupportNotification.filter({ recipient_user_id: userId }).catch(() => []);
  out.support_notifications = notifications;

  // IA
  const aiAnalyses = await svc.entities.AIAnalysis.filter({ user_id: userId }).catch(() => []);
  out.ai_analyses = aiAnalyses;
  const aiUsage = await svc.entities.AIAnalysisUsage.filter({ user_id: userId }).catch(() => []);
  out.ai_usage = aiUsage;

  // Pedidos LGPD do próprio titular
  const privacyRequests = await svc.entities.PrivacyRequest.filter({ user_id: userId }).catch(() => []);
  out.privacy_requests = privacyRequests;
  const consents = await svc.entities.PrivacyConsent.filter({ user_id: userId }).catch(() => []);
  out.privacy_consents = consents;

  return out;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || null;

    let body = {};
    try { body = await req.json(); } catch (error) { body = {}; }
    const action = body.action;

    // Ações públicas (aviso de privacidade) — não exigem autenticação
    if (action === 'getActiveNotice') {
      const notices = await svc.entities.PrivacyPolicyNotice.filter({ status: 'published' }, '-published_at', 1).catch(() => []);
      const notice = notices?.[0] || null;
      return Response.json({ notice });
    }

    // Demais ações exigem autenticação
    const auth = await base44.auth.me();
    if (!auth) return Response.json({ error: 'Não autenticado' }, { status: 401 });
    const audit = makeAuditor(svc, auth, ip, 'PrivacyRequest');

    // ── Titular: criar pedido de direito ──────────────────────
    if (action === 'createRequest') {
      const requestType = body.request_type;
      const description = String(body.description || '').trim();
      if (!REQUEST_TYPES.includes(requestType)) {
        return Response.json({ error: 'Tipo de pedido inválido' }, { status: 400 });
      }
      if (description.length < 10) {
        return Response.json({ error: 'Descreva o pedido com pelo menos 10 caracteres.' }, { status: 400 });
      }
      const protocol = await generateProtocol();
      const now = new Date();
      const due = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // Art. 19 — 15 dias
      const record = {
        user_id: auth.id,
        user_email: auth.email,
        user_name: auth.full_name || auth.email,
        protocol,
        request_type: requestType,
        description,
        status: 'RECEBIDA',
        visibility: 'user',
        identity_verification_method: 'session',
        response_due_date: due.toISOString().slice(0, 10),
        events: [{ at: now.toISOString(), actor: auth.email, action: 'CREATED', detail: `Pedido de ${requestType} recebido` }],
      };
      const created = await svc.entities.PrivacyRequest.create(record);
      await audit('CREATE', created.id, null, { protocol, request_type: requestType });
      return Response.json({ request: created });
    }

    // ── Titular: listar próprios pedidos ──────────────────────
    if (action === 'listMyRequests') {
      const requests = await svc.entities.PrivacyRequest.filter({ user_id: auth.id }, '-created_date', 200).catch(() => []);
      return Response.json({ requests });
    }

    // ── Titular: obter próprio pedido ────────────────────────
    if (action === 'getRequest') {
      const requestId = body.request_id;
      if (!requestId) return Response.json({ error: 'Pedido é obrigatório' }, { status: 400 });
      const request = await svc.entities.PrivacyRequest.get(requestId).catch(() => null);
      if (!request) return Response.json({ error: 'Pedido não encontrado' }, { status: 404 });
      if (request.user_id !== auth.id) {
        // Acesso excepcional exigido para qualquer pedido de outro titular
        const access = await assertExceptionalAccess(svc, auth, ip, body.justification);
        if (!access.ok) return Response.json({ error: access.body.error }, { status: access.status });
      }
      return Response.json({ request });
    }

    // ── Titular: exportar meus dados ─────────────────────────
    if (action === 'exportMyData') {
      const data = await exportTitularData(svc, auth);
      await audit('PERMISSION_CHANGE', null, null, { data_export: true, request_type: 'portabilidade' });
      return Response.json({
        package: data,
        generated_at: new Date().toISOString(),
        warning: 'Este arquivo contém dados pessoais. Proteja-o e evite compartilhá-lo.',
      });
    }

    // ── Titular: consentimento específico ────────────────────
    if (action === 'submitConsent') {
      const purpose = String(body.purpose || '').trim();
      const noticeVersion = String(body.notice_version || '').trim();
      const revoke = body.revoke === true;
      if (!purpose || !noticeVersion) {
        return Response.json({ error: 'Finalidade e versão do aviso são obrigatórias' }, { status: 400 });
      }
      if (revoke) {
        const existing = await svc.entities.PrivacyConsent.filter({ user_id: auth.id, purpose, notice_version: noticeVersion }).catch(() => []);
        for (const c of existing) {
          if (!c.revoked_at) {
            await svc.entities.PrivacyConsent.update(c.id, { revoked_at: new Date().toISOString(), revoked_reason: String(body.reason || 'Revogado pelo titular').slice(0, 200) });
          }
        }
        return Response.json({ ok: true, revoked: true });
      }
      const created = await svc.entities.PrivacyConsent.create({
        user_id: auth.id,
        purpose,
        notice_version: noticeVersion,
        granted_at: new Date().toISOString(),
      });
      return Response.json({ ok: true, consent: created });
    }

    // ── Equipe de privacidade / superadmin: processar pedido ─
    if (action === 'processRequest') {
      const requestId = body.request_id;
      const status = body.status;
      const resolution = body.resolution || null;
      const justification = body.justification;
      if (!requestId || !REQUEST_STATUSES.includes(status)) {
        return Response.json({ error: 'Pedido e status válidos são obrigatórios' }, { status: 400 });
      }
      const request = await svc.entities.PrivacyRequest.get(requestId).catch(() => null);
      if (!request) return Response.json({ error: 'Pedido não encontrado' }, { status: 404 });

      const isTeam = await isPrivacyTeamMember(svc, auth);
      let isExceptional = false;
      if (!isTeam) {
        const access = await assertExceptionalAccess(svc, auth, ip, justification);
        if (!access.ok) return Response.json({ error: access.body.error }, { status: access.status });
        isExceptional = true;
      }
      const events = Array.isArray(request.events) ? [...request.events] : [];
      events.push({
        at: new Date().toISOString(),
        actor: auth.email,
        action: 'STATUS_CHANGE',
        detail: `${request.status} → ${status}${isExceptional ? ' (acesso excepcional)' : ''}`,
      });
      const update = { status, events };
      if (resolution) {
        update.resolution = resolution;
        update.visibility = 'privacy_team';
        events.push({ at: new Date().toISOString(), actor: auth.email, action: 'RESOLVED', detail: resolution.decision || 'Resolução registrada' });
      }
      await svc.entities.PrivacyRequest.update(requestId, update);
      await audit('UPDATE', requestId, null, { status, exceptional: isExceptional, resolution: resolution ? { decision: resolution.decision } : null });
      return Response.json({ ok: true });
    }

    // ── Superadmin: histórico de versões do aviso ────────────
    if (action === 'getNoticeHistory') {
      const isPlatformAdmin = await isPlatformAdminVerified(svc, auth);
      if (!isPlatformAdmin) return Response.json({ error: 'Sem permissão' }, { status: 403 });
      const notices = await svc.entities.PrivacyPolicyNotice.list('-published_at', 100).catch(() => []);
      return Response.json({ notices });
    }

    // ── Superadmin: publicar versão do aviso ─────────────────
    if (action === 'publishNotice') {
      const isPlatformAdmin = await isPlatformAdminVerified(svc, auth);
      if (!isPlatformAdmin) return Response.json({ error: 'Sem permissão' }, { status: 403 });
      const content = body.content || {};
      const requiredFields = Array.isArray(body.required_fields) ? body.required_fields : [];
      const version = String(body.version || '').trim();
      const effectiveDate = body.effective_date || null;
      if (!version) return Response.json({ error: 'Versão é obrigatória' }, { status: 400 });
      // Impede publicação enquanto campos obrigatórios estiverem pendentes
      const pending = [];
      for (const key of requiredFields) {
        const val = content[key];
        if (val == null || val === '' || (Array.isArray(val) && val.length === 0)) {
          pending.push(key);
        }
      }
      if (pending.length > 0) {
        return Response.json({ error: 'Não é possível publicar: campos obrigatórios pendentes.', pending }, { status: 400 });
      }
      // Marca versões publicadas anteriores como superseded (histórico imutável)
      const previous = await svc.entities.PrivacyPolicyNotice.filter({ status: 'published' }).catch(() => []);
      for (const p of previous) {
        await svc.entities.PrivacyPolicyNotice.update(p.id, { status: 'superseded' });
      }
      const created = await svc.entities.PrivacyPolicyNotice.create({
        version,
        status: 'published',
        published_at: new Date().toISOString(),
        effective_date: effectiveDate,
        content,
        required_fields: requiredFields,
        created_by: auth.id,
      });
      await audit('CREATE', created.id, null, { notice_version: version });
      return Response.json({ notice: created });
    }

    // ── Superadmin/equipe: inventário de dados ──────────────
    if (action === 'getInventory') {
      const isPlatformAdmin = await isPlatformAdminVerified(svc, auth);
      const isTeam = await isPrivacyTeamMember(svc, auth);
      if (!isPlatformAdmin && !isTeam) return Response.json({ error: 'Sem permissão' }, { status: 403 });
      const inventory = await svc.entities.DataInventory.list('entity_name', 200).catch(() => []);
      return Response.json({ inventory });
    }

    // ── Retenção/descarte: DESATIVADO por padrão ────────────
    // O mecanismo existe e é auditável, mas não executa enquanto o controlador
    // não aprovar prazos e exceções (flag retention_enabled=false em cada registro).
    if (action === 'runRetention') {
      const isPlatformAdmin = await isPlatformAdminVerified(svc, auth);
      if (!isPlatformAdmin) return Response.json({ error: 'Sem permissão' }, { status: 403 });
      const enabled = await svc.entities.DataInventory.filter({ retention_enabled: true }).catch(() => []);
      if (enabled.length === 0) {
        return Response.json({ ok: false, blocked: true, message: 'Retenção desativada por padrão. Nenhum registro está com retention_enabled=true. O controlador deve aprovar prazos e exceções antes da execução.' });
      }
      // Mecanismo presente, mas deliberadamente bloqueado: nenhum dado é descartado/anonimizado nesta implementação.
      await audit('PERMISSION_CHANGE', null, null, { retention_attempt: true, enabled_count: enabled.length });
      return Response.json({ ok: false, blocked: true, message: 'Mecanismo de retenção presente, mas a execução de descarte/anonimização requer aprovação explícita do controlador. Nenhum dado foi alterado.' });
    }

    return Response.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}