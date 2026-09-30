import { base44 } from '@/api/base44Client';

// Cliente do suporte: TODAS as operações passam pela função backend supportDesk,
// que resolve autorização, isolamento multi-tenant, filtro de notas internas
// e URLs temporárias dos anexos no servidor.
export async function supportDesk(payload) {
  const res = await base44.functions.invoke('supportDesk', payload);
  return res?.data ?? res;
}

// Upload de anexo para o armazenamento PRIVADO — nenhuma URL pública é criada;
// o acesso acontece por URL assinada temporária, entregue pelo backend.
export async function uploadSupportAttachment(file) {
  const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
  return { file_name: file.name, file_uri, mime_type: file.type || '', file_size: file.size || 0 };
}

export const ACCEPTED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'pdf', 'xlsx', 'csv'];

export function isAcceptedFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  return ACCEPTED_EXTENSIONS.includes(ext) && file.size <= 10 * 1024 * 1024;
}