// Escopo multi-tenant do módulo de produção.
// Fonte única da empresa ativa: CompanyContext (getCurrentCompanyId).
// Uso:
//   base44.entities.X.filter(scopedFilter({...}))  — consulta filtrada
//   base44.entities.X.create(withCompany({...}))  — criação com company_id automático
//   await assertSameCompany([{ entity, id, label }]) — validação de FKs no salvar
import { getCurrentCompanyId } from '@/lib/CompanyContext';
import { base44 } from '@/api/base44Client';

export function activeCompanyId() {
  return getCurrentCompanyId();
}

// Adiciona company_id da empresa ativa ao filtro de qualquer consulta.
export function scopedFilter(filter = {}) {
  const cid = getCurrentCompanyId();
  return cid ? { ...filter, company_id: cid } : filter;
}

// Preenche company_id automaticamente no payload de criação.
export function withCompany(payload = {}) {
  const cid = getCurrentCompanyId();
  if (!cid || payload.company_id) return payload;
  return { ...payload, company_id: cid };
}

// Valida que todos os registros referenciados pertencem à empresa ativa.
// refs: [{ entity: 'ProductType', id, label }]
export async function assertSameCompany(refs = []) {
  const cid = getCurrentCompanyId();
  if (!cid) return true;
  for (const ref of refs) {
    if (!ref || !ref.id) continue;
    const rec = await base44.entities[ref.entity].get(ref.id).catch(() => null);
    if (rec && rec.company_id && rec.company_id !== cid) {
      throw new Error(`${ref.label || 'Registro selecionado'} não pertence à empresa ativa.`);
    }
  }
  return true;
}