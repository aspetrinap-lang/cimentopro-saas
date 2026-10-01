// Auditoria central de operações importantes.
// Uso: logAudit({ action, entity_name, entity_id, company_id, old_value, new_value })
//
// A gravação é roteada pela função backend `auditLog`, que deriva user_id e
// user_email da sessão verificada no servidor — o cliente nunca fornece a
// identidade do ator, impedindo falsificação da trilha de auditoria.
// A auditoria nunca quebra a operação que a originou (erros silenciosos).
import { base44 } from '@/api/base44Client';

export async function logAudit({
  action,
  entity_name,
  entity_id = null,
  company_id = null,
  old_value = null,
  new_value = null,
}) {
  try {
    await base44.functions.invoke('auditLog', {
      action,
      entity_name,
      entity_id,
      company_id,
      old_value,
      new_value,
    });
  } catch {
    // Auditoria é best-effort: falhas no log não devem interromper a operação.
  }
}