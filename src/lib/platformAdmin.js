// Verificação centralizada de SUPER_ADMIN da plataforma.
// Flag booleana is_platform_admin — independente do papel operacional da empresa.
export function isPlatformAdmin(user) {
  if (!user) return false;
  return user.is_platform_admin === true || (user.data && user.data.is_platform_admin) === true;
}