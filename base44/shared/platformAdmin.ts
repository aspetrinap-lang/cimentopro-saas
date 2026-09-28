// Guarda compartilhado de autorização da plataforma (SUPER_ADMIN).
// Fonte de verdade: entidade PlatformAdmin — o RLS dela nega TODO acesso de
// usuário do app (leitura/criação/alteração/exclusão), então apenas o acesso
// de serviço do backend consegue consultá-la. A flag is_platform_admin da
// sessão do usuário é CACHE DE EXIBIÇÃO, sincronizado apenas pela ação
// setPlatformAdmin (adminUsers) — nenhuma decisão de autorização confia
// nela após a migração única (bootstrap).
export async function isProtectedPlatformAdmin(svc, userId) {
  if (!userId) return false;
  const recs = await svc.entities.PlatformAdmin.filter({ user_id: userId, active: true }, '-created_date', 10)
    .catch(() => []);
  return recs.length > 0;
}

async function hasAnyPlatformAdmin(svc) {
  const recs = await svc.entities.PlatformAdmin.filter({ active: true }, '-created_date', 1)
    .catch(() => []);
  return recs.length > 0;
}

const sessionFlag = (user) =>
  user.is_platform_admin === true || (user.data && user.data.is_platform_admin) === true;

// Decisão de autorização: fonte protegida. A flag da sessão só é aceita na
// janela de bootstrap — enquanto NENHUM SUPER_ADMIN protegido existir, para
// que o administrador atual consiga entrar e executar a migração única.
// Depois disso, a flag sozinha não vale mais nada (auto-promoção eliminada).
export async function isPlatformAdminVerified(svc, user) {
  if (!user || !user.id) return false;
  if (await isProtectedPlatformAdmin(svc, user.id)) return true;
  if (await hasAnyPlatformAdmin(svc)) return false;
  return sessionFlag(user) === true;
}

export async function requirePlatformAdmin(base44) {
  let user = null;
  try {
    user = await base44.auth.me();
  } catch (error) {
    user = null;
  }
  if (!user || !user.id) {
    return { user: null, response: Response.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const svc = base44.asServiceRole;
  const allowed = await isPlatformAdminVerified(svc, user).catch(() => false);
  if (allowed !== true) {
    return { user: null, response: Response.json({ error: 'Forbidden: SUPER_ADMIN required' }, { status: 403 }) };
  }
  return { user, response: null };
}