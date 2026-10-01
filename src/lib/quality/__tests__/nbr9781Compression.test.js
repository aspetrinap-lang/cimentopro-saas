// Testes do motor de compressão NBR 9781-1/-2:2026
// Cenários T01–T28: parâmetros, cálculo individual, estatístico,
// fpk,est, piso ψ, fator de espessura, validações, preservação
// de laudos 2013, memória de cálculo e multi-tenant.
import { describe, it, expect } from 'vitest';
import {
  calculateCompression2026,
  calculateCompression2013,
  calculateCompression,
  getEngineMetadata,
  resolveRevision,
  calcIndividualResistance,
  buildAlerts2026,
} from '../compressionEngine';
import {
  NBR_9781_2026_COMPRESSION,
  NBR_9781_2013_COMPRESSION,
  getThicknessFactor,
  getPsi,
  getIndexI,
  getCompressionParams,
} from '../normativeParams';

function specs(resistances) {
  return resistances.map((r, i) => ({ id: i + 1, resistance_mpa: r }));
}

describe('T01 — Nenhum CP → erro', () => {
  it('retorna INSUFFICIENT_DATA quando não há CPs válidos', () => {
    const r = calculateCompression2026([], { nominalThicknessMm: 80, targetFck: 35 });
    expect(r.error).toBe('INSUFFICIENT_DATA');
    expect(r.fpk).toBe(0);
  });
});

describe('T02 — Menos de 6 CPs → erro (2026)', () => {
  it('retorna INSUFFICIENT_DATA com 5 CPs', () => {
    const r = calculateCompression2026(specs([40, 42, 38, 41, 39]), { nominalThicknessMm: 80, targetFck: 35 });
    expect(r.error).toBe('INSUFFICIENT_DATA');
    expect(r.fpk).toBe(0);
  });
});

describe('T03 — Exatamente 6 CPs → cálculo válido', () => {
  it('calcula fpk,est com n=6', () => {
    const r = calculateCompression2026(specs([40, 42, 38, 41, 39, 43]), { nominalThicknessMm: 80, targetFck: 35 });
    expect(r.error).toBeNull();
    expect(r.fpk).toBeGreaterThan(0);
    expect(r.method).toBe('small_sample');
  });
});

describe('T04 — n=17 → bloqueado', () => {
  it('retorna PENDING_STATISTICAL_PARAMETER para n=17', () => {
    const vals = Array.from({ length: 17 }, (_, i) => 40 + i);
    const r = calculateCompression2026(specs(vals), { nominalThicknessMm: 80, targetFck: 35 });
    expect(r.error).toBe('PENDING_STATISTICAL_PARAMETER');
    expect(r.fpk).toBe(0);
  });
});

describe('T05 — n≥18 → método large sample', () => {
  it('usa método large_sample para n=18', () => {
    const vals = Array.from({ length: 18 }, (_, i) => 40 + (i % 5));
    const r = calculateCompression2026(specs(vals), { nominalThicknessMm: 80, targetFck: 35 });
    expect(r.error).toBeNull();
    expect(r.method).toBe('large_sample');
    expect(r.psi).toBeNull();
  });
});

describe('T06 — Fator de espessura p para 100mm', () => {
  it('p=1.00 para espessura ≥ 100mm', () => {
    expect(getThicknessFactor(100)).toBe(1.00);
    expect(getThicknessFactor(120)).toBe(1.00);
  });
});

describe('T07 — Fator de espessura p para 80mm', () => {
  it('p=0.95 para 80mm', () => {
    expect(getThicknessFactor(80)).toBe(0.95);
  });
});

describe('T08 — Fator de espessura p para 60mm', () => {
  it('p=0.88 para 60mm', () => {
    expect(getThicknessFactor(60)).toBe(0.88);
  });
});

describe('T09 — fpk,est = 2 × média(i−1) − fp(i) para n=6', () => {
  it('aplica fórmula da amostra pequena corretamente', () => {
    const r = calculateCompression2026(specs([40, 42, 38, 41, 39, 43]), { nominalThicknessMm: 100, targetFck: 0 });
    // p=1.00 (100mm), valores já corrigidos
    // sorted: [38, 39, 40, 41, 42, 43]
    // i=2 → média dos (i-1)=1 menores = 38; fp(2) = 39
    // fpk,est = 2 × 38 − 39 = 37
    expect(r.fpk_est).toBe(37);
  });
});

describe('T10 — Piso ψ × fp(1) aplicado', () => {
  it('aplica piso quando fpk,est < ψ × fp(1)', () => {
    // Valores com grande dispersão: fpk,est baixo, piso alto
    // sorted: [20, 50, 51, 52, 53, 54]
    // i=2 → média(1 menor) = 20; fp(2) = 50
    // fpk,est = 2 × 20 − 50 = -10 → negativo
    // piso: ψ=0.85 × fp(1)=20 = 17
    const r = calculateCompression2026(specs([20, 50, 51, 52, 53, 54]), { nominalThicknessMm: 100, targetFck: 0 });
    expect(r.floor_applied).toBe(true);
    expect(r.fpk).toBe(17); // 0.85 × 20
  });
});

describe('T11 — Conformidade: fpk ≥ target', () => {
  it('APROVADO quando fpk ≥ fck de projeto', () => {
    const r = calculateCompression2026(specs([40, 42, 38, 41, 39, 43]), { nominalThicknessMm: 100, targetFck: 35 });
    expect(r.compliant).toBe(true);
    expect(r.approval).toBe('APROVADO');
  });
});

describe('T12 — Não conformidade: fpk < target', () => {
  it('REPROVADO quando fpk < 95% do fck', () => {
    const r = calculateCompression2026(specs([20, 21, 22, 23, 24, 25]), { nominalThicknessMm: 100, targetFck: 35 });
    expect(r.compliant).toBe(false);
    expect(r.approval).toBe('REPROVADO');
  });
});

describe('T13 — Memória de cálculo gerada', () => {
  it('contém passos auditáveis', () => {
    const r = calculateCompression2026(specs([40, 42, 38, 41, 39, 43]), { nominalThicknessMm: 80, targetFck: 35 });
    const mem = r.calculation_memory;
    expect(mem.steps.length).toBeGreaterThan(5);
    expect(mem.steps[0].step).toBe(1);
    expect(mem.result).toBeTruthy();
    expect(mem.result.fpk).toBe(r.fpk);
  });
});

describe('T14 — Versionamento registrado', () => {
  it('metadados do motor 2026 estão corretos', () => {
    const meta = getEngineMetadata('2026');
    expect(meta.engine_name).toBe('NBR_9781_2026_COMPRESSION');
    expect(meta.normative_revision).toBe('2026');
    expect(meta.test_method_revision).toBe('NBR 9781-2:2026');
    expect(meta.engine_version).toBe('1.0.0');
    expect(meta.calculation_timestamp).toBeTruthy();
  });
});

describe('T15 — Laudo 2013 preservado (sem normative_revision)', () => {
  it('resolveRevision retorna 2013 para laudo sem campo', () => {
    expect(resolveRevision({})).toBe('2013');
    expect(resolveRevision({ normative_revision: '2026' })).toBe('2026');
    expect(resolveRevision(null)).toBe('2013');
  });
});

describe('T16 — Resistências individuais corretas', () => {
  it('converte kN/cm² → MPa (×10)', () => {
    expect(calcIndividualResistance(100, 25)).toBe(40); // 100/25 × 10 = 40 MPa
  });
});

describe('T17 — Ordenação crescente', () => {
  it('valores são ordenados antes do cálculo estatístico', () => {
    const r = calculateCompression2026(specs([43, 38, 42, 40, 41, 39]), { nominalThicknessMm: 100, targetFck: 0 });
    // Mesmo resultado de T09 (valores embaralhados)
    expect(r.fpk_est).toBe(37);
  });
});

describe('T18 — n=7 cálculo válido', () => {
  it('calcula com n=7', () => {
    const r = calculateCompression2026(specs([40, 42, 38, 41, 39, 43, 44]), { nominalThicknessMm: 100, targetFck: 0 });
    expect(r.error).toBeNull();
    expect(r.psi).toBe(0.86);
    // sorted: [38, 39, 40, 41, 42, 43, 44]
    // i=2 → média(1 menor) = 38; fp(2) = 39
    // fpk,est = 2 × 38 − 39 = 37
    // piso: 0.86 × 38 = 32.68 → não aplicado
    expect(r.fpk_est).toBe(37);
  });
});

describe('T19 — n=16 cálculo válido', () => {
  it('calcula com n=16', () => {
    const vals = Array.from({ length: 16 }, (_, i) => 40 + (i % 4));
    const r = calculateCompression2026(specs(vals), { nominalThicknessMm: 100, targetFck: 0 });
    expect(r.error).toBeNull();
    expect(r.psi).toBe(0.90);
    expect(r.method).toBe('small_sample');
  });
});

describe('T20 — n=18 método large sample', () => {
  it('usa média − k × s para n=18', () => {
    const vals = Array.from({ length: 18 }, (_, i) => 40 + (i % 3));
    const r = calculateCompression2026(specs(vals), { nominalThicknessMm: 100, targetFck: 0 });
    expect(r.method).toBe('large_sample');
    expect(r.psi).toBeNull();
    // Verifica que o cálculo é diferente do método small_sample
    const mean = vals.reduce((a, b) => a + b, 0) / 18;
    const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / 17;
    const s = Math.sqrt(variance);
    const expectedFpk = mean - 1.65 * s;
    expect(r.fpk).toBeCloseTo(expectedFpk, 1);
  });
});

describe('T21 — Valores corrigidos pelo fator p', () => {
  it('aplica fator de espessura antes do cálculo', () => {
    // espessura 80mm → p=0.95
    const r = calculateCompression2026(specs([40, 42, 38, 41, 39, 43]), { nominalThicknessMm: 80, targetFck: 0 });
    // corrigidos: [38.0, 39.9, 36.1, 38.95, 37.05, 40.85]
    // sorted: [36.1, 37.05, 38.0, 38.95, 39.9, 40.85]
    // i=2 → média(1 menor) = 36.1; fp(2) = 37.05
    // fpk,est = 2 × 36.1 − 37.05 = 35.15
    // piso: 0.85 × 36.1 = 30.685 → não aplicado
    expect(r.thickness_factor).toBe(0.95);
    expect(r.fpk_est).toBeCloseTo(35.15, 1);
  });
});

describe('T22 — ψ correto por n', () => {
  it('tabela ψ retorna valores esperados', () => {
    expect(getPsi(6)).toBe(0.85);
    expect(getPsi(10)).toBe(0.88);
    expect(getPsi(16)).toBe(0.90);
    expect(getPsi(18)).toBeNull();
  });
});

describe('T23 — Índice i correto por n', () => {
  it('tabela i retorna valores esperados', () => {
    expect(getIndexI(6)).toBe(2);
    expect(getIndexI(9)).toBe(3);
    expect(getIndexI(13)).toBe(4);
    expect(getIndexI(18)).toBeNull();
  });
});

describe('T24 — Conversão kN→MPa (cálculo individual)', () => {
  it('100 kN / 25 cm² = 40 MPa', () => {
    const r = calcIndividualResistance(100, 25);
    expect(r).toBe(40);
  });
});

describe('T25 — Área fixa 56,75 cm² para pavimentos', () => {
  it('motor recebe resistências já calculadas com área padrão', () => {
    // A área é calculada em qualityNorms.calcAreaCm2 (56.75 cm² para NBR 9781)
    // O motor consome resistance_mpa já calculada — não recalcula área
    const r = calculateCompression2026(specs([40, 42, 38, 41, 39, 43]), { nominalThicknessMm: 100, targetFck: 35 });
    expect(r.error).toBeNull();
    expect(r.fpk).toBeGreaterThan(0);
  });
});

describe('T26 — Engine 2013: média − 1,65 × s', () => {
  it('calcula fck,est pelo método 2013', () => {
    const r = calculateCompression2013(specs([40, 42, 38]), { targetFck: 35 });
    const mean = (40 + 42 + 38) / 3;
    const variance = ((40 - mean) ** 2 + (42 - mean) ** 2 + (38 - mean) ** 2) / 2;
    const s = Math.sqrt(variance);
    const expected = mean - 1.65 * s;
    expect(r.fpk_est).toBeCloseTo(expected, 1);
    expect(r.engine.normative_revision).toBe('2013');
  });
});

describe('T27 — Engine 2013: conformidade média ≥ fck E mín ≥ 0,8×fck', () => {
  it('APROVADO quando média e mínima atendem critério', () => {
    const r = calculateCompression2013(specs([40, 42, 38]), { targetFck: 35 });
    expect(r.compliant).toBe(true);
    expect(r.approval).toBe('APROVADO');
  });
});

describe('T28 — Multi-tenant: motor não mistura dados', () => {
  it('motor consome apenas o array recebido', () => {
    const meus = specs([40, 42, 38, 41, 39, 43]);
    const r = calculateCompression2026(meus, { nominalThicknessMm: 100, targetFck: 35 });
    // O motor não tem acesso a dados de outras empresas — consome só o array
    expect(r.calculation_memory.steps[0].values.length).toBe(6);
  });
});

describe('Alertas 2026', () => {
  it('gera alerta quando fpk < target', () => {
    const r = calculateCompression2026(specs([20, 21, 22, 23, 24, 25]), { nominalThicknessMm: 100, targetFck: 35 });
    const alerts = buildAlerts2026(r, { target: 35, hasFinalAge: true });
    expect(alerts.some(a => a.includes('abaixo do fck'))).toBe(true);
  });
});

describe('Ponto de entrada unificado', () => {
  it('calculateCompression delega para 2026 quando revisão=2026', () => {
    const r = calculateCompression(specs([40, 42, 38, 41, 39, 43]), { nominalThicknessMm: 100, targetFck: 35 }, '2026');
    expect(r.engine.normative_revision).toBe('2026');
  });
  it('calculateCompression delega para 2013 quando revisão=2013', () => {
    const r = calculateCompression(specs([40, 42, 38]), { targetFck: 35 }, '2013');
    expect(r.engine.normative_revision).toBe('2013');
  });
});