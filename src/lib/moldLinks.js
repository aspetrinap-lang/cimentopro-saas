import { base44 } from '@/api/base44Client';

// Resolve os vínculos artefato↔molde: apenas artefatos que existem de fato,
// sem duplicatas. Órfãos = ids que apontam para artefatos deletados.
export function resolveMoldLinks(mold, productTypes) {
  const ids = [...new Set(mold?.product_type_ids || [])];
  const names = [];
  const orphanIds = [];
  ids.forEach(id => {
    const pt = (productTypes || []).find(p => p.id === id);
    if (pt) names.push(pt.name);
    else orphanIds.push(id);
  });
  return {
    names: [...new Set(names)],
    orphanIds,
    validIds: ids.filter(id => !orphanIds.includes(id)),
  };
}

// Persiste a limpeza no registro do molde: remove ids/names órfãos e
// duplicados, sem tocar nos dados dos artefatos.
export async function cleanMoldOrphans(mold, productTypes) {
  const { validIds, names } = resolveMoldLinks(mold, productTypes);
  const payload = { product_type_ids: validIds, product_type_names: names };
  await base44.entities.Mold.update(mold.id, payload);
  return payload;
}