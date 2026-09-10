// Chaves naturais e vínculos usados pela limpeza de duplicatas (dedupeDatabase).

export const DEDUPE_ENTITIES = [
  'Machine', 'Mold', 'ProductType', 'ConcreteTrace', 'FailurePattern',
  'AppSettings', 'ProductionOrder', 'MachineDowntime', 'PreventiveMaintenance',
  'MonthlyDre', 'ProductionLine', 'SharedResource', 'QualityReport',
  'UserRoleProfile', 'UserPin', 'ProductCategory', 'ArtifactModel',
];

// Entidades cuja chave natural não tem escopo de empresa
const GLOBAL_KEY_ENTITIES = ['UserRoleProfile', 'MonthlyDre'];

// Vínculos (FKs) por entidade: campo → entidade referenciada. Ao excluir uma
// cópia, essas referências são remapeadas para o ID do registro mantido.
export const FK_SPECS = {
  ProductionOrder: { machine_id: 'Machine', product_type_id: 'ProductType', operator_id: 'UserPin', production_line_id: 'ProductionLine' },
  QualityReport: { order_id: 'ProductionOrder', product_type_id: 'ProductType' },
  MachineDowntime: { machine_id: 'Machine', order_id: 'ProductionOrder' },
  PreventiveMaintenance: { machine_id: 'Machine', mold_id: 'Mold' },
  ProductType: { mold_id: 'Mold', concrete_trace_id: 'ConcreteTrace' },
  Mold: { product_type_ids: 'ProductType' },
  FailurePattern: { applies_to_machines: 'Machine' },
  ProductionLine: { machines: 'Machine', shared_resources: 'SharedResource' },
};

function normalizeKeyPart(value) {
  return value == null ? '' : String(value).trim().toLowerCase().replace(/\s+/g, ' ');
}

// Chave natural de um registro (isolada por empresa nas entidades multi-tenant).
// Retorna null quando os campos da chave não estão preenchidos (não deduplica).
export function naturalKey(entity, record) {
  if (!record) return null;
  let parts;
  switch (entity) {
    case 'ProductionOrder': parts = [record.order_number]; break;
    case 'Mold':
    case 'ProductType':
    case 'Machine': parts = [record.code]; break;
    case 'ArtifactModel': parts = [record.name, record.category]; break;
    case 'AppSettings': parts = [record.key]; break;
    case 'MonthlyDre': parts = [record.reference_month]; break;
    case 'QualityReport': parts = [record.report_number]; break;
    case 'MachineDowntime': parts = [record.date, record.machine_id, record.start_time]; break;
    case 'PreventiveMaintenance': parts = [record.date, record.machine_id, record.maintenance_type]; break;
    case 'ConcreteTrace':
    case 'UserPin':
    case 'ProductCategory':
    case 'ProductionLine':
    case 'SharedResource':
    case 'FailurePattern':
    case 'UserRoleProfile': parts = [record.name]; break;
    default: return null;
  }
  if (parts.some(p => p == null || p === '')) return null;
  const scope = GLOBAL_KEY_ENTITIES.includes(entity) ? [] : [record.company_id || ''];
  return [...scope, ...parts.map(normalizeKeyPart)].join(' ');
}