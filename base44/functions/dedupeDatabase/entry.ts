import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { requirePlatformAdmin } from '../../shared/platformAdmin.ts';
import { DEDUPE_ENTITIES, FK_SPECS, naturalKey } from './util.ts';

// Entidades cuja chave natural depende de FKs (machine_id) — deduplicadas
// somente após o remapeamento dos vínculos.
const LATE_KEY_ENTITIES = ['MachineDowntime', 'PreventiveMaintenance'];

// Agrupa por chave natural e devolve { idCópia: idRegistroMantido }.
// Mantém o registro mais antigo (a lista vem ordenada por created_date asc).
function groupDupes(records, entity) {
  const groups = {};
  for (const r of records) {
    const key = naturalKey(entity, r);
    if (!key) continue;
    (groups[key] = groups[key] || []).push(r);
  }
  const dupToKeep = {};
  for (const rs of Object.values(groups)) {
    if (rs.length < 2) continue;
    const keep = rs[0].id;
    for (let i = 1; i < rs.length; i++) dupToKeep[rs[i].id] = keep;
  }
  return dupToKeep;
}

// Remapeia um vínculo (escalar, array de IDs ou array de objetos) para o ID mantido.
function remapValue(entity, field, value, map) {
  if (value == null) return { changed: false };
  if (Array.isArray(value)) {
    const idKey = entity === 'ProductionLine' && field === 'machines' ? 'machine_id'
      : entity === 'ProductionLine' && field === 'shared_resources' ? 'resource_id'
      : null;
    const next = value.map(item => {
      if (idKey && item && typeof item === 'object') {
        const mapped = map[item[idKey]];
        return mapped ? { ...item, [idKey]: mapped } : item;
      }
      return map[item] || item;
    });
    const changed = JSON.stringify(next) !== JSON.stringify(value);
    return { changed, value: changed ? next : value };
  }
  if (map[value]) return { changed: true, value: map[value] };
  return { changed: false };
}

// IDs referenciados por um vínculo, para a checagem de órfãos.
function refIds(entity, field, value) {
  if (value == null) return [];
  if (Array.isArray(value)) {
    if (entity === 'ProductionLine') {
      const idKey = field === 'machines' ? 'machine_id' : 'resource_id';
      return value.map(item => (item && typeof item === 'object' ? item[idKey] : item)).filter(Boolean);
    }
    return value.filter(Boolean);
  }
  return [value];
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requirePlatformAdmin(base44);
    if (auth.response) return auth.response;
    const svc = base44.asServiceRole;

    const data = {};
    for (const entity of DEDUPE_ENTITIES) {
      data[entity] = await svc.entities[entity].list('created_date', 10000);
    }

    // 1. Duplicatas por chave natural (paradas/manutenções ficam para depois)
    const dupToKeep = {};
    const removed = {};
    for (const entity of DEDUPE_ENTITIES) {
      if (LATE_KEY_ENTITIES.includes(entity)) continue;
      dupToKeep[entity] = groupDupes(data[entity], entity);
      removed[entity] = Object.keys(dupToKeep[entity]).length;
    }

    // 2. Remapeia todos os vínculos para os IDs mantidos (banco + memória)
    let linksRemapped = 0;
    for (const entity of DEDUPE_ENTITIES) {
      if (LATE_KEY_ENTITIES.includes(entity)) dupToKeep[entity] = {};
      const spec = FK_SPECS[entity];
      if (!spec) continue;
      const updates = [];
      for (const r of data[entity]) {
        const patch = {};
        for (const [field, refEntity] of Object.entries(spec)) {
          const res = remapValue(entity, field, r[field], dupToKeep[refEntity] || {});
          if (res.changed) patch[field] = res.value;
        }
        if (Object.keys(patch).length) {
          updates.push({ id: r.id, ...patch });
          Object.assign(r, patch);
          linksRemapped++;
        }
      }
      for (let i = 0; i < updates.length; i += 400) {
        await svc.entities[entity].bulkUpdate(updates.slice(i, i + 400));
      }
    }

    // 3. Duplicatas cuja chave depende de machine_id já remapeado
    for (const entity of LATE_KEY_ENTITIES) {
      dupToKeep[entity] = groupDupes(data[entity], entity);
      removed[entity] = Object.keys(dupToKeep[entity]).length;
    }

    // 4. Exclui as cópias (mantendo o registro mais antigo)
    for (const entity of DEDUPE_ENTITIES) {
      const ids = Object.keys(dupToKeep[entity] || {});
      for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100);
        try {
          await svc.entities[entity].deleteMany({ id: { $in: chunk } });
        } catch (e) {
          for (const id of chunk) await svc.entities[entity].delete(id);
        }
      }
    }

    // 5. Validação: nenhuma chave natural repetida + vínculos órfãos
    const finalData = {};
    const remainingDupes = {};
    for (const entity of DEDUPE_ENTITIES) {
      finalData[entity] = await svc.entities[entity].list('created_date', 10000);
      const dupes = groupDupes(finalData[entity], entity);
      if (Object.keys(dupes).length) remainingDupes[entity] = Object.keys(dupes).length;
    }
    const idSets = {};
    for (const entity of DEDUPE_ENTITIES) idSets[entity] = new Set(finalData[entity].map(r => r.id));
    const orphanLinks = {};
    for (const entity of DEDUPE_ENTITIES) {
      const spec = FK_SPECS[entity];
      if (!spec) continue;
      for (const r of finalData[entity]) {
        for (const [field, refEntity] of Object.entries(spec)) {
          for (const id of refIds(entity, field, r[field])) {
            if (!idSets[refEntity].has(id)) {
              const k = `${entity}.${field} → ${refEntity}`;
              orphanLinks[k] = (orphanLinks[k] || 0) + 1;
            }
          }
        }
      }
    }

    return Response.json({
      removed,
      links_remapped: linksRemapped,
      final_counts: Object.fromEntries(DEDUPE_ENTITIES.map(e => [e, finalData[e].length])),
      validation: {
        duplicates_remaining: remainingDupes,
        orphan_links: orphanLinks,
        ok: Object.keys(remainingDupes).length === 0,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}