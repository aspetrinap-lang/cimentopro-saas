import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { isPlatformAdminVerified } from '../../shared/platformAdmin.ts';
import {
  TICKET_STATUSES, TICKET_PRIORITIES, TICKET_SOURCES, TICKET_CATEGORIES,
  PRIORITY_ORDER, padTicketNumber, nextTicketNumber, activePlatformAdmins,
  auditSupport, notifyUsers, sanitizeAttachments,
} from '../../shared/supportCore.ts';

// supportDesk — central de suporte e atendimento ao cliente do CimentoPro.
//
// TODA operação sensível (criar, listar, ler conversa, responder, alterar,
// avaliar, notificar) passa por aqui com autorização resolvida no backend:
// - Cliente: identificado pela sessão; empresa validada contra UserCompany
//   (vínculo ativo) — o company_id vindo do frontend só é aceito se pertencer
//   ao usuário. Isolamento multi-tenant garantido por construção.
// - SUPER_ADMIN: verificado via PlatformAdmin (fonte protegida) — visão global,
//   inclusive sem vínculo operacional com a empresa.
// - Mensagens internas (is_internal=true) NUNCA chegam ao cliente: o filtro
//   acontece aqui, pois a RLS da plataforma não distingue esse campo.
// - Anexos ficam no armazenamento PRIVADO; o backend entrega apenas URLs
//   assinadas temporárias para os participantes autorizados do chamado.
// - Auditoria usa o AuditLog existente (action CREATE/UPDATE + entity_name).
// - IA (sender_type AI) fica reservada — nenhuma chamada direta a InvokeLLM.

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await base44.auth.me();
    if (!auth) return Response.json({ error: 'Não autenticado' }, { status: 401 });
    const svc = base44.asServiceRole;

    let body = {};
    try { body = await req.json(); } catch { body = {}; }
    const action = body.action;
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || null;

    const isAdmin = await isPlatformAdminVerified(svc, auth);
    const links = await svc.entities.UserCompany.filter({ user_id: auth.id, status: 'active' }, '-created_date', 200).catch(() => []);
    const myCompanyIds = [...new Set(links.map((l) => l.company_id))];

    const nowIso = () => new Date().toISOString();
    const audit = (companyId, entityId, actionName, entityName, oldValue, newValue) =>
      auditSupport(svc, {
        user_id: auth.id, user_email: auth.email, company_id: companyId,
        entity_name: entityName, entity_id: entityId, action: actionName,
        old_value: oldValue, new_value: newValue, ip,
      });

    // Acesso a um chamado: SUPER_ADMIN (global) ou membro ativo da empresa.
    const accessTicket = async (ticketId) => {
      const ticket = await svc.entities.SupportTicket.get(ticketId).catch(() => null);
      if (!ticket) return { ticket: null, response: Response.json({ error: 'Chamado não encontrado' }, { status: 404 }) };
      if (!isAdmin && !myCompanyIds.includes(ticket.company_id)) {
        return { ticket: null, response: Response.json({ error: 'Acesso negado' }, { status: 403 }) };
      }
      return { ticket, response: null };
    };

    // ── Abertura de chamado (cliente ou SUPER_ADMIN em nome da empresa) ──
    if (action === 'create_ticket') {
      const companyId = body.company_id;
      if (!companyId) return Response.json({ error: 'Empresa não identificada' }, { status: 400 });
      if (!isAdmin && !myCompanyIds.includes(companyId)) {
        return Response.json({ error: 'Você não tem vínculo ativo com esta empresa' }, { status: 403 });
      }
      const company = await svc.entities.Company.get(companyId).catch(() => null);
      if (!company) return Response.json({ error: 'Empresa não encontrada' }, { status: 404 });

      const subject = String(body.subject || '').trim();
      const description = String(body.description || '').trim();
      const category = body.category;
      const priority = body.priority || 'NORMAL';
      const source = body.source || 'IN_APP';
      if (!subject || !description) return Response.json({ error: 'Assunto e descrição são obrigatórios' }, { status: 400 });
      if (!TICKET_CATEGORIES.includes(category)) return Response.json({ error: 'Categoria inválida' }, { status: 400 });
      if (!TICKET_PRIORITIES.includes(priority)) return Response.json({ error: 'Prioridade inválida' }, { status: 400 });
      if (!TICKET_SOURCES.includes(source)) return Response.json({ error: 'Origem inválida' }, { status: 400 });

      const attachments = sanitizeAttachments(body.attachments).map((a) => ({
        ...a,
        uploaded_by_user_id: auth.id,
        uploaded_company_id: companyId,
      }));
      if (attachments.length < (Array.isArray(body.attachments) ? body.attachments.length : 0)) {
        return Response.json({ error: 'Anexo inválido: use PNG, JPG, WEBP, PDF, XLSX ou CSV (até 10 MB)' }, { status: 400 });
      }

      const number = await nextTicketNumber(svc, companyId);
      const ticket = await svc.entities.SupportTicket.create({
        company_id: companyId,
        company_name: company.name,
        created_by: auth.id,
        created_by_name: auth.full_name || '',
        created_by_email: auth.email || '',
        assigned_to: '',
        assigned_to_name: '',
        assigned_to_email: '',
        ticket_number: number,
        subject,
        description,
        category,
        priority,
        status: 'OPEN',
        module: String(body.module || '').slice(0, 120),
        source,
        page_context: String(body.page_context || '').slice(0, 300),
        browser_context: String(body.browser_context || '').slice(0, 200),
        app_version: String(body.app_version || '').slice(0, 60),
        first_response_at: null,
        resolved_at: null,
        closed_at: null,
        last_message_at: nowIso(),
      });
      await svc.entities.SupportMessage.create({
        ticket_id: ticket.id,
        company_id: companyId,
        sender_user_id: auth.id,
        sender_name: auth.full_name || '',
        sender_email: auth.email || '',
        sender_type: 'CUSTOMER',
        message: description,
        is_internal: false,
        attachments,
      });
      await audit(companyId, ticket.id, 'CREATE', 'SupportTicket', null, {
        ticket_number: number, subject, category, priority, status: 'OPEN', source, module: body.module || '',
      });

      const admins = await activePlatformAdmins(svc);
      const num = padTicketNumber(number);
      await notifyUsers(svc, {
        recipients: admins, excludeUserId: auth.id, type: 'NEW_TICKET', ticket,
        title: `Novo chamado ${num} — ${company.name}`,
        body: `${subject} (prioridade ${priority})`,
        email: true,
        emailSubject: `[CimentoPro] Novo chamado ${num} — ${company.name}`,
        emailBody: `Novo chamado aberto no CimentoPro.\n\nChamado: ${num}\nEmpresa: ${company.name}\nUsuário: ${auth.full_name || auth.email}\nMódulo: ${body.module || '—'}\nAssunto: ${subject}\nPrioridade: ${priority}\n\nAcesse a Central de Atendimento para responder.`,
      });
      return Response.json({ ticket });
    }

    // ── Listagem de chamados (cliente: só a empresa; SUPER_ADMIN: global) ──
    if (action === 'list_tickets') {
      const tickets = [];
      const companyIds = isAdmin ? (body.company_id ? [body.company_id] : null) : myCompanyIds;
      if (!isAdmin && !companyIds.length) return Response.json({ tickets: [] });
      if (companyIds) {
        for (const cid of companyIds) {
          const list = await svc.entities.SupportTicket.filter({ company_id: cid }, '-created_date', 300).catch(() => []);
          tickets.push(...list);
        }
      } else {
        tickets.push(...(await svc.entities.SupportTicket.list('-created_date', 500).catch(() => [])));
      }
      let filtered = tickets;
      if (body.status && TICKET_STATUSES.includes(body.status)) filtered = filtered.filter((t) => t.status === body.status);
      if (body.priority && TICKET_PRIORITIES.includes(body.priority)) filtered = filtered.filter((t) => t.priority === body.priority);
      if (body.category && TICKET_CATEGORIES.includes(body.category)) filtered = filtered.filter((t) => t.category === body.category);
      if (body.module) filtered = filtered.filter((t) => t.module === body.module);
      if (body.from) filtered = filtered.filter((t) => String(t.created_date || '') >= body.from);
      if (body.to) filtered = filtered.filter((t) => String(t.created_date || '') <= `${body.to}T23:59:59`);
      if (body.search) {
        const q = String(body.search).toLowerCase();
        filtered = filtered.filter((t) =>
          padTicketNumber(t.ticket_number).includes(q) ||
          String(t.subject || '').toLowerCase().includes(q) ||
          String(t.module || '').toLowerCase().includes(q) ||
          String(t.company_name || '').toLowerCase().includes(q));
      }
      if (isAdmin) {
        filtered.sort((a, b) =>
          (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2) ||
          String(b.last_message_at || b.created_date || '').localeCompare(String(a.last_message_at || a.created_date || '')));
      } else {
        filtered.sort((a, b) => String(b.last_message_at || b.created_date || '').localeCompare(String(a.last_message_at || a.created_date || '')));
      }
      return Response.json({ tickets: filtered });
    }

    // ── Metadados do admin: empresas, admins e KPIs da Central de Atendimento ──
    if (action === 'admin_meta') {
      if (!isAdmin) return Response.json({ error: 'Forbidden: SUPER_ADMIN required' }, { status: 403 });
      const companies = (await svc.entities.Company.list('name', 500).catch(() => []))
        .filter((c) => ['active', 'trial'].includes(c.status))
        .map((c) => ({ id: c.id, name: c.name }));
      const admins = await activePlatformAdmins(svc);
      const all = await svc.entities.SupportTicket.list('-created_date', 1000).catch(() => []);
      const ratings = (await svc.entities.SupportSatisfaction.list('-created_date', 1000).catch(() => []));
      const openCount = all.filter((t) => t.status === 'OPEN').length;
      const inProgress = all.filter((t) => t.status === 'IN_PROGRESS').length;
      const waiting = all.filter((t) => t.status === 'WAITING_CUSTOMER' || t.status === 'WAITING_INTERNAL').length;
      const urgent = all.filter((t) => t.priority === 'URGENT' && !['RESOLVED', 'CLOSED'].includes(t.status)).length;
      const today = new Date().toISOString().slice(0, 10);
      const resolvedToday = all.filter((t) => t.resolved_at && String(t.resolved_at).slice(0, 10) === today).length;
      const withFirst = all.filter((t) => t.first_response_at);
      const withResolved = all.filter((t) => t.resolved_at);
      const hours = (a, b) => (new Date(b).getTime() - new Date(a).getTime()) / 3600000;
      const avgFirst = withFirst.length ? withFirst.reduce((s, t) => s + hours(t.created_date, t.first_response_at), 0) / withFirst.length : null;
      const avgResolution = withResolved.length ? withResolved.reduce((s, t) => s + hours(t.created_date, t.resolved_at), 0) / withResolved.length : null;
      const csat = ratings.length ? ratings.reduce((s, r) => s + (Number(r.rating) || 0), 0) / ratings.length : null;
      return Response.json({
        companies, admins,
        kpis: {
          open: openCount, in_progress: inProgress, waiting_customer: waiting, urgent,
          resolved_today: resolvedToday, avg_first_response_hours: avgFirst,
          avg_resolution_hours: avgResolution, csat, ratings_count: ratings.length,
        },
      });
    }

    // ── Detalhe do chamado ──
    if (action === 'get_ticket') {
      const { ticket, response } = await accessTicket(body.ticket_id);
      if (response) return response;
      const satisfaction = (await svc.entities.SupportSatisfaction.filter({ ticket_id: ticket.id }, '-created_date', 1).catch(() => []))[0] || null;
      return Response.json({ ticket, satisfaction });
    }

    // ── Conversa do chamado (mensagens + anexos com URL temporária) ──
    if (action === 'list_messages') {
      const { ticket, response } = await accessTicket(body.ticket_id);
      if (response) return response;
      const msgs = await svc.entities.SupportMessage.filter({ ticket_id: ticket.id }, '-created_date', 300).catch(() => []);
      const visible = isAdmin ? msgs : msgs.filter((m) => !m.is_internal);
      const asc = visible.reverse();
      const withSigned = await Promise.all(asc.map(async (m) => {
        const attachments = [];
        for (const a of (m.attachments || [])) {
          if (!a.file_uri) continue;
          // Verificação de propriedade: o anexo só é assinado se tiver sido
          // registrado por um remetente da mesma empresa do chamado (stamp
          // server-side no save). Anexos sem o stamp (legados) não são assinados.
          if (a.uploaded_by_user_id && a.uploaded_company_id !== ticket.company_id) continue;
          const signed = await svc.integrations.Core.CreateFileSignedUrl({ file_uri: a.file_uri, expires_in: 3600 })
            .catch(() => null);
          attachments.push({ ...a, signed_url: signed?.signed_url || null });
        }
        return { ...m, attachments };
      }));
      return Response.json({ messages: withSigned });
    }

    // ── Envio de mensagem (cliente responde; suporte responde ou cria nota interna) ──
    if (action === 'send_message') {
      const { ticket, response } = await accessTicket(body.ticket_id);
      if (response) return response;
      const isSupport = isAdmin;
      const isInternal = isSupport ? body.is_internal === true : false; // cliente nunca cria nota interna
      const text = String(body.message || '').trim().slice(0, 5000);
      const attachments = sanitizeAttachments(body.attachments).map((a) => ({
        ...a,
        uploaded_by_user_id: auth.id,
        uploaded_company_id: ticket.company_id,
      }));
      if (!text && !attachments.length) return Response.json({ error: 'Mensagem vazia' }, { status: 400 });

      const msg = await svc.entities.SupportMessage.create({
        ticket_id: ticket.id,
        company_id: ticket.company_id,
        sender_user_id: auth.id,
        sender_name: auth.full_name || '',
        sender_email: auth.email || '',
        sender_type: isSupport ? 'SUPPORT' : 'CUSTOMER',
        message: text,
        is_internal: isInternal,
        attachments,
      });

      // Transições automáticas de status + primeira resposta + última mensagem.
      const updates = { last_message_at: nowIso() };
      if (isSupport && !isInternal) {
        if (!ticket.first_response_at) updates.first_response_at = nowIso();
        if (['OPEN', 'WAITING_CUSTOMER', 'WAITING_INTERNAL'].includes(ticket.status)) updates.status = 'IN_PROGRESS';
      }
      if (!isSupport && ['RESOLVED', 'CLOSED'].includes(ticket.status)) {
        updates.status = 'IN_PROGRESS'; // cliente respondeu após resolução → reabre
        updates.resolved_at = null;
      }
      const changedStatus = updates.status && updates.status !== ticket.status;
      await svc.entities.SupportTicket.update(ticket.id, updates).catch(() => {});
      const updatedTicket = { ...ticket, ...updates };
      const num = padTicketNumber(ticket.ticket_number);

      await audit(ticket.company_id, ticket.id, 'CREATE', isInternal ? 'SupportMessage' : 'SupportMessage', null, {
        ticket_number: ticket.ticket_number, sender_type: isSupport ? 'SUPPORT' : 'CUSTOMER', is_internal: isInternal,
      });

      const senderName = auth.full_name || auth.email;
      if (isSupport && !isInternal) {
        const creator = ticket.created_by
          ? [{ id: ticket.created_by, email: ticket.created_by_email || '', full_name: ticket.created_by_name || '' }]
          : [];
        await notifyUsers(svc, {
          recipients: creator, excludeUserId: auth.id, type: 'NEW_MESSAGE', ticket: updatedTicket,
          title: `Suporte respondeu ${num}`, body: text,
          email: true, emailSubject: `[CimentoPro] Nova resposta no chamado ${num}`,
          emailBody: `${senderName} respondeu ao chamado ${num} (${ticket.company_name}):\n\n${text}`,
        });
      } else if (!isSupport) {
        // Cliente respondeu → notifica o responsável; sem responsável, todo o suporte.
        let recipients = [];
        if (ticket.assigned_to) {
          const u = await svc.entities.User.get(ticket.assigned_to).catch(() => null);
          if (u) recipients = [{ id: u.id, email: u.email || '', full_name: u.full_name || '' }];
        } else {
          recipients = await activePlatformAdmins(svc);
        }
        await notifyUsers(svc, {
          recipients, excludeUserId: auth.id, type: 'NEW_MESSAGE', ticket: updatedTicket,
          title: `Cliente respondeu ${num} — ${ticket.company_name}`, body: text,
          email: true, emailSubject: `[CimentoPro] Nova mensagem do cliente no chamado ${num}`,
          emailBody: `${senderName} (${ticket.company_name}) respondeu ao chamado ${num}:\n\n${text}`,
        });
      }
      if (changedStatus && isSupport) {
        const creator = ticket.created_by
          ? [{ id: ticket.created_by, email: ticket.created_by_email || '', full_name: ticket.created_by_name || '' }]
          : [];
        await notifyUsers(svc, {
          recipients: creator, excludeUserId: auth.id, type: 'STATUS_CHANGED', ticket: updatedTicket,
          title: `Chamado ${num} em atendimento`, body: `Status atualizado para ${updates.status}`,
          email: false,
        });
      }
      return Response.json({ message: msg, ticket: updatedTicket });
    }

    // ── Alteração administrativa do chamado (somente SUPER_ADMIN) ──
    if (action === 'update_ticket') {
      if (!isAdmin) return Response.json({ error: 'Forbidden: SUPER_ADMIN required' }, { status: 403 });
      const ticket = await svc.entities.SupportTicket.get(body.ticket_id).catch(() => null);
      if (!ticket) return Response.json({ error: 'Chamado não encontrado' }, { status: 404 });

      const updates = {};
      const changes = {};
      if (body.status !== undefined) {
        if (!TICKET_STATUSES.includes(body.status)) return Response.json({ error: 'Status inválido' }, { status: 400 });
        if (body.status !== ticket.status) {
          changes.status = { from: ticket.status, to: body.status };
          updates.status = body.status;
          if (body.status === 'RESOLVED') updates.resolved_at = nowIso();
          if (body.status === 'CLOSED') updates.closed_at = nowIso();
          if (['OPEN', 'IN_PROGRESS'].includes(body.status)) { updates.resolved_at = null; updates.closed_at = null; }
        }
      }
      if (body.priority !== undefined) {
        if (!TICKET_PRIORITIES.includes(body.priority)) return Response.json({ error: 'Prioridade inválida' }, { status: 400 });
        if (body.priority !== ticket.priority) { changes.priority = { from: ticket.priority, to: body.priority }; updates.priority = body.priority; }
      }
      if (body.category !== undefined) {
        if (!TICKET_CATEGORIES.includes(body.category)) return Response.json({ error: 'Categoria inválida' }, { status: 400 });
        if (body.category !== ticket.category) { changes.category = { from: ticket.category, to: body.category }; updates.category = body.category; }
      }
      if (body.assigned_to !== undefined) {
        if (body.assigned_to !== ticket.assigned_to) {
          let assignee = null;
          if (body.assigned_to) {
            assignee = await svc.entities.User.get(body.assigned_to).catch(() => null);
            if (!assignee) return Response.json({ error: 'Responsável não encontrado' }, { status: 404 });
          }
          changes.assigned_to = { from: ticket.assigned_to, to: body.assigned_to };
          updates.assigned_to = body.assigned_to;
          updates.assigned_to_name = assignee ? (assignee.full_name || assignee.email || '') : '';
          updates.assigned_to_email = assignee ? (assignee.email || '') : '';
        }
      }
      if (!Object.keys(updates).length) return Response.json({ ticket });

      const updated = await svc.entities.SupportTicket.update(ticket.id, updates);
      const num = padTicketNumber(ticket.ticket_number);
      await audit(ticket.company_id, ticket.id, 'UPDATE', 'SupportTicket',
        Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.from])),
        Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.to])));

      const creator = ticket.created_by
        ? [{ id: ticket.created_by, email: ticket.created_by_email || '', full_name: ticket.created_by_name || '' }]
        : [];
      if (changes.status) {
        const resolved = updates.status === 'RESOLVED';
        await notifyUsers(svc, {
          recipients: creator, excludeUserId: auth.id, type: resolved ? 'RESOLVED' : 'STATUS_CHANGED', ticket: updated,
          title: `Chamado ${num} atualizado`, body: `Status: ${changes.status.from} → ${changes.status.to}`,
          email: resolved || updates.status === 'CLOSED',
          emailSubject: resolved
            ? `[CimentoPro] Chamado ${num} resolvido`
            : `[CimentoPro] Status do chamado ${num} atualizado`,
          emailBody: resolved
            ? `Seu chamado ${num} (${ticket.company_name}) foi resolvido.\nAvalie o atendimento em "Meus Chamados" no CimentoPro.`
            : `O status do chamado ${num} (${ticket.company_name}) mudou para ${updates.status}.`,
        });
      }
      if (changes.assigned_to && updates.assigned_to) {
        await notifyUsers(svc, {
          recipients: [{ id: updates.assigned_to, email: updates.assigned_to_email, full_name: updates.assigned_to_name }],
          excludeUserId: auth.id, type: 'ASSIGNED', ticket: updated,
          title: `Chamado ${num} atribuído a você`, body: `${ticket.company_name} — ${ticket.subject}`,
          email: false,
        });
      }
      return Response.json({ ticket: updated });
    }

    // ── Avaliação do atendimento (CSAT — única por chamado, via backend) ──
    if (action === 'submit_satisfaction') {
      const { ticket, response } = await accessTicket(body.ticket_id);
      if (response) return response;
      if (!['RESOLVED', 'CLOSED'].includes(ticket.status)) {
        return Response.json({ error: 'O chamado ainda não foi resolvido' }, { status: 400 });
      }
      const rating = Number(body.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return Response.json({ error: 'Avaliação deve ser de 1 a 5' }, { status: 400 });
      }
      const existing = await svc.entities.SupportSatisfaction.filter({ ticket_id: ticket.id }, '-created_date', 1).catch(() => []);
      if (existing.length) return Response.json({ error: 'Este chamado já foi avaliado' }, { status: 400 });
      const rec = await svc.entities.SupportSatisfaction.create({
        ticket_id: ticket.id,
        company_id: ticket.company_id,
        user_id: auth.id,
        user_email: auth.email || '',
        rating,
        resolved: body.resolved === true,
        comment: String(body.comment || '').slice(0, 1000),
      });
      await audit(ticket.company_id, ticket.id, 'CREATE', 'SupportSatisfaction', null, { ticket_number: ticket.ticket_number, rating });
      const admins = await activePlatformAdmins(svc);
      await notifyUsers(svc, {
        recipients: admins, excludeUserId: auth.id, type: 'SATISFACTION', ticket,
        title: `Chamado ${padTicketNumber(ticket.ticket_number)} avaliado`, body: `Nota ${rating}/5 — ${ticket.company_name}`,
        email: false,
      });
      return Response.json({ satisfaction: rec });
    }

    // ── Notificações in-app do próprio usuário ──
    if (action === 'list_notifications') {
      const list = await svc.entities.SupportNotification.filter({ recipient_user_id: auth.id }, '-created_date', 30).catch(() => []);
      return Response.json({ notifications: list });
    }
    if (action === 'mark_notifications_read') {
      const filter = { recipient_user_id: auth.id, read: false };
      if (body.ids && Array.isArray(body.ids) && body.ids.length) {
        for (const id of body.ids) {
          const n = await svc.entities.SupportNotification.get(id).catch(() => null);
          if (n && n.recipient_user_id === auth.id) await svc.entities.SupportNotification.update(id, { read: true }).catch(() => {});
        }
        return Response.json({ ok: true });
      }
      await svc.entities.SupportNotification.updateMany(filter, { $set: { read: true } }).catch(() => {});
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}