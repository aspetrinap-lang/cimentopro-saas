import { base44 } from '@/api/base44Client';
import { activeCompanyId } from '@/lib/companyScope';

// Versão do formato de backup — incrementar ao adicionar campos/módulos
// v2: norm_class e target_resistance em ProductType; norm_class em QualityReport
// v3: DRE multiempresa — MonthlyDre com company_id/fechamento; nova entidade DreAccount
export const BACKUP_VERSION = 3;

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
  'DreAccount',
  'ProductionLine',
  'SharedResource',
  'QualityReport',
  'UserRoleProfile',
  'UserPin',
  'ProductCategory',
  'ArtifactModel',
];

const BUILTIN_FIELDS = ['id', 'created_date', 'updated_date', 'created_by_id'];

// Campos sensíveis de operador (UserPin) que jamais saem no backup nem entram
// dele na importação — o hash do PIN é gerado só pelo backend (operatorPins).
const PIN_FIELDS = ['pin_hash', 'pin_salt', 'pin'];

function sanitizePinRecord(record) {
  const clean = { ...record };
  PIN_FIELDS.forEach((f) => delete clean[f]);
  return clean;
}

const LOCAL_BACKUP_KEY = 'cimentopro_local_backup';
const LOCAL_BACKUP_DATE_KEY = 'cimentopro_last_backup_date';

export async function exportAllData() {
  const data = {};
  for (const entity of BACKUP_ENTITIES) {
    const records = await base44.entities[entity].list('-created_date', 10000);
    data[entity] = entity === 'UserPin' ? records.map(sanitizePinRecord) : records;
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
  DreAccount: { parent_id: 'DreAccount' },
  MonthlyDre: { items: 'DreAccount' },
};

// Entidades cuja chave natural não tem escopo de empresa
const KEY_GLOBAL_ENTITIES = ['UserRoleProfile'];

function normalizeKeyPart(value) {
  return value == null ? '' : String(value).trim().toLowerCase().replace(/\s+/g, ' ');
}

// Chaves naturais por entidade — identificam o registro de forma única para
// ignorar duplicatas na importação. `resolve` traduz FKs do arquivo (ex:
// machine_id das paradas) para o ID final antes de compor a chave.
const NATURAL_KEYS = {
  ProductionOrder: r => [r.order_number],
  Mold: r => [r.code],
  ProductType: r => [r.code],
  Machine: r => [r.code],
  ConcreteTrace: r => [r.name],
  FailurePattern: r => [r.name],
  AppSettings: r => [r.key],
  ProductionLine: r => [r.name],
  SharedResource: r => [r.name],
  QualityReport: r => [r.report_number],
  UserRoleProfile: r => [r.name],
  UserPin: r => [r.name],
  ProductCategory: r => [r.name],
  ArtifactModel: r => [r.name, r.category],
  MonthlyDre: r => [r.reference_month],
  DreAccount: r => [r.name],
  MachineDowntime: (r, resolve) => [r.date, resolve('Machine', r.machine_id), r.start_time],
  PreventiveMaintenance: (r, resolve) => [r.date, resolve('Machine', r.machine_id), r.maintenance_type],
};

// Chave natural normalizada (trim, minúsculas, espaços colapsados), isolada
// por empresa nas entidades multi-tenant. null = sem campos de chave preenchidos.
function naturalKey(entity, record, companyId, resolve) {
  const keyFn = NATURAL_KEYS[entity];
  if (!keyFn) return null;
  const resolver = resolve || ((refEntity, id) => id);
  const parts = keyFn(record, resolver);
  if (parts.some(p => p == null || p === '')) return null;
  const scope = KEY_GLOBAL_ENTITIES.includes(entity) ? [] : [companyId || record.company_id || ''];
  return [...scope, ...parts.map(normalizeKeyPart)].join(' ');
}

export async function importAllData(backupObj, { replace } = { replace: false }) {
  // Multi-tenant: todo registro importado precisa pertencer à empresa ativa,
  // senão fica invisível nas telas (fora do escopo de company_id)
  const companyId = activeCompanyId();
  if (!companyId) {
    throw new Error('Selecione uma empresa ativa antes de importar o backup — os dados importados precisam pertencer a uma empresa.');
  }
  const results = {};
  const skipped = {};
  const idMaps = {};
  for (const entity of BACKUP_ENTITIES) {
    const records = backupObj.data?.[entity] || [];
    idMaps[entity] = {};
    skipped[entity] = 0;
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

    // Dedupe por chave natural: registros que já existem no banco (ou que se
    // repetem dentro do próprio arquivo) são ignorados em vez de duplicados.
    const resolveId = (refEntity, id) => (id && idMaps[refEntity] && idMaps[refEntity][id]) || id;
    const existingRecords = await base44.entities[entity].list('created_date', 10000);
    const existingByKey = new Map();
    for (const r of existingRecords) {
      const key = naturalKey(entity, r, companyId, resolveId);
      if (key && !existingByKey.has(key)) existingByKey.set(key, r.id);
    }

    const toCreate = [];
    const batchDupes = [];
    const firstByKey = new Map();
    let skippedCount = 0;
    for (const r of records) {
      const key = naturalKey(entity, r, companyId, resolveId);
      if (key && existingByKey.has(key)) {
        idMaps[entity][r.id] = existingByKey.get(key);
        skippedCount++;
        continue;
      }
      if (key && firstByKey.has(key)) {
        batchDupes.push({ id: r.id, firstId: firstByKey.get(key) });
        skippedCount++;
        continue;
      }
      if (key) firstByKey.set(key, r.id);
      const clean = { ...r };
      BUILTIN_FIELDS.forEach(f => delete clean[f]);
      if (entity === 'UserPin') PIN_FIELDS.forEach(f => delete clean[f]);
      if (!GLOBAL_ENTITIES.includes(entity)) {
        clean.company_id = clean.company_id || companyId;
      }
      toCreate.push({ fileId: r.id, clean });
    }

    const created = toCreate.length > 0
      ? await base44.entities[entity].bulkCreate(toCreate.map(t => t.clean))
      : [];
    const createdArr = Array.isArray(created) ? created : [];
    results[entity] = createdArr.length;
    skipped[entity] = skippedCount;

    // Mapa id antigo (do arquivo) → id final (criado agora ou já existente), por entidade
    toCreate.forEach((t, i) => {
      if (createdArr[i] && createdArr[i].id) idMaps[entity][t.fileId] = createdArr[i].id;
    });
    for (const d of batchDupes) {
      if (idMaps[entity][d.firstId]) idMaps[entity][d.id] = idMaps[entity][d.firstId];
    }
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
          if (entity === 'MonthlyDre' && field === 'items') {
            // array de lançamentos: remapeia account_id para o novo id da DreAccount
            const remapped = r[field].map((it) => it && typeof it === 'object' && it.account_id && refMap[it.account_id]
              ? { ...it, account_id: refMap[it.account_id] }
              : it);
            if (JSON.stringify(remapped) !== JSON.stringify(r[field])) patch[field] = remapped;
          } else if (entity === 'ProductionLine') {
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
  results.skipped = skipped;
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