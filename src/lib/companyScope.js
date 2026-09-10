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

// Flag do SUPER_ADMIN da plataforma — atualizada pelo CompanyContext a cada
// render. É a única forma de saber, fora da árvore React (scopedFilter), se o
// usuário atual administra a plataforma (visão global permitida).
let platformAdminGlobal = false;
export function setPlatformAdminScope(isPlatformAdmin) {
  platformAdminGlobal = isPlatformAdmin === true;
}

// Sentinela que não corresponde a nenhum registro real: consulta sem
// empresa ativa retorna VAZIO (falha segura), nunca dados globais.
const NO_ACTIVE_COMPANY = '__sem_empresa_ativa__';

// Adiciona company_id da empresa ativa ao filtro de qualquer consulta.
// Sem empresa ativa: SUPER_ADMIN mantém visão de plataforma; qualquer
// outro usuário recebe um filtro que não casa nenhum registro.
export function scopedFilter(filter = {}) {
  const cid = getCurrentCompanyId();
  if (cid) return { ...filter, company_id: cid };
  if (platformAdminGlobal) return filter;
  return { ...filter, company_id: NO_ACTIVE_COMPANY };
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