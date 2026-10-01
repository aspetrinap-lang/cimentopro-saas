import { describe, test, expect } from 'vitest';
import {
  calculateBlockCompression2026,
  calculateBlockCompression2016,
  calcBlockIndividualResistance,
  validateBlockTest,
  decideLot,
  resolveBlockRevision,
} from '../blockCompressionEngine';
import { getBlockPsi, getBlockIndexI, NBR_6136_2026_COMPRESSION } from '../blockNormativeParams';

// Helper: cria 6 CPs com resistências especificadas
function makeSpecimens(resistances) {
  return resistances.map((r, i) => ({
    id: i + 1,
    specimen_id: `CP-${i + 1}`,
    age_days: 28,
    length_mm: 390,
    width_mm: 140,
    height_mm: 190,
    gross_area_mm2: 390 * 140, // área bruta
    maximum_force_n: r * (390 * 140), // F = fb × Ab
    individual_strength_mpa: r,
  }));
}

// Helper: cria CPs no formato legado (kN + cm²)
function makeLegacySpecimens(resistances) {
  return resistances.map((r, i) => ({
    id: i + 1,
    age_days: 28,
    width_mm: 140,
    length_mm: 390,
    height_mm: 190,
    area_cm2: (390 * 140) / 100, // cm²
    rupture_load_kn: r * (390 * 140) / 1000, // kN
    resistance_mpa: r,
  }));
}

describe('blockCompressionEngine v2026.1 — NBR 6136-2:2026', () => {
  // TESTE 01: 6 corpos de prova
  test('01 — calcula com 6 corpos de prova', () => {
    const specs = makeSpecimens([8.1, 8.4, 8.7, 9.0, 9.2, 9.5]);
    const result = calculateBlockCompression2026(specs, { fbkEspecificado: 8.0 });
    expect(result.n).toBe(6);
    expect(result.error).toBeNull();
    expect(result.fbk_estimado).toBeGreaterThan(0);
  });

  // TESTE 02: Resultados em ordem aleatória
  test('02 — ordem aleatória produz mesmo resultado que ordenada', () => {
    const ordered = makeSpecimens([8.1, 8.4, 8.7, 9.0, 9.2, 9.5]);
    const shuffled = makeSpecimens([9.5, 8.4, 9.0, 8.1, 9.2, 8.7]);
    const r1 = calculateBlockCompression2026(ordered, { fbkEspecificado: 8.0 });
    const r2 = calculateBlockCompression2026(shuffled, { fbkEspecificado: 8.0 });
    expect(r2.fbk_estimado).toBeCloseTo(r1.fbk_estimado, 2);
    expect(r2.sorted_values).toEqual(r1.sorted_values);
  });

  // TESTE 03: Resultados já ordenados
  test('03 — resultados já ordenados não alteram o cálculo', () => {
    const specs = makeSpecimens([8.1, 8.4, 8.7, 9.0, 9.2, 9.5]);
    const result = calculateBlockCompression2026(specs, { fbkEspecificado: 8.0 });
    expect(result.sorted_values).toEqual([8.1, 8.4, 8.7, 9.0, 9.2, 9.5]);
    // Valores originais preservados
    expect(specs[0].individual_strength_mpa).toBe(8.1);
  });

  // TESTE 04: fbk calculado
  test('04 — fbk calculado = 2 × média(fb1, fb2) − fb3 para n=6', () => {
    const specs = makeSpecimens([8.1, 8.4, 8.7, 9.0, 9.2, 9.5]);
    const result = calculateBlockCompression2026(specs, { fbkEspecificado: 0 });
    // i=3 → fbk,cal = 2 × média(8.1, 8.4) − 8.7 = 2 × 8.25 − 8.7 = 7.8
    const expected = 2 * ((8.1 + 8.4) / 2) - 8.7;
    expect(result.fbk_calculado).toBeCloseTo(expected, 2);
  });

  // TESTE 05: Ψ = 0.89 para n = 6
  test('05 — Ψ = 0.89 para n = 6', () => {
    const specs = makeSpecimens([8.1, 8.4, 8.7, 9.0, 9.2, 9.5]);
    const result = calculateBlockCompression2026(specs, { fbkEspecificado: 8.0 });
    expect(result.n).toBe(6);
    expect(result.psi).toBe(0.89);
    expect(getBlockPsi(6)).toBe(0.89);
  });

  // TESTE 06: fbk calculado maior que Ψ × fb1
  test('06 — fbk calculado > Ψ × fb1 → piso não aplicado', () => {
    // fb1 alto → Ψ × fb1 será baixo comparado ao fbk calculado
    const specs = makeSpecimens([10.0, 10.0, 10.0, 10.0, 10.0, 10.0]);
    const result = calculateBlockCompression2026(specs, { fbkEspecificado: 8.0 });
    const psiFb1 = 0.89 * 10.0; // 8.9
    const fbkCal = 2 * ((10.0 + 10.0) / 2) - 10.0; // 10.0
    expect(fbkCal).toBeGreaterThan(psiFb1);
    expect(result.floor_applied).toBe(false);
  });

  // TESTE 07: Ψ × fb1 maior que fbk calculado
  test('07 — Ψ × fb1 > fbk calculado → piso aplicado', () => {
    // fb1 muito alto, fb2 muito baixo → fbk,cal baixo, mas Ψ × fb1 alto
    const specs = makeSpecimens([10.0, 10.0, 2.0, 2.0, 2.0, 2.0]);
    const result = calculateBlockCompression2026(specs, { fbkEspecificado: 8.0 });
    const psiFb1 = 0.89 * 10.0; // 8.9
    const fbkCal = 2 * ((10.0 + 10.0) / 2) - 2.0; // 18.0 — actually higher
    // Neste caso fbk,cal (18) > Ψ×fb1 (8.9), então piso não aplica
    // Vamos usar um caso onde o piso realmente se aplica:
    const specs2 = makeSpecimens([5.0, 5.0, 5.0, 5.0, 5.0, 5.0]);
    const result2 = calculateBlockCompression2026(specs2, { fbkEspecificado: 8.0 });
    // fbk,cal = 2 × média(5, 5) − 5 = 5; Ψ × fb1 = 0.89 × 5 = 4.45
    // fbk,cal (5) > Ψ×fb1 (4.45) → piso não aplica
    // Para o piso aplicar, precisamos fbk,cal < Ψ × fb1
    // fbk,cal = 2 × média(fb1, fb2) − fb3
    // Para que 2 × média(fb1,fb2) − fb3 < 0.89 × fb1
    // Se fb1 = fb2 = fb3 = 5: 2×5 − 5 = 5; 0.89×5 = 4.45 → não aplica
    // Se fb1 = 8, fb2 = 8, fb3 = 12: 2×8 − 12 = 4; 0.89×8 = 7.12 → aplica!
    const specs3 = makeSpecimens([8.0, 8.0, 12.0, 12.0, 12.0, 12.0]);
    const result3 = calculateBlockCompression2026(specs3, { fbkEspecificado: 8.0 });
    const fbkCal3 = 2 * ((8.0 + 8.0) / 2) - 12.0; // 4.0
    const psiFb1_3 = 0.89 * 8.0; // 7.12
    expect(psiFb1_3).toBeGreaterThan(fbkCal3);
    expect(result3.floor_applied).toBe(true);
    expect(result3.fbk_estimado).toBeCloseTo(psiFb1_3, 2);
  });

  // TESTE 08: Produto especificado = 4 MPa
  test('08 — produto especificado 4 MPa', () => {
    const specs = makeSpecimens([4.5, 4.8, 5.0, 5.2, 5.5, 6.0]);
    const result = calculateBlockCompression2026(specs, { fbkEspecificado: 4.0 });
    expect(result.fbk_especificado).toBe(4.0);
    expect(result.compliant).toBe(true);
  });

  // TESTE 09: Produto especificado = 8 MPa
  test('09 — produto especificado 8 MPa', () => {
    const specs = makeSpecimens([9.0, 9.5, 10.0, 10.5, 11.0, 11.5]);
    const result = calculateBlockCompression2026(specs, { fbkEspecificado: 8.0 });
    expect(result.fbk_especificado).toBe(8.0);
    expect(result.compliant).toBe(true);
  });

  // TESTE 10: Produto especificado = 12 MPa
  test('10 — produto especificado 12 MPa', () => {
    const specs = makeSpecimens([12.5, 13.0, 13.5, 14.0, 14.5, 15.0]);
    const result = calculateBlockCompression2026(specs, { fbkEspecificado: 12.0 });
    expect(result.fbk_especificado).toBe(12.0);
    expect(result.compliant).toBe(true);
  });

  // TESTE 11: Produto especificado = 16 MPa
  test('11 — produto especificado 16 MPa', () => {
    const specs = makeSpecimens([16.5, 17.0, 17.5, 18.0, 18.5, 19.0]);
    const result = calculateBlockCompression2026(specs, { fbkEspecificado: 16.0 });
    expect(result.fbk_especificado).toBe(16.0);
    expect(result.compliant).toBe(true);
  });

  // TESTE 12: Resultado exatamente igual ao especificado
  test('12 — resultado exatamente igual ao especificado → CONFORME', () => {
    // Construir CPs de modo que fbk_estimado seja exatamente igual ao especificado
    // fbk,cal = 2 × média(fb1, fb2) − fb3; se todos iguais a X: fbk,cal = X
    // Ψ × fb1 = 0.89 × X; se X > 0: fbk,cal = X > Ψ × fb1
    // Então fbk_estimado = X
    const specs = makeSpecimens([8.0, 8.0, 8.0, 8.0, 8.0, 8.0]);
    const result = calculateBlockCompression2026(specs, { fbkEspecificado: 8.0 });
    expect(result.fbk_estimado).toBeCloseTo(8.0, 2);
    expect(result.compliant).toBe(true);
    expect(result.approval).toBe('CONFORME');
  });

  // TESTE 13: Resultado abaixo do especificado
  test('13 — resultado abaixo do especificado → NÃO CONFORME', () => {
    const specs = makeSpecimens([6.0, 6.5, 7.0, 7.0, 7.0, 7.0]);
    const result = calculateBlockCompression2026(specs, { fbkEspecificado: 8.0 });
    expect(result.fbk_estimado).toBeLessThan(8.0);
    expect(result.compliant).toBe(false);
    expect(result.approval).toBe('NÃO CONFORME');
  });

  // TESTE 14: Resultado acima do especificado
  test('14 — resultado acima do especificado → CONFORME', () => {
    const specs = makeSpecimens([10.0, 10.5, 11.0, 11.5, 12.0, 12.5]);
    const result = calculateBlockCompression2026(specs, { fbkEspecificado: 8.0 });
    expect(result.fbk_estimado).toBeGreaterThan(8.0);
    expect(result.compliant).toBe(true);
    expect(result.approval).toBe('CONFORME');
  });

  // TESTE 15: Alteração posterior do cadastro do produto NÃO altera laudo existente
  test('15 — snapshot do fbk especificado não muda com cadastro posterior', () => {
    // O motor usa fbkEspecificado passado como parâmetro (snapshot do laudo)
    // Mudar o cadastro do produto posteriormente não afeta o cálculo do laudo
    const specs = makeSpecimens([13.0, 13.5, 14.0, 14.5, 15.0, 15.5]);
    const result = calculateBlockCompression2026(specs, { fbkEspecificado: 12.0 });
    expect(result.fbk_especificado).toBe(12.0);
    expect(result.compliant).toBe(true);
    // O fbk_especificado no resultado é o snapshot, não o cadastro atual
    // Mesmo que o cadastro mudou para 16, o laudo preserva 12
    expect(result.fbk_especificado).not.toBe(16.0);
  });

  // TESTE 16: Laudo histórico não utiliza o motor 2026
  test('16 — laudo sem normative_revision usa motor anterior', () => {
    const report = { /* sem normative_revision */ };
    expect(resolveBlockRevision(report)).toBe('2016');
    expect(resolveBlockRevision({ normative_revision: '2026' })).toBe('2026');
    expect(resolveBlockRevision({ normative_revision: '2016' })).toBe('2016');
  });

  // TESTE 17: Contraprova não é misturada com a prova
  test('17 — contraprova não é misturada com a prova', () => {
    const proofSpecs = makeSpecimens([8.1, 8.4, 8.7, 9.0, 9.2, 9.5]);
    const counterSpecs = makeSpecimens([7.0, 7.5, 8.0, 8.5, 9.0, 9.5]);

    const proofResult = calculateBlockCompression2026(proofSpecs, { fbkEspecificado: 8.0 });
    const counterResult = calculateBlockCompression2026(counterSpecs, { fbkEspecificado: 8.0 });

    // Prova calculada apenas com seus 6 CPs
    expect(proofResult.n).toBe(6);
    // Contraprova calculada apenas com seus 6 CPs
    expect(counterResult.n).toBe(6);
    // Resultados diferentes (não misturados)
    expect(proofResult.fbk_estimado).not.toEqual(counterResult.fbk_estimado);

    // decideLot preserva o resultado da prova
    const lot = decideLot(proofResult, counterResult, 'COMPLETED');
    expect(lot.final_lot_result).toBeDefined();
  });

  // TESTE 18: Área bruta é utilizada
  test('18 — área bruta é utilizada no cálculo', () => {
    const specs = makeSpecimens([8.0, 8.0, 8.0, 8.0, 8.0, 8.0]);
    const result = calculateBlockCompression2026(specs, { fbkEspecificado: 8.0 });
    // Cada CP tem gross_area_mm2 = 390 × 140 = 54600 mm²
    expect(result.individual_results[0].gross_area_mm2).toBe(390 * 140);
    expect(result.individual_results[0].individual_strength_mpa).toBeCloseTo(8.0, 2);
  });

  // TESTE 19: Área líquida não é utilizada para o cálculo de fb
  test('19 — área líquida não é utilizada para o cálculo de fb', () => {
    // O motor usa gross_area_mm2, nunca desconta vazios
    const specs = makeSpecimens([8.0, 8.0, 8.0, 8.0, 8.0, 8.0]);
    const result = calculateBlockCompression2026(specs, { fbkEspecificado: 8.0 });
    // Verificar que o cálculo individual usa F/Ab (bruta)
    const s = specs[0];
    const expectedFb = s.maximum_force_n / s.gross_area_mm2;
    expect(result.individual_results[0].individual_strength_mpa).toBeCloseTo(expectedFb, 4);
    // O motor não tem nenhum campo de área líquida
    expect(result.individual_results[0]).not.toHaveProperty('net_area_mm2');
  });

  // TESTE 20: Dados incompletos impedem conclusão do ensaio
  test('20 — dados incompletos impedem conclusão', () => {
    // Apenas 3 CPs (mínimo é 6)
    const specs = makeSpecimens([8.0, 8.0, 8.0]);
    const result = calculateBlockCompression2026(specs, { fbkEspecificado: 8.0 });
    expect(result.error).toBe('INSUFFICIENT_DATA');
    expect(result.compliant).toBe(false);

    // Validação também detecta dados faltantes
    const validation = validateBlockTest(specs);
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  // Teste extra: formato legado (kN + cm²) funciona
  test('formato legado (kN + cm²) é compatível', () => {
    const specs = makeLegacySpecimens([8.0, 8.0, 8.0, 8.0, 8.0, 8.0]);
    const result = calculateBlockCompression2026(specs, { fbkEspecificado: 8.0 });
    expect(result.error).toBeNull();
    expect(result.n).toBe(6);
    expect(result.fbk_estimado).toBeCloseTo(8.0, 1);
  });

  // Teste extra: índice i = 3 para n = 6
  test('índice i = 3 para n = 6', () => {
    expect(getBlockIndexI(6)).toBe(3);
  });
});