// Constantes e regras das normas técnicas para laudos de qualidade.
//
// AS FÓRMULAS vivem exclusivamente em `qualityNormEngine.js` (fonte única de
// cálculo) — este módulo mantém as CONSTANTES e reexporta os cálculos para
// compatibilidade com todos os consumidores existentes (Form, View, Quality,
// curva de resistência, relatórios). Nenhuma tela pode ter fórmula própria.

import { inferNormFamilyText } from './qualityFamilyText';

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

// Resistência mínima da NBR 9781 padronizada em 35 MPa (fallback por tráfego
// quando não houver classe definida). Com classe informada, vale a classe:
// 35 → 35 MPa; 50 → 50 MPa (getClassFbk).
export const MIN_RESISTANCE_BY_TRAFFIC = {
  'Pedestres/Leves': 35,
  'Pesado': 35,
};

// Espessura mínima (mm) por tipo de tráfego (NBR 9781)
// Para pavimentos, "altura" e "espessura" são a mesma dimensão da peça:
// usa-se nominal_thickness_mm / measured_thickness_mm (nunca campos duplicados).
export const MIN_THICKNESS_BY_TRAFFIC = {
  'Pedestres/Leves': 60,   // 6 cm — calçadas / tráfego leve
  'Pesado': 80,            // 8-10 cm — ruas / garagens / caminhões
};

export const NOMINAL_THICKNESS_PRESETS_MM = [60, 80, 100];

// Fallback LEGADO de leitura: família a partir de texto livre da categoria.
// Somente para registros antigos sem product_family — nunca gravado no banco.
export function inferNorm(category) {
  return inferNormFamilyText(category);
}

// ---------- CÁLCULOS — reexportados do MOTOR CENTRAL (fonte única) ----------

export {
  // Motor e metadados
  CALCULATION_VERSION,
  PRODUCT_FAMILY,
  PAVER_LOADING_DEVICE_AREA_CM2,
  REVISION_STATES,
  NORM_REVISIONS,
  PENDING_REVISION_MESSAGE,
  DEFAULT_REVISION_BY_NORM,
  // Família e rótulos
  resolveQualityProductFamily,
  familyForNormReference,
  normReferenceForFamily,
  characteristicLabelForFamily,
  characteristicLabelForNorm,
  characteristicLabelForReport,
  // Revisões normativas
  getAvailableRevisions,
  getRevisionState,
  isRevisionValidated,
  isRevisionSelectable,
  // Cálculos (fase estrutural — critérios atuais encapsulados)
  calcAreaCm2,
  calcResistance,
  computeSpecimen,
  groupByAge,
  ageStats,
  checkThickness,
  buildAlerts,
  checkCompliance,
  checkApproval,
  estimateCharacteristicResistance,
  calculateQualityResult,
  // Versionamento e comparação
  parseReportNumber,
  nextVersionNumber,
  versionBadge,
  isRecalculatedReport,
  compareReports,
} from '@/lib/qualityNormEngine';

// Alias legado — mantido por compatibilidade (mesmo cálculo do motor central)
export { estimateCharacteristicResistance as estimateFck } from '@/lib/qualityNormEngine';