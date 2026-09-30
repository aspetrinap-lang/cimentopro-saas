import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import OpenAI from 'npm:openai@6.45.0';
import { CAMPAIGN_TABS, buildPrompt } from './tabs.ts';
import { isPlatformAdminVerified } from '../../shared/platformAdmin.ts';

// Campanha de marketing: gera infográficos explicativos 4:5 (Instagram) por
// aba do CimentoPro, com IA, e persiste as imagens em MarketingInfographic.
// Autorização: SUPER_ADMIN da plataforma OU dono/admin de alguma empresa
// ativa (a campanha pertence ao dono do sistema).

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

    if (action === 'generate') {
      const tab = CAMPAIGN_TABS.find((t) => t.key === body.key);
      if (!tab) return Response.json({ error: 'Aba desconhecida' }, { status: 400 });

      const { baseURL, token, headers } = svc.aiGateway.connection();
      const client = new OpenAI({ baseURL, apiKey: token, defaultHeaders: headers, maxRetries: 0 });
      const { data } = await client.images.generate({
        model: 'automatic',
        prompt: buildPrompt(tab),
        n: 1,
        aspect_ratio: '4:5',
        response_format: 'url',
      });
      const url = data && data[0] && data[0].url;
      if (!url) return Response.json({ error: 'A geração de imagem não retornou resultado' }, { status: 502 });

      const existing = await svc.entities.MarketingInfographic.filter({ key: tab.key });
      let item;
      if (existing.length) {
        item = await svc.entities.MarketingInfographic.update(existing[0].id, {
          group: tab.group, title: tab.title, image_url: url,
        });
      } else {
        item = await svc.entities.MarketingInfographic.create({
          key: tab.key, group: tab.group, title: tab.title, image_url: url,
        });
      }
      return Response.json({ item: { key: item.key, group: item.group, title: item.title, image_url: item.image_url } });
    }

    return Response.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}