// Guarda compartilhado de autorização da plataforma (SUPER_ADMIN).
// Usado por TODAS as funções administrativas do backend — a segurança
// nunca depende do frontend. Sem is_platform_admin === true: 403 Forbidden.
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
  const flag = user.is_platform_admin === true || (user.data && user.data.is_platform_admin) === true;
  if (flag !== true) {
    return { user: null, response: Response.json({ error: 'Forbidden: SUPER_ADMIN required' }, { status: 403 }) };
  }
  return { user, response: null };
}