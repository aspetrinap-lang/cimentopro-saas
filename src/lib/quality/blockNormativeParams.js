/**
 * Fonte única de parâmetros normativos para o ensaio de compressão
 * de BLOCOS VAZADOS DE CONCRETO PARA ALVENARIA.
 *
 * ABNT NBR 6136-1:2026 — Requisitos
 * ABNT NBR 6136-2:2026 — Métodos de ensaio
 *
 * Os valores das tabelas Ψ e índice i devem ser verificados contra o
 * texto oficial da norma. A estrutura e o fluxo de cálculo são a fonte
 * única do motor blockCompressionEngine v2026.1.
 *
 * REGRAS:
 * - Ψ NUNCA é hardcoded como 0,89 — é consultado na tabela versionada.
 * - i é determinado pela norma, não pelo usuário.
 * - A resistência especificada (fbk) vem do cadastro do produto.
 * - A área utilizada é a ÁREA BRUTA (nunca a líquida).
 */

// ── NBR 6136-2:2026 (revisão vigente) ───────────────────────
export const NBR_6136_2026_COMPRESSION = {
  normative_standard: 'NBR 6136-2',
  normative_requirements: 'NBR 6136-1',
  normative_version: '2026',
  test_method_revision: 'NBR 6136-2:2026',
  requirements_revision: 'NBR 6136-1:2026',
  engine_name: 'blockCompressionEngine',
  engine_version: 'v2026.1',
  parameter_version: 'NBR6136-COMPRESSION-2026',

  // Número mínimo de corpos de prova válidos para o ensaio normativo
  min_specimens: 6,

  // Prova: 6 CPs | Contraprova: 6 CPs (independentes)
  proof_specimens: 6,
  counterproof_specimens: 6,

  // Coeficiente Ψ — fator estatístico (piso) por número de CPs (n).
  // fbk,est ≥ Ψ × fb(1), onde fb(1) é a menor resistência individual.
  // Para n=6: Ψ = 0,89 (NBR 6136-2:2026).
  psi_table: {
    6: 0.89, 7: 0.89, 8: 0.90, 9: 0.90,
    10: 0.91, 11: 0.91, 12: 0.92, 13: 0.92,
    14: 0.92, 15: 0.93, 16: 0.93,
  },

  // Índice i para o método de amostra pequena (6 ≤ n ≤ 16):
  // fbk,cal = 2 × média dos (i−1) menores valores − fb(i)
  // Para n=6: i = 3 → fbk,cal = 2 × média(fb1, fb2) − fb3
  index_i_table: {
    6: 3, 7: 3, 8: 3, 9: 4,
    10: 4, 11: 4, 12: 4, 13: 5,
    14: 5, 15: 5, 16: 5,
  },

  // n ≥ 18: método de amostra grande (média − k × desvio-padrão)
  large_sample_threshold: 18,
  large_sample_k: 1.65,

  // Velocidade de carregamento conforme fbk especificado:
  // fbk ≥ 8 MPa: 0,15 ± 0,03 MPa/s
  // fbk < 8 MPa: 0,05 ± 0,01 MPa/s
  loading_rate_threshold: 8.0,
  loading_rate_high: { target: 0.15, tolerance: 0.03 },
  loading_rate_low: { target: 0.05, tolerance: 0.01 },

  // Estados da contraprova
  counterproof_states: ['NOT_REQUIRED', 'AVAILABLE', 'REQUIRED', 'IN_PROGRESS', 'COMPLETED'],
};

// ── NBR 6136:2016 (revisão anterior — preservada) ──────────
export const NBR_6136_2016_COMPRESSION = {
  normative_standard: 'NBR 6136',
  normative_requirements: 'NBR 6136',
  normative_version: '2016',
  test_method_revision: 'NBR 6136:2016',
  requirements_revision: 'NBR 6136:2016',
  engine_name: 'NBR_6136_2016_COMPRESSION',
  engine_version: '1.0.0',
  parameter_version: 'NBR6136-COMPRESSION-2016',

  // 2016: fbk,est = fmédia − 1,65 × s (mínimo 3 CPs válidos)
  min_specimens: 3,
  k_factor: 1.65,
  min_individual_ratio: 0.80,
};

// ── Seleção de revisão ──────────────────────────────────────
export const BLOCK_COMPRESSION_REVISIONS = [
  { value: '2026', label: 'NBR 6136-1/-2:2026 (vigente)' },
  { value: '2016', label: 'NBR 6136:2016 (anterior)' },
];

export function getBlockCompressionParams(revision) {
  return revision === '2026'
    ? NBR_6136_2026_COMPRESSION
    : NBR_6136_2016_COMPRESSION;
}

export function getBlockPsi(n) {
  return NBR_6136_2026_COMPRESSION.psi_table[n] ?? null;
}

export function getBlockIndexI(n) {
  return NBR_6136_2026_COMPRESSION.index_i_table[n] ?? null;
}

/**
 * Resolve a velocidade de carregamento normativa a partir do fbk especificado.
 * Retorna { target, min, max } em MPa/s.
 */
export function resolveLoadingRate(fbkEspecificado) {
  const fbk = Number(fbkEspecificado) || 0;
  const params = NBR_6136_2026_COMPRESSION;
  const rate = fbk >= params.loading_rate_threshold
    ? params.loading_rate_high
    : params.loading_rate_low;
  return {
    target: rate.target,
    min: +(rate.target - rate.tolerance).toFixed(2),
    max: +(rate.target + rate.tolerance).toFixed(2),
  };
}

/**
 * Valida a velocidade de carregamento informada pelo laboratório.
 * Não altera o valor informado — apenas indica DENTRO/FORA DO LIMITE.
 */
export function validateLoadingRate(informedRate, fbkEspecificado) {
  const rate = Number(informedRate) || 0;
  if (!rate) return { status: 'INDETERMINADO', message: 'Velocidade não informada.' };
  const { min, max } = resolveLoadingRate(fbkEspecificado);
  const dentro = rate >= min && rate <= max;
  return {
    status: dentro ? 'DENTRO_DO_LIMITE' : 'FORA_DO_LIMITE',
    message: dentro
      ? `Dentro do limite normativo (${min}–${max} MPa/s).`
      : `Fora do limite normativo (${min}–${max} MPa/s).`,
    min,
    max,
  };
}