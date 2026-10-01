// Testes da camada central de nomenclatura de resistência (fbk/fpk).
// Cenários M01–M09: resolução de família por norma, categoria, prioridade,
// genéricos sem símbolo, símbolos corretos e rótulos completos.
import { describe, it, expect } from 'vitest';
import {
  getResistanceMetric,
  resolveFamily,
  resistanceSymbol,
  resistanceLabelWithSymbol,
  resistanceEstimatedLabelWithSymbol,
  RESISTANCE_FAMILIES,
} from '../resistanceMetric';

describe('M01 — NBR 6136 (bloco) → CONCRETE_BLOCK', () => {
  it('resolve família pela norma', () => {
    expect(resolveFamily({ normReference: 'NBR 6136' })).toBe('CONCRETE_BLOCK');
  });
  it('retorna fbk/fbk,est/fb', () => {
    const m = getResistanceMetric({ normReference: 'NBR 6136' });
    expect(m.family).toBe('CONCRETE_BLOCK');
    expect(m.symbol).toBe('fbk');
    expect(m.estimatedSymbol).toBe('fbk,est');
    expect(m.individualSymbol).toBe('fb');
    expect(m.unit).toBe('MPa');
  });
});

describe('M02 — NBR 9781 (pavimento) → PAVER', () => {
  it('resolve família pela norma', () => {
    expect(resolveFamily({ normReference: 'NBR 9781' })).toBe('PAVER');
  });
  it('retorna fpk/fpk,est/fp', () => {
    const m = getResistanceMetric({ normReference: 'NBR 9781' });
    expect(m.family).toBe('PAVER');
    expect(m.symbol).toBe('fpk');
    expect(m.estimatedSymbol).toBe('fpk,est');
    expect(m.individualSymbol).toBe('fp');
  });
});

describe('M03 — Categoria bloco → CONCRETE_BLOCK (sem norma)', () => {
  it('resolve pela categoria quando não há norma', () => {
    expect(resolveFamily({ category: 'Blocos de Concreto' })).toBe('CONCRETE_BLOCK');
  });
});

describe('M04 — Categoria pavimento → PAVER (sem norma)', () => {
  it('resolve pela categoria quando não há norma', () => {
    expect(resolveFamily({ category: 'Pavimento de Concreto' })).toBe('PAVER');
  });
});

describe('M05 — Meio-fio → PAVER (compatível com inferNorm existente)', () => {
  it('meio fio resolve como PAVER', () => {
    expect(resolveFamily({ category: 'Meio fio' })).toBe('PAVER');
    expect(resolveFamily({ category: 'Meio-fio' })).toBe('PAVER');
  });
});

describe('M06 — Família genérica sem símbolo', () => {
  it('categoria não mapeada → GENERIC com símbolo vazio', () => {
    const m = getResistanceMetric({ category: 'Outros artefatos' });
    expect(m.family).toBe('GENERIC');
    expect(m.symbol).toBe('');
    expect(m.estimatedSymbol).toBe('');
  });
  it('sem entrada → GENERIC', () => {
    expect(resolveFamily({})).toBe('GENERIC');
    expect(resolveFamily()).toBe('GENERIC');
  });
});

describe('M07 — Prioridade norma > categoria', () => {
  it('norma prevalece sobre categoria', () => {
    expect(resolveFamily({ category: 'Blocos de Concreto', normReference: 'NBR 9781' })).toBe('PAVER');
    expect(resolveFamily({ category: 'Pavimento de Concreto', normReference: 'NBR 6136' })).toBe('CONCRETE_BLOCK');
  });
});

describe('M08 — Símbolos curtos', () => {
  it('resistanceSymbol retorna fbk/fpk/vazio', () => {
    expect(resistanceSymbol({ normReference: 'NBR 6136' })).toBe('fbk');
    expect(resistanceSymbol({ normReference: 'NBR 9781' })).toBe('fpk');
    expect(resistanceSymbol({ category: 'Outros' })).toBe('');
  });
});

describe('M09 — Rótulos completos', () => {
  it('bloco com símbolo entre parênteses', () => {
    expect(resistanceLabelWithSymbol({ normReference: 'NBR 6136' }))
      .toBe('Resistência característica à compressão axial (fbk)');
    expect(resistanceEstimatedLabelWithSymbol({ normReference: 'NBR 6136' }))
      .toBe('Resistência característica estimada à compressão axial (fbk,est)');
  });
  it('pavimento com símbolo entre parênteses', () => {
    expect(resistanceLabelWithSymbol({ normReference: 'NBR 9781' }))
      .toBe('Resistência característica à compressão (fpk)');
    expect(resistanceEstimatedLabelWithSymbol({ normReference: 'NBR 9781' }))
      .toBe('Resistência característica estimada à compressão (fpk,est)');
  });
  it('genérico sem símbolo', () => {
    expect(resistanceLabelWithSymbol({ category: 'Outros' }))
      .toBe('Resistência característica');
    expect(resistanceEstimatedLabelWithSymbol({ category: 'Outros' }))
      .toBe('Resistência característica estimada');
  });
});