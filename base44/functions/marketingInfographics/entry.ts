import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { CAMPAIGN_TABS } from './tabs.ts';
import { isPlatformAdminVerified } from '../../shared/platformAdmin.ts';

// Campanha de marketing: o FRONTEND captura o print real de cada aba
// (html2canvas), compõe o infográfico 4:5 e envia o PNG público — esta
// função apenas lista a campanha e persiste o asset enviado em
// MarketingInfographic. Autorização: SUPER_ADMIN da plataforma OU
// dono/admin de alguma empresa ativa.

const isValidImageUrl = (url) =>
  typeof url === 'string' && url.startsWith('https://') && url.includes('base44');

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });
    const svc = base44.asServiceRole;

    const platformAdmin = await isPlatformAdminVerified(svc, user);
    if (!platformAdmin) {
      const links = await svc.entities.UserCompany.filter({ user_id: user.id, status: 'active' }, '-created_date', 100);
      const isManager = links.some((l) => ['owner', 'admin'].includes(l.role));
      if (!isManager) return Response.json({ error: 'Sem permissão para acessar o Marketing' }, { status: 403 });
    }

    let body = {};
    try { body = await req.json(); } catch { body = {}; }
    const action = body.action || 'list';

    if (action === 'list') {
      const items = await svc.entities.MarketingInfographic.list('-updated_date', 100);
      return Response.json({
        tabs: CAMPAIGN_TABS,
        items: items.map((i) => ({
          key: i.key,
          group: i.group,
          title: i.title,
          image_url: i.image_url || '',
        })),
      });
    }

    if (action === 'save') {
      const tab = CAMPAIGN_TABS.find((t) => t.key === body.key);
      if (!tab) return Response.json({ error: 'Aba desconhecida' }, { status: 400 });
      if (!isValidImageUrl(body.image_url)) {
        return Response.json({ error: 'URL da imagem inválida — envie um arquivo do armazenamento do app' }, { status: 400 });
      }

      const existing = await svc.entities.MarketingInfographic.filter({ key: tab.key });
      let item;
      if (existing.length) {
        item = await svc.entities.MarketingInfographic.update(existing[0].id, {
          group: tab.group, title: tab.title, image_url: body.image_url,
        });
      } else {
        item = await svc.entities.MarketingInfographic.create({
          key: tab.key, group: tab.group, title: tab.title, image_url: body.image_url,
        });
      }
      return Response.json({ item: { key: item.key, group: item.group, title: item.title, image_url: item.image_url } });
    }

    return Response.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}