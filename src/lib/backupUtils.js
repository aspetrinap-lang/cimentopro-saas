import { base44 } from '@/api/base44Client';
import { activeCompanyId } from '@/lib/companyScope';

// Versão do formato de backup — incrementar ao adicionar campos/módulos
// v2: norm_class e target_resistance em ProductType; norm_class em QualityReport
export const BACKUP_VERSION = 2;

export const BACKUP_ENTITIES = [
  'Machine',
  'Mold',
  'ProductType',
  'ConcreteTrace',
  'FailurePattern',
  'AppSettings',
  'ProductionOrder',
  'MachineDowntime',
  'PreventiveMaintenance',
  'MonthlyDre',
  'ProductionLine',
  'SharedResource',
  'QualityReport',
  'UserRoleProfile',
  'UserPin',
  'ProductCategory',
  'ArtifactModel',
];

const BUILTIN_FIELDS = ['id', 'created_date', 'updated_date', 'created_by_id'];

const LOCAL_BACKUP_KEY = 'cimentopro_local_backup';
const LOCAL_BACKUP_DATE_KEY = 'cimentopro_last_backup_date';

export async function exportAllData() {
  const data = {};
  for (const entity of BACKUP_ENTITIES) {
    const records = await base44.entities[entity].list('-created_date', 10000);
    data[entity] = records;
  }
  return {
    _meta: {
      app: 'CimentoPro',
      version: BACKUP_VERSION,
      exported_at: new Date().toISOString(),
      entity_counts: Object.fromEntries(BACKUP_ENTITIES.map(e => [e, data[e].length])),
    },
    data,
  };
}

export function downloadBackup(backupObj) {
  const json = JSON.stringify(backupObj, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cimentopro_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Entidades globais (sem escopo de empresa) — não recebem company_id
const GLOBAL_ENTITIES = ['UserRoleProfile'];

// Vínculos (FKs) por entidade: campo → entidade referenciada. Os IDs são
// recriados na importação, então as referências precisam ser remapeadas
// id antigo (do arquivo) → id novo (criado agora).
const FK_SPECS = {
  ProductionOrder: { machine_id: 'Machine', product_type_id: 'ProductType', operator_id: 'UserPin', production_line_id: 'ProductionLine' },
  QualityReport: { order_id: 'ProductionOrder', product_type_id: 'ProductType' },
  MachineDowntime: { machine_id: 'Machine', order_id: 'ProductionOrder' },
  PreventiveMaintenance: { machine_id: 'Machine', mold_id: 'Mold' },
  ProductType: { mold_id: 'Mold', concrete_trace_id: 'ConcreteTrace' },
  Mold: { product_type_ids: 'ProductType' },
  FailurePattern: { applies_to_machines: 'Machine' },
  ProductionLine: { machines: 'Machine', shared_resources: 'SharedResource' },
};

export async function importAllData(backupObj, { replace } = { replace: false }) {
  // Multi-tenant: todo registro importado precisa pertencer à empresa ativa,
  // senão fica invisível nas telas (fora do escopo de company_id)
  const companyId = activeCompanyId();
  if (!companyId) {
    throw new Error('Selecione uma empresa ativa antes de importar o backup — os dados importados precisam pertencer a uma empresa.');
  }
  const results = {};
  const idMaps = {};
  for (const entity of BACKUP_ENTITIES) {
    const records = backupObj.data?.[entity] || [];
    if (records.length === 0) {
      results[entity] = 0;
      continue;
    }

    if (replace) {
      try {
        await base44.entities[entity].deleteMany({});
      } catch (e) {
        // RLS may block — continue with create
      }
    }

    const cleanRecords = records.map(r => {
      const clean = { ...r };
      BUILTIN_FIELDS.forEach(f => delete clean[f]);
      if (!GLOBAL_ENTITIES.includes(entity)) {
        clean.company_id = clean.company_id || companyId;
      }
      return clean;
    });

    const created = await base44.entities[entity].bulkCreate(cleanRecords);
    results[entity] = Array.isArray(created) ? created.length : 0;
    // Mapa id antigo (do arquivo) → id novo (criado agora), por entidade
    idMaps[entity] = {};
    (Array.isArray(created) ? created : []).forEach((c, i) => {
      if (records[i] && c.id) idMaps[entity][records[i].id] = c.id;
    });
  }

  // Passo 2: remapeia os vínculos usando o mapa id antigo → novo do arquivo
  for (const [entity, spec] of Object.entries(FK_SPECS)) {
    const records = backupObj.data?.[entity] || [];
    const idMap = idMaps[entity];
    if (!idMap || records.length === 0) continue;
    const updates = [];
    records.forEach((r, i) => {
      const newId = idMap[r.id];
      if (!newId) return;
      const patch = { id: newId };
      for (const [field, refEntity] of Object.entries(spec)) {
        const refMap = idMaps[refEntity] || {};
        if (Array.isArray(r[field])) {
          if (entity === 'ProductionLine') {
            // array de objetos: remapeia a chave interna (machine_id / resource_id)
            const idKey = field === 'machines' ? 'machine_id' : 'resource_id';
            const remapped = r[field].map(item =>
              item && typeof item === 'object'
                ? { ...item, [idKey]: refMap[item[idKey]] || item[idKey] }
                : item
            );
            if (JSON.stringify(remapped) !== JSON.stringify(r[field])) patch[field] = remapped;
          } else {
            // array de IDs
            const remapped = r[field].map(id => refMap[id] || id);
            if (JSON.stringify(remapped) !== JSON.stringify(r[field])) patch[field] = remapped;
          }
        } else if (r[field]) {
          const mapped = refMap[r[field]] || r[field];
          if (mapped !== r[field]) patch[field] = mapped;
        }
      }
      if (Object.keys(patch).length > 1) updates.push(patch);
    });
    for (let i = 0; i < updates.length; i += 400) {
      await base44.entities[entity].bulkUpdate(updates.slice(i, i + 400));
    }
  }
  return results;
}

export async function runDailyBackup() {
  const today = new Date().toISOString().split('T')[0];
  const lastDate = localStorage.getItem(LOCAL_BACKUP_DATE_KEY);
  if (lastDate === today) return { skipped: true };

  try {
    const backup = await exportAllData();
    localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(backup));
    localStorage.setItem(LOCAL_BACKUP_DATE_KEY, today);
    return { skipped: false, date: today };
  } catch (e) {
    return { error: e.message };
  }
}

export function getLocalBackupInfo() {
  const date = localStorage.getItem(LOCAL_BACKUP_DATE_KEY);
  const raw = localStorage.getItem(LOCAL_BACKUP_KEY);
  if (!raw) return { exists: false };
  try {
    const backup = JSON.parse(raw);
    return {
      exists: true,
      date,
      counts: backup._meta?.entity_counts || {},
      size: (raw.length / 1024).toFixed(1),
    };
  } catch {
    return { exists: false };
  }
}

export function clearLocalBackup() {
  localStorage.removeItem(LOCAL_BACKUP_KEY);
  localStorage.removeItem(LOCAL_BACKUP_DATE_KEY);
}