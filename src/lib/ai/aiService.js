// Camada central de IA — ÚNICO ponto usado pelas telas para solicitar análises.
// Nenhum componente chama InvokeLLM diretamente: a execução acontece na função
// backend protegida `aiAnalysis`, que valida empresa/assinatura/plano/limite,
// calcula o fingerprint, aplica o cache (sem expiração por tempo), persiste em
// AIAnalysis e registra o uso em AIAnalysisUsage.
import { base44 } from '@/api/base44Client';
import { activeCompanyId } from '@/lib/companyScope';

// Serialização estável (chaves ordenadas) — DEVE ser idêntica à do backend.
function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    const s = JSON.stringify(value);
    return s === undefined ? 'undefined' : s;
  }
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
}

// Fingerprint calculado no cliente (mesmo algoritmo do backend) — usado apenas
// para saber, na abertura da tela, se a análise armazenada corresponde aos
// dados atuais. A fonte de verdade continua sendo o backend.
export async function computeFingerprint(analysisType, fingerprintInputs) {
  const companyId = activeCompanyId() || '';
  const json = stableStringify({ company_id: companyId, analysis_type: analysisType, inputs: fingerprintInputs ?? null });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Busca a análise armazenada mais recente da empresa ativa para o tipo.
// Abertura de tela chama isto — NUNCA executa IA.
export async function loadLatestAnalysis(analysisType) {
  const companyId = activeCompanyId();
  if (!companyId) return { analysis: null, usage_count: null, limit: null };
  const res = await base44.functions.invoke('aiAnalysis', {
    action: 'latest',
    company_id: companyId,
    analysis_type: analysisType,
  });
  const d = res.data || {};
  return { analysis: d.analysis || null, usage_count: d.usage_count ?? null, limit: d.limit ?? null };
}

// Executa a análise mediante ação EXPLÍCITA do usuário (botão Analisar/Atualizar).
// O backend decide cache × nova execução e aplica assinatura/plano/limite.
export async function runAnalysis({ analysis_type, fingerprint_inputs, prompt, schema, period_start, period_end, input_summary }) {
  const companyId = activeCompanyId();
  if (!companyId) {
    return { ok: false, code: 'no_company', error: 'Selecione uma empresa para executar a análise.' };
  }
  try {
    const res = await base44.functions.invoke('aiAnalysis', {
      action: 'run',
      company_id: companyId,
      analysis_type,
      fingerprint_inputs,
      prompt,
      schema,
      period_start: period_start || null,
      period_end: period_end || null,
      input_summary,
    });
    const d = res.data || {};
    if (d.ok === false) return { ok: false, code: d.code || 'error', error: d.error || 'Falha na análise IA.' };
    return {
      ok: true,
      source: d.source,
      analysis: d.analysis,
      usage_count: d.usage_count,
      limit: d.limit,
    };
  } catch (e) {
    return { ok: false, code: 'error', error: 'Não foi possível executar a análise agora. Tente novamente.' };
  }
}