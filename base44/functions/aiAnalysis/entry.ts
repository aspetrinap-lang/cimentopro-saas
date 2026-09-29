import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Função protegida do fluxo central de IA (aiService).
// Único ponto do projeto autorizado a executar InvokeLLM.
// Fluxo: empresa/usuário → assinatura/plano/limite → fingerprint/cache →
// InvokeLLM (service role) → AIAnalysis → AIAnalysisUsage.
const ALLOWED_TYPES = ['order_analysis', 'quality_analysis', 'virtual_engineer'];

// Serialização estável (chaves ordenadas) para o fingerprint ser determinístico.
function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    const s = JSON.stringify(value);
    return s === undefined ? 'undefined' : s;
  }
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
}

async function sha256Hex(str) {
  const data = new TextEncoder().encode(str);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });

    const body = await req.json();
    const companyId = body.company_id;

    // Validação de membership SEMPRE no backend (não confia no frontend):
    // vínculo ativo na empresa OU SUPER_ADMIN da plataforma.
    const links = await base44.entities.UserCompany.filter({ user_id: user.id, company_id: companyId, status: 'active' });
    if (!links.length) {
      const admins = await base44.asServiceRole.entities.PlatformAdmin.filter({ user_id: user.id, active: true });
      if (!admins.length) {
        return Response.json({ ok: false, error: 'Empresa não autorizada para este usuário.' }, { status: 403 });
      }
    }

    const action = body.action;

    // Assinatura/plano/limite — validação SEMPRE no backend.
    // Sem assinatura registrada → compatibilidade: ilimitado (igual ao resto da plataforma).
    async function aiLimitInfo() {
      const subs = await base44.entities.Subscription.filter({ company_id: companyId });
      const sub = subs.find((s) => s.status === 'active' || s.status === 'trial') || null;
      if (!sub) return { limit: null, subscriptionBlocked: false };
      if (['suspended', 'cancelled', 'past_due'].includes(sub.status)) {
        return { limit: 0, subscriptionBlocked: true, subscription: sub };
      }
      const plan = await base44.entities.SubscriptionPlan.get(sub.plan_id).catch(() => null);
      const raw = plan ? plan.ai_analyses_per_month : undefined;
      // ausente/null/undefined → ilimitado; 0 → bloqueio explícito; > 0 → limite mensal
      const limit = typeof raw === 'number' && raw > 0 ? raw : raw === 0 ? 0 : null;
      return { limit, subscriptionBlocked: false, subscription: sub };
    }

    // Consumo por empresa + mês calendário (nunca contador global).
    async function usageThisMonth() {
      const month = new Date().toISOString().slice(0, 7);
      const usages = await base44.entities.AIAnalysisUsage.filter({ company_id: companyId });
      return usages.filter((u) => String(u.created_date || '').slice(0, 7) === month).length;
    }

    // ---- Ação latest: análise armazenada mais recente (abertura da tela NUNCA executa IA)
    if (action === 'latest') {
      const analysisType = body.analysis_type;
      if (!ALLOWED_TYPES.includes(analysisType)) {
        return Response.json({ ok: false, error: 'analysis_type inválido.' }, { status: 400 });
      }
      const list = await base44.entities.AIAnalysis.filter(
        { company_id: companyId, analysis_type: analysisType },
        '-created_date',
        1
      );
      const analysis = list[0] || null;
      const limitInfo = await aiLimitInfo();
      const usageCount = await usageThisMonth();
      return Response.json({
        ok: true,
        analysis,
        usage_count: usageCount,
        limit: limitInfo.limit,
        subscription_blocked: !!limitInfo.subscriptionBlocked,
      });
    }

    // ---- Ação usage: quota atual da empresa (exibição na UI)
    if (action === 'usage') {
      const limitInfo = await aiLimitInfo();
      const usageCount = await usageThisMonth();
      return Response.json({
        ok: true,
        usage_count: usageCount,
        limit: limitInfo.limit,
        subscription_blocked: !!limitInfo.subscriptionBlocked,
      });
    }

    // ---- Ação run: executa a análise (cache → limite → InvokeLLM → persistência → uso)
    if (action === 'run') {
      const analysisType = body.analysis_type;
      if (!ALLOWED_TYPES.includes(analysisType)) {
        return Response.json({ ok: false, error: 'analysis_type inválido.' }, { status: 400 });
      }
      const prompt = typeof body.prompt === 'string' ? body.prompt : '';
      if (!prompt || prompt.length > 60000) {
        return Response.json({ ok: false, error: 'Prompt inválido.' }, { status: 400 });
      }
      const schema = body.schema && typeof body.schema === 'object' && !Array.isArray(body.schema) ? body.schema : null;
      if (!schema) {
        return Response.json({ ok: false, error: 'Schema inválido.' }, { status: 400 });
      }

      // 1. Fingerprint calculado NO BACKEND sobre os inputs determinísticos.
      const fingerprint = await sha256Hex(
        stableStringify({ company_id: companyId, analysis_type: analysisType, inputs: body.fingerprint_inputs ?? null })
      );

      // 2. Cache: mesma empresa + mesmo tipo + mesmo fingerprint → reutiliza (sem expiração por tempo).
      const cached = await base44.entities.AIAnalysis.filter(
        { company_id: companyId, analysis_type: analysisType, data_fingerprint: fingerprint },
        '-created_date',
        1
      );
      if (cached[0] && cached[0].status !== 'error') {
        const limitInfo = await aiLimitInfo();
        const usageCount = await usageThisMonth();
        return Response.json({ ok: true, source: 'cache', analysis: cached[0], usage_count: usageCount, limit: limitInfo.limit });
      }

      // 3. Limite — SEMPRE antes de InvokeLLM.
      const limitInfo = await aiLimitInfo();
      if (limitInfo.subscriptionBlocked) {
        return Response.json({
          ok: false,
          code: 'subscription_blocked',
          error: 'A assinatura da empresa está inativa. Regularize a assinatura para usar as análises IA.',
        });
      }
      const usageCount = await usageThisMonth();
      if (limitInfo.limit !== null && usageCount >= limitInfo.limit) {
        return Response.json({
          ok: false,
          code: 'limit_reached',
          error: 'O limite mensal de análises IA deste plano foi atingido.',
          usage_count: usageCount,
          limit: limitInfo.limit,
        });
      }

      // 4. Execução única da IA (service role — único ponto autorizado do projeto).
      let result;
      try {
        result = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt, response_json_schema: schema });
      } catch (e) {
        return Response.json({ ok: false, code: 'ai_error', error: 'Falha ao executar a análise IA. Tente novamente.' });
      }

      // 5. Corrida concorrente: outro request pode ter gravado o mesmo fingerprint.
      const race = await base44.entities.AIAnalysis.filter(
        { company_id: companyId, analysis_type: analysisType, data_fingerprint: fingerprint },
        '-created_date',
        1
      );
      if (race[0] && race[0].status !== 'error') {
        return Response.json({ ok: true, source: 'cache', analysis: race[0], usage_count: usageCount, limit: limitInfo.limit });
      }

      // 6. Persistência — nova linha, nunca sobrescreve/apaga a análise anterior.
      const analysis = await base44.entities.AIAnalysis.create({
        company_id: companyId,
        user_id: user.id,
        analysis_type: analysisType,
        period_start: body.period_start || null,
        period_end: body.period_end || null,
        data_fingerprint: fingerprint,
        input_summary: typeof body.input_summary === 'string' ? body.input_summary.slice(0, 6000) : '',
        result,
        model: 'automatic',
        status: 'completed',
      });

      // 7. Uso registrado apenas quando a IA realmente executou (sem custo/token inventado).
      await base44.entities.AIAnalysisUsage.create({
        company_id: companyId,
        user_id: user.id,
        analysis_type: analysisType,
        model: 'automatic',
        status: 'completed',
        tokens: null,
        input_tokens: null,
        output_tokens: null,
        estimated_cost: null,
      });

      return Response.json({ ok: true, source: 'new', analysis, usage_count: usageCount + 1, limit: limitInfo.limit });
    }

    return Response.json({ ok: false, error: 'Ação inválida.' }, { status: 400 });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}