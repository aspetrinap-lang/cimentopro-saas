import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { isPlatformAdminVerified } from '../../shared/platformAdmin.ts';
import { extractCompanyIds, isRoleAdminUser, hasCompanyAccess, canManageCompany, makeAuditor } from '../../shared/companyAccess.ts';

// Numeração configurável das Ordens de Produção (por empresa).
// - Configuração persistida em AppSettings (chave 'order_numbering' por empresa).
// - Contador por empresa (+ ano quando reset_annually) em AppSettings (chave
//   'order_counter' ou 'order_counter_{year}'), incrementado apenas na reserva
//   (generate) — nunca em preview. Assim, fechar o formulário sem salvar NÃO
//   devolve o número (nunca reutilizado), conforme requisito.
// - Ordem existente: MAX(order_sequence) já usado inicializa o contador;
//   ordens antigas (001/26 ...) nunca são renumeradas.
const DEFAULT_CONFIG = {
  prefix: 'OS',
  digits: 6,
  initial_number: 1,
  reset_annually: true,
};

function formatOrderNumber(prefix, year, seq, digits) {
  const d = Math.max(1, Math.min(digits || 6, 10));
  return `${prefix}-${year}-${String(seq).padStart(d, '0')}`;
}

function sanitizePrefix(value) {
  return String(value || 'OS').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) || 'OS';
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await base44.auth.me();
    if (!auth) return Response.json({ error: 'Não autenticado' }, { status: 401 });
    const svc = base44.asServiceRole;

    let body = {};
    try { body = await req.json(); } catch (e) { body = {}; }
    const action = body.action;
    const isRoleAdmin = isRoleAdminUser(auth);
    const isPlatformAdmin = await isPlatformAdminVerified(svc, auth);
    const companyIds = extractCompanyIds(auth);
    const companyId = body.company_id || null;
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || null;
    const canAccessCompany = (cid) => hasCompanyAccess(companyIds, isPlatformAdmin, isRoleAdmin, cid);
    const canManage = (cid) => canManageCompany(svc, auth, isPlatformAdmin, isRoleAdmin, cid);
    const audit = makeAuditor(svc, auth, ip, 'OrderNumberingConfig');

    const getConfig = async (cid) => {
      const settings = await svc.entities.AppSettings.filter({ company_id: cid, key: 'order_numbering' });
      if (settings[0] && settings[0].value) {
        return { ...DEFAULT_CONFIG, ...settings[0].value };
      }
      return { ...DEFAULT_CONFIG };
    };

    // Lê o contador (sem criar). Se inexistente, deriva do histórico de ordens
    // (continuar da sequência). reserve=true grava o incremento.
    const computeNext = async (cid, cfg, reserve) => {
      const year = new Date().getFullYear();
      const counterKey = cfg.reset_annually ? `order_counter_${year}` : 'order_counter';
      const counters = await svc.entities.AppSettings.filter({ company_id: cid, key: counterKey });
      let lastSeq;
      if (counters[0] && counters[0].value && counters[0].value.last_seq != null) {
        lastSeq = Number(counters[0].value.last_seq) || 0;
      } else {
        const filter = cfg.reset_annually
          ? { company_id: cid, order_year: year }
          : { company_id: cid };
        const orders = await svc.entities.ProductionOrder.filter(filter, '-order_sequence', 1);
        const maxSeq = orders.length > 0
          ? Math.max(...orders.map((o) => Number(o.order_sequence) || 0))
          : 0;
        lastSeq = Math.max(maxSeq, (cfg.initial_number || 1) - 1);
      }
      const nextSeq = lastSeq + 1;
      if (reserve) {
        if (counters[0]) {
          await svc.entities.AppSettings.update(counters[0].id, { value: { last_seq: nextSeq } });
        } else {
          await svc.entities.AppSettings.create({ company_id: cid, key: counterKey, value: { last_seq: nextSeq } });
        }
      }
      return {
        order_number: formatOrderNumber(cfg.prefix, year, nextSeq, cfg.digits),
        order_year: year,
        order_sequence: nextSeq,
      };
    };

    if (action === 'get_config') {
      if (!canAccessCompany(companyId)) {
        return Response.json({ error: 'Sem acesso a esta empresa' }, { status: 403 });
      }
      return Response.json({ config: await getConfig(companyId) });
    }

    if (action === 'save_config') {
      if (!canAccessCompany(companyId)) {
        return Response.json({ error: 'Sem acesso a esta empresa' }, { status: 403 });
      }
      if (!(await canManage(companyId))) {
        return Response.json({ error: 'Sem permissão para alterar a numeração das ordens' }, { status: 403 });
      }
      const newConfig = {
        prefix: sanitizePrefix(body.prefix),
        digits: Math.min(Math.max(parseInt(body.digits, 10) || 6, 1), 10),
        initial_number: Math.max(parseInt(body.initial_number, 10) || 1, 1),
        reset_annually: body.reset_annually !== false,
      };
      const existing = await svc.entities.AppSettings.filter({ company_id: companyId, key: 'order_numbering' });
      let oldValue = null;
      let entityId = null;
      if (existing[0]) {
        oldValue = existing[0].value || null;
        entityId = existing[0].id;
        await svc.entities.AppSettings.update(entityId, { value: newConfig });
        await audit('UPDATE', entityId, companyId, oldValue, newConfig);
      } else {
        const created = await svc.entities.AppSettings.create({
          company_id: companyId, key: 'order_numbering', value: newConfig,
        });
        entityId = created.id;
        await audit('CREATE', entityId, companyId, null, newConfig);
      }
      // Prévia da próxima ordem com a nova config (sem reservar).
      const preview = await computeNext(companyId, newConfig, false);
      return Response.json({ ok: true, config: newConfig, preview: preview.order_number });
    }

    if (action === 'preview') {
      if (!canAccessCompany(companyId)) {
        return Response.json({ error: 'Sem acesso a esta empresa' }, { status: 403 });
      }
      const cfg = await getConfig(companyId);
      const result = await computeNext(companyId, cfg, false);
      return Response.json(result);
    }

    if (action === 'generate') {
      if (!canAccessCompany(companyId)) {
        return Response.json({ error: 'Sem acesso a esta empresa' }, { status: 403 });
      }
      const cfg = await getConfig(companyId);
      const result = await computeNext(companyId, cfg, true);
      return Response.json(result);
    }

    return Response.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}