import { base44 } from '@/api/base44Client';

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

export async function importAllData(backupObj, { replace } = { replace: false }) {
  const results = {};
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
      return clean;
    });

    const created = await base44.entities[entity].bulkCreate(cleanRecords);
    results[entity] = Array.isArray(created) ? created.length : 0;
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