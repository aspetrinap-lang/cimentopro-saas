import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Segurança do PIN do operador (UserPin):
// - o PIN de 4 dígitos é armazenado apenas como hash salgado (SHA-256 + salt por operador)
// - verificação e bloqueio de tentativas acontecem exclusivamente no servidor
// - ações: list (dados sanitizados, sem hash), verify (login por PIN),
//   save (criar/editar operador), reset_pin (admin redefine sem ver o PIN)
//   e migrate (conversão única dos PINs legíveis legados em hash)
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 5;
const ROLES = ['operador', 'supervisor', 'administrador'];

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashPin(saltHex, pin) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${saltHex}:${pin}`));
  return toHex(digest);
}

async function newSalt() {
  return toHex(crypto.getRandomValues(new Uint8Array(16)));
}

function isFourDigits(value) {
  return /^\d{4}$/.test(String(value || ''));
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await base44.auth.me();
    if (!auth) return Response.json({ error: 'Não autenticado' }, { status: 401 });
    const svc = base44.asServiceRole;

    let body = {};
    try { body = await req.json(); } catch (error) { body = {}; }
    const action = body.action;
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || null;
    const isPlatformAdmin = auth.is_platform_admin === true || (auth.data && auth.data.is_platform_admin) === true;
    const companyIds = (Array.isArray(auth.company_ids) && auth.company_ids)
      || (auth.data && Array.isArray(auth.data.company_ids) && auth.data.company_ids) || [];
    const isRoleAdmin = ['admin', 'administrador'].includes(auth.role);

    const audit = async (actionName, entityId, companyId, newValue) => {
      await svc.entities.AuditLog.create({
        user_id: auth.id,
        user_email: auth.email,
        company_id: companyId || null,
        action: actionName,
        entity_name: 'UserPin',
        entity_id: entityId,
        ip,
        new_value: newValue || null,
      }).catch(() => null);
    };

    // Autorização para gerenciar operadores de uma empresa:
    // SUPER_ADMIN, admin da plataforma ou dono/admin da empresa (vínculo UserCompany).
    const canManage = async (companyId) => {
      if (isPlatformAdmin || isRoleAdmin) return true;
      if (!companyId) return false;
      const links = await svc.entities.UserCompany.filter({ user_id: auth.id, company_id: companyId });
      return links.some((l) => l.status === 'active' && ['owner', 'admin'].includes(l.role));
    };

    if (action === 'list') {
      const companyId = body.company_id || null;
      let operators = [];
      if (companyId) {
        if (!isPlatformAdmin && !isRoleAdmin && !companyIds.includes(companyId)) {
          return Response.json({ error: 'Sem acesso a esta empresa' }, { status: 403 });
        }
        operators = await svc.entities.UserPin.filter({ active: true, company_id: companyId }, 'name', 500);
      } else if (isPlatformAdmin || isRoleAdmin) {
        operators = await svc.entities.UserPin.filter({ active: true }, 'name', 500);
      } else if (companyIds.length) {
        operators = (await Promise.all(
          companyIds.map((cid) => svc.entities.UserPin.filter({ active: true, company_id: cid }, 'name', 500).catch(() => []))
        )).flat();
      }
      // Dados sanitizados: hash e salt nunca chegam ao app.
      const sanitized = operators.map((op) => ({
        id: op.id,
        name: op.name,
        email: op.email || '',
        active: op.active !== false,
        role: op.role,
        profile_id: op.profile_id || null,
        company_id: op.company_id || null,
        locked_until: op.locked_until && new Date(op.locked_until) > new Date() ? op.locked_until : null,
      }));
      return Response.json({ operators: sanitized });
    }

    if (action === 'verify') {
      const operatorId = body.operator_id;
      const pin = String(body.pin || '');
      if (!operatorId || !isFourDigits(pin)) {
        return Response.json({ error: 'Operador e PIN de 4 dígitos são obrigatórios' }, { status: 400 });
      }
      const op = await svc.entities.UserPin.get(operatorId).catch(() => null);
      if (!op || op.active === false) {
        return Response.json({ error: 'Operador inválido ou inativo' }, { status: 404 });
      }
      // Isolamento por empresa: o operador precisa pertencer a uma empresa do usuário.
      if (!isPlatformAdmin && !isRoleAdmin && op.company_id && companyIds.length && !companyIds.includes(op.company_id)) {
        return Response.json({ error: 'Operador inválido' }, { status: 404 });
      }
      if (op.locked_until && new Date(op.locked_until) > new Date()) {
        await audit('LOGIN', op.id, op.company_id, { result: 'blocked' });
        return Response.json({ error: 'PIN bloqueado por tentativas incorretas. Tente novamente em alguns minutos.', locked: true }, { status: 429 });
      }

      let pinOk = false;
      let pinHash = op.pin_hash;
      let pinSalt = op.pin_salt;
      if (pinHash) {
        pinOk = (await hashPin(pinSalt || '', pin)) === pinHash;
      } else if (op.pin) {
        // Registro legado ainda não migrado: compara, converte para hash e remove o texto puro.
        pinOk = pin === String(op.pin);
        if (pinOk) {
          pinSalt = await newSalt();
          pinHash = await hashPin(pinSalt, pin);
          await svc.entities.UserPin.update(op.id, { pin_hash: pinHash, pin_salt: pinSalt, pin: null, failed_attempts: 0, locked_until: null });
        }
      }
      if (!pinOk) {
        const attempts = (op.failed_attempts || 0) + 1;
        const updates = { failed_attempts: attempts };
        let locked = false;
        if (attempts >= MAX_ATTEMPTS) {
          updates.locked_until = new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString();
          updates.failed_attempts = 0;
          locked = true;
        }
        await svc.entities.UserPin.update(op.id, updates);
        await audit('LOGIN', op.id, op.company_id, { result: locked ? 'locked' : 'failed', attempts });
        return Response.json({
          error: locked
            ? 'PIN bloqueado por tentativas incorretas. Tente novamente em alguns minutos.'
            : `PIN incorreto. Restam ${MAX_ATTEMPTS - attempts} tentativa(s).`,
          locked,
        }, { status: locked ? 429 : 401 });
      }

      await svc.entities.UserPin.update(op.id, { failed_attempts: 0, locked_until: null });
      let permissions = null;
      if (op.profile_id) {
        const profile = await svc.entities.UserRoleProfile.get(op.profile_id).catch(() => null);
        if (profile) permissions = profile.permissions || null;
      }
      await audit('LOGIN', op.id, op.company_id, { result: 'success' });
      return Response.json({
        operator: {
          id: op.id,
          name: op.name,
          email: op.email || '',
          role: op.role,
          profile_id: op.profile_id || null,
          company_id: op.company_id || null,
        },
        permissions,
      });
    }

    if (action === 'save') {
      const operatorId = body.operator_id || null;
      const name = String(body.name || '').trim();
      const role = body.role;
      const profileId = body.profile_id || null;
      const active = body.active !== false;
      const email = body.email ? String(body.email).trim() : '';
      if (!name) return Response.json({ error: 'Nome é obrigatório' }, { status: 400 });
      if (!ROLES.includes(role)) return Response.json({ error: 'Função inválida' }, { status: 400 });

      let existing = null;
      let companyId = body.company_id || null;
      if (operatorId) {
        existing = await svc.entities.UserPin.get(operatorId).catch(() => null);
        if (!existing) return Response.json({ error: 'Operador não encontrado' }, { status: 404 });
        companyId = existing.company_id || companyId;
      } else if (!companyId) {
        return Response.json({ error: 'Selecione uma empresa ativa antes de cadastrar o operador' }, { status: 400 });
      }
      if (!(await canManage(companyId))) {
        return Response.json({ error: 'Sem permissão para gerenciar operadores desta empresa' }, { status: 403 });
      }

      const pin = body.pin == null || body.pin === '' ? null : String(body.pin);
      if (pin !== null && !isFourDigits(pin)) {
        return Response.json({ error: 'O PIN deve ter exatamente 4 dígitos' }, { status: 400 });
      }
      if (!operatorId && pin === null) {
        return Response.json({ error: 'Informe um PIN de 4 dígitos para o novo operador' }, { status: 400 });
      }

      const record = { name, email, role, profile_id: profileId, active };
      let pinChanged = false;
      if (pin !== null) {
        const salt = await newSalt();
        record.pin_hash = await hashPin(salt, pin);
        record.pin_salt = salt;
        record.failed_attempts = 0;
        record.locked_until = null;
        pinChanged = true;
      }

      if (operatorId) {
        await svc.entities.UserPin.update(operatorId, record);
        await audit('UPDATE', operatorId, companyId, {
          name, role, profile_id: profileId, active, pin_changed: pinChanged,
        });
        if (existing && (existing.role !== role || (existing.profile_id || null) !== profileId)) {
          await audit('PERMISSION_CHANGE', operatorId, companyId, {
            old: { role: existing.role, profile_id: existing.profile_id || null },
            new: { role, profile_id: profileId },
          });
        }
        return Response.json({ ok: true });
      }

      record.company_id = companyId;
      const created = await svc.entities.UserPin.create(record);
      await audit('CREATE', created.id, companyId, { name, role, profile_id: profileId });
      return Response.json({ ok: true, operator_id: created.id });
    }

    if (action === 'reset_pin') {
      const operatorId = body.operator_id;
      const pin = String(body.pin || '');
      if (!operatorId || !isFourDigits(pin)) {
        return Response.json({ error: 'Operador e novo PIN de 4 dígitos são obrigatórios' }, { status: 400 });
      }
      const op = await svc.entities.UserPin.get(operatorId).catch(() => null);
      if (!op) return Response.json({ error: 'Operador não encontrado' }, { status: 404 });
      if (!(await canManage(op.company_id))) {
        return Response.json({ error: 'Sem permissão para gerenciar operadores desta empresa' }, { status: 403 });
      }
      const salt = await newSalt();
      const pinHash = await hashPin(salt, pin);
      await svc.entities.UserPin.update(operatorId, {
        pin_hash: pinHash, pin_salt: salt, failed_attempts: 0, locked_until: null,
      });
      await audit('UPDATE', operatorId, op.company_id, { pin_reset: true });
      return Response.json({ ok: true });
    }

    if (action === 'migrate') {
      if (!isPlatformAdmin && !isRoleAdmin) {
        return Response.json({ error: 'Sem permissão' }, { status: 403 });
      }
      const all = await svc.entities.UserPin.list('name', 500);
      let migrated = 0;
      let pending = 0; // sem PIN legado e sem hash — precisam de redefinição
      let alreadyHashed = 0;
      for (const op of all) {
        if (op.pin_hash) { alreadyHashed++; continue; }
        if (op.pin) {
          const salt = await newSalt();
          const pinHash = await hashPin(salt, String(op.pin));
          await svc.entities.UserPin.update(op.id, {
            pin_hash: pinHash, pin_salt: salt, pin: null, failed_attempts: 0, locked_until: null,
          });
          migrated++;
        } else {
          pending++;
        }
      }
      return Response.json({ total: all.length, migrated, already_hashed: alreadyHashed, pending_reset: pending });
    }

    return Response.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}