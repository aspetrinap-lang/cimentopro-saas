// Cache de análises IA — validade determinada EXCLUSIVAMENTE pelo fingerprint
// (sem expiração por tempo: sem TTL de 7/30 dias, sem revalidação automática).
import { computeFingerprint, loadLatestAnalysis } from './aiService';

// Retorna a análise armazenada mais recente do tipo na empresa ativa e indica
// se ela corresponde aos dados atuais (fresh = mesmo fingerprint).
// `getFingerprintInputs` é uma função que monta os inputs determinísticos
// atuais; quando omitida, a análise mais recente é retornada sem checagem.
export async function getCachedAnalysis(analysisType, getFingerprintInputs) {
  const { analysis, usage_count, limit } = await loadLatestAnalysis(analysisType);
  if (!analysis) return { analysis: null, fresh: false, usage_count, limit };
  if (!getFingerprintInputs) return { analysis, fresh: true, usage_count, limit };
  try {
    const fingerprint = await computeFingerprint(analysisType, getFingerprintInputs());
    return { analysis, fresh: analysis.data_fingerprint === fingerprint, usage_count, limit };
  } catch (e) {
    return { analysis, fresh: false, usage_count, limit };
  }
}