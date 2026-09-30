// Anonimização dos prints de campanha: coleta os nomes/e-mails de pessoas
// (usuário logado, operador ativo, membros e operadores PIN da empresa) e
// substitui as ocorrências no DOM do palco de captura por um rótulo genérico.
// A identidade da empresa ('Fábrica Demo') é tratada nos contextos; aqui
// ficam os nomes vindos dos próprios dados exibidos nas tabelas.
import { base44 } from '@/api/base44Client';

const GENERIC_LABEL = 'Operador';

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Reúne as identidades a ocultar: as passadas pelo chamador (usuário/operador
// ativos) mais os vínculos e operadores cadastrados da empresa ativa.
export async function collectMaskNames(companyId, identities = []) {
  const names = new Set();
  identities.forEach((identity) => {
    if (identity?.name) names.add(identity.name);
    if (identity?.email) names.add(identity.email);
  });
  if (companyId) {
    try {
      const [members, operators] = await Promise.all([
        base44.entities.UserCompany.filter({ company_id: companyId }),
        base44.entities.UserPin.filter({ company_id: companyId }),
      ]);
      members.forEach((m) => {
        if (m.user_name) names.add(m.user_name);
        if (m.user_email) names.add(m.user_email);
      });
      operators.forEach((o) => {
        if (o.name) names.add(o.name);
        if (o.email) names.add(o.email);
      });
    } catch {
      // A máscara segue com as identidades já coletadas.
    }
  }
  return [...names].filter((n) => String(n).trim().length >= 3);
}

// Percorre os nós de texto do palco e troca cada nome/e-mail por 'Operador'.
export function maskNamesInElement(root, names) {
  if (!root || !names.length) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    let text = node.nodeValue;
    if (!text) return;
    names.forEach((name) => {
      text = text.replace(new RegExp(escapeRegExp(name), 'gi'), GENERIC_LABEL);
    });
    if (text !== node.nodeValue) node.nodeValue = text;
  });
}