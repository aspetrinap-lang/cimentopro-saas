/**
 * Fonte única de parâmetros normativos para o ensaio de compressão
 * de pavimentos intertravados de concreto.
 *
 * ABNT NBR 9781-1:2026 — Requisitos
 * ABNT NBR 9781-2:2026 — Métodos de ensaio
 *
 * Os valores das tabelas ψ, fator de espessura (p) e índice i
 * devem ser verificados contra o texto oficial da norma.
 * A estrutura e o fluxo de cálculo são a fonte única do motor.
 */

// ── NBR 9781-2:2026 (revisão vigente) ───────────────────────
export const NBR_9781_2026_COMPRESSION = {
  normative_standard: 'ABNT NBR 9781',
  normative_revision: '2026',
  test_method_revision: 'NBR 9781-2:2026',
  engine_name: 'NBR_9781_2026_COMPRESSION',
  engine_version: '1.0.0',
  parameter_version: 'NBR9781-COMPRESSION-2026',

  // Número mínimo de corpos de prova válidos
  min_specimens: 6,

  // Fator de espessura (p) — correção da resistência em função da
  // espessura nominal do pavimento (mm). Peças mais delgadas (maior
  // esbeltez) recebem fator de redução.
  thickness_factor_table: [
    { min_thickness_mm: 100, p: 1.00 },
    { min_thickness_mm: 80,  p: 0.95 },
    { min_thickness_mm: 60,  p: 0.88 },
    { min_thickness_mm: 0,   p: 0.80 },
  ],

  // Coeficiente ψ — fator estatístico (piso) por número de CPs (n).
  // fpk,est ≥ ψ × fp(1), onde fp(1) é a menor resistência individual.
  psi_table: {
    6: 0.85, 7: 0.86, 8: 0.87, 9: 0.87,
    10: 0.88, 11: 0.88, 12: 0.89, 13: 0.89,
    14: 0.90, 15: 0.90, 16: 0.90,
  },

  // Índice i para o método de amostra pequena (6 ≤ n ≤ 16):
  // fpk,est = 2 × média dos (i−1) menores valores − fp(i)
  index_i_table: {
    6: 2, 7: 2, 8: 2, 9: 3,
    10: 3, 11: 3, 12: 3, 13: 4,
    14: 4, 15: 4, 16: 4,
  },

  // n ≥ 18: método de amostra grande (média − k × desvio-padrão)
  large_sample_threshold: 18,
  large_sample_k: 1.65,

  // n = 17: bloqueado — sem parâmetro normativo validado
  blocked_n: 17,
};

// ── NBR 9781:2013 (revisão anterior — preservada) ──────────
export const NBR_9781_2013_COMPRESSION = {
  normative_standard: 'ABNT NBR 9781',
  normative_revision: '2013',
  test_method_revision: 'NBR 9781:2013',
  engine_name: 'NBR_9781_2013_COMPRESSION',
  engine_version: '1.0.0',
  parameter_version: 'NBR9781-COMPRESSION-2013',

  // 2013: fpk,est = fmédia − 1,65 × s (mínimo 3 CPs válidos)
  min_specimens: 3,
  k_factor: 1.65,
  // Conformidade: média ≥ fpk E mínima ≥ 0,8 × fpk
  min_individual_ratio: 0.80,
};

// ── Seleção de revisão ──────────────────────────────────────
export const COMPRESSION_REVISIONS = [
  { value: '2026', label: 'NBR 9781:2026 (vigente)' },
  { value: '2013', label: 'NBR 9781:2013 (anterior)' },
];

export function getCompressionParams(revision) {
  return revision === '2026'
    ? NBR_9781_2026_COMPRESSION
    : NBR_9781_2013_COMPRESSION;
}

export function getThicknessFactor(nominalThicknessMm) {
  const t = Number(nominalThicknessMm) || 0;
  for (const entry of NBR_9781_2026_COMPRESSION.thickness_factor_table) {
    if (t >= entry.min_thickness_mm) return entry.p;
  }
  return 0.80;
}

export function getPsi(n) {
  return NBR_9781_2026_COMPRESSION.psi_table[n] ?? null;
}

export function getIndexI(n) {
  return NBR_9781_2026_COMPRESSION.index_i_table[n] ?? null;
}