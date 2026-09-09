// Custos padrão zerados
export const DEFAULT_INSUMO_COSTS = {};

// Nomes padrão dos insumos (usados como fallback)
export const DEFAULT_INSUMO_NAMES = {
  cement: 'Cimento',
  sand_artificial: 'Areia Artificial',
  sand_medium: 'Areia Média',
  sand_fine: 'Areia Fina',
  gravel: 'Brita',
  additive: 'Aditivo',
  pigment: 'Pigmento',
};

export const INSUMO_KEYS = Object.keys(DEFAULT_INSUMO_NAMES);

// Lista padrão de matérias-primas (nome + unidade) — editável dinamicamente
export const DEFAULT_RAW_MATERIALS = [
  { key: 'cement', name: 'Cimento', unit: 'kg' },
  { key: 'sand_artificial', name: 'Areia Artificial', unit: 'kg' },
  { key: 'sand_medium', name: 'Areia Média', unit: 'kg' },
  { key: 'sand_fine', name: 'Areia Fina', unit: 'kg' },
  { key: 'gravel', name: 'Brita', unit: 'kg' },
  { key: 'additive', name: 'Aditivo', unit: 'kg' },
  { key: 'pigment', name: 'Pigmento', unit: 'kg' },
];

// Chaves das matérias-primas que possuem campo de partes fixo no ConcreteTrace
export const CORE_PART_KEYS = ['cement', 'sand_artificial', 'sand_medium', 'sand_fine', 'gravel'];

// Mapeia chave do insumo para o campo de partes no traço de concreto (ConcreteTrace)
export const INSUMO_TRACE_PARTS = {
  cement: 'cement_parts',
  sand_artificial: 'sand_artificial_parts',
  sand_medium: 'sand_medium_parts',
  sand_fine: 'sand_fine_parts',
  gravel: 'gravel_parts',
};

// Mapeia chave do insumo para campos da entidade
export const INSUMO_FIELDS = {
  cement:         { pt_field: 'cement_per_unit',         planned: 'planned_cement',         actual: 'actual_cement',         unit: 'kg' },
  sand_artificial:{ pt_field: 'sand_artificial_per_unit',planned: 'planned_sand_artificial', actual: 'actual_sand_artificial', unit: 'kg' },
  sand_medium:    { pt_field: 'sand_medium_per_unit',    planned: 'planned_sand_medium',     actual: 'actual_sand_medium',     unit: 'kg' },
  sand_fine:      { pt_field: 'sand_fine_per_unit',      planned: 'planned_sand_fine',       actual: 'actual_sand_fine',       unit: 'kg' },
  gravel:         { pt_field: 'gravel_per_unit',         planned: 'planned_gravel',          actual: 'actual_gravel',          unit: 'kg' },
  additive:       { pt_field: 'additive_per_unit',       planned: 'planned_additive',        actual: 'actual_additive',        unit: 'kg' },
  pigment:        { pt_field: 'pigment_per_unit',       planned: 'planned_pigment',         actual: 'actual_pigment',         unit: 'kg' },
  water:          { pt_field: 'water_per_unit',          planned: 'planned_water',           actual: 'actual_water',           unit: 'L'  },
  };