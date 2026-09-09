// Constantes e regras das normas técnicas para laudos de qualidade

export const NORM_OPTIONS = ['NBR 6136', 'NBR 9781'];

export const AGE_PRESETS = [7, 14, 21, 28];

export const TRAFFIC_TYPES = ['Pedestres/Leves', 'Pesado'];

// Classes da norma por referência
// NBR 6136 (Blocos): A (≥8 MPa), B (4-<8 MPa), C (≥3 MPa)
// NBR 9781 (Pavimentos): 35 MPa, 50 MPa
export const NORM_CLASSES = {
  'NBR 6136': [
    { value: 'A', label: 'A (fbk ≥ 8,0 MPa) — Alvenaria estrutural', fbk: 8 },
    { value: 'B', label: 'B (fbk 4,0 a < 8,0 MPa) — Alvenaria estrutural', fbk: 4 },
    { value: 'C', label: 'C (fbk ≥ 3,0 MPa) — Estrutural/não estrutural', fbk: 3 },
  ],
  'NBR 9781': [
    { value: '35', label: '35 MPa — Pedestres/veículos leves', fbk: 35 },
    { value: '50', label: '50 MPa — Veículos especiais/abrasão', fbk: 50 },
  ],
};

export function getNormClasses(normReference) {
  return NORM_CLASSES[normReference] || [];
}

export function getClassFbk(normReference, normClass) {
  const classes = NORM_CLASSES[normReference] || [];
  const found = classes.find(c => c.value === normClass);
  return found ? found.fbk : 0;
}

// Resistência mínima por tipo de tráfego (NBR 9781) — MPa
export const MIN_RESISTANCE_BY_TRAFFIC = {
  'Pedestres/Leves': 35,
  'Pesado': 40,
};

// Espessura mínima (mm) por tipo de tráfego (NBR 9781)
export const MIN_THICKNESS_BY_TRAFFIC = {
  'Pedestres/Leves': 60,   // 6 cm — calçadas / tráfego leve
  'Pesado': 80,            // 8-10 cm — ruas / garagens / caminhões
};

// Tolerância dimensional (mm) — NBR 9781
export const DIMENSIONAL_TOLERANCE_MM = 3;

export function inferNorm(category) {
  if (!category) return 'NBR 6136';
  const cat = category.toLowerCase();
  if (cat.includes('pavimento')) return 'NBR 9781';
  if (cat.includes('meio fio') || cat.includes('meio-fio')) return 'NBR 9781';
  return 'NBR 6136';
}

export function calcAreaCm2(spec, normReference) {
  // Pavimento intertravado (NBR 9781): área fixa de 56,75 cm²
  if (normReference === 'NBR 9781') return 56.75;
  const w = Number(spec.width_mm) || 0;
  const l = Number(spec.length_mm) || 0;
  if (!w || !l) return 0;
  return (w * l) / 100; // mm² → cm²
}

export function calcResistance(spec, normReference) {
  const load = Number(spec.rupture_load_kn) || 0;
  const area = Number(spec.area_cm2) || calcAreaCm2(spec, normReference);
  if (!load || !area) return 0;
  return (load / area) * 10; // kN/cm² → MPa
}

export function computeSpecimen(spec, normReference) {
  const area = calcAreaCm2(spec, normReference);
  const resistance = calcResistance({ ...spec, area_cm2: area }, normReference);
  return {
    ...spec,
    area_cm2: +area.toFixed(2),
    resistance_mpa: +resistance.toFixed(2),
  };
}

// Agrupa corpos de prova por idade (dias)
export function groupByAge(specimens) {
  const groups = {};
  (specimens || []).forEach(s => {
    const age = Number(s.age_days) || 0;
    if (!groups[age]) groups[age] = [];
    groups[age].push(s);
  });
  return Object.entries(groups)
    .map(([age, specs]) => ({ age_days: Number(age), specimens: specs }))
    .sort((a, b) => a.age_days - b.age_days);
}

// Média e mínima de um conjunto de corpos de prova
export function ageStats(specs) {
  const values = (specs || []).map(s => Number(s.resistance_mpa) || 0).filter(v => v > 0);
  if (!values.length) return { average: 0, min: 0 };
  return {
    average: values.reduce((a, b) => a + b, 0) / values.length,
    min: Math.min(...values),
  };
}

// Verifica conformidade dimensional (NBR 9781): variação ≤ 3 mm
export function checkThickness(nominal, measured) {
  if (nominal == null || measured == null) return true; // sem dados → não alerta
  return Math.abs(Number(measured) - Number(nominal)) <= DIMENSIONAL_TOLERANCE_MM;
}

// Gera alertas informativos (não bloqueantes)
export function buildAlerts({ norm_reference, average, min, target, traffic_type, thickness_ok, hasFinalAge }) {
  const alerts = [];
  if (target > 0) {
    if (average < target) {
      alerts.push(`Resistência média (${average.toFixed(2)} MPa) abaixo do fck de projeto (${target} MPa).`);
    }
    if (min < 0.8 * target) {
      alerts.push(`Menor resistência individual (${min.toFixed(2)} MPa) inferior a 80% do fck (0,8 × ${target} = ${(0.8 * target).toFixed(2)} MPa).`);
    }
  }
  if (norm_reference === 'NBR 9781') {
    const minResist = MIN_RESISTANCE_BY_TRAFFIC[traffic_type];
    if (minResist && average > 0 && average < minResist) {
      alerts.push(`Resistência média (${average.toFixed(2)} MPa) abaixo do mínimo da NBR 9781 para tráfego ${traffic_type} (${minResist} MPa).`);
    }
    if (thickness_ok === false) {
      alerts.push(`Espessura medida fora da tolerância de ±${DIMENSIONAL_TOLERANCE_MM} mm da nominal (NBR 9781).`);
    }
  }
  if (!hasFinalAge) {
    alerts.push('Ensaio na idade de referência (28 dias) ainda não realizado — conformidade preliminar.');
  }
  return alerts;
}

// Estima a resistência característica (fck est) pela média e desvio-padrão da amostra
// fck,est = fmédia − 1,65 × s (mínimo de 3 CPs válidos)
export function estimateFck(specimens) {
  const values = (specimens || [])
    .map(s => Number(s.resistance_mpa) || 0)
    .filter(v => v > 0);
  if (values.length < 3) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (values.length - 1);
  const stdDev = Math.sqrt(variance);
  return Math.max(0, mean - 1.65 * stdDev);
}

// Conformidade final: média ≥ fck e mínima ≥ 0,8 × fck (na idade de referência)
export function checkCompliance({ average, min, target }) {
  if (!target || !average) return false;
  return average >= target && min >= 0.8 * target;
}

// Critério de aprovação automático: fck,est ≥ fck especificado
// Retorna 'APROVADO' | 'ATENÇÃO' | 'REPROVADO' | null (sem dados)
// ATENÇÃO quando fck,est está próximo do limite (95%–100% do fck)
export function checkApproval({ estimatedFck, target }) {
  if (!target || !estimatedFck) return null;
  if (estimatedFck >= target) return 'APROVADO';
  if (estimatedFck >= 0.95 * target) return 'ATENÇÃO';
  return 'REPROVADO';
}