// Captura automática de contexto do chamado — diferencial do CimentoPro.
// Captura SOMENTE informações não sensíveis: módulo, rota, navegador e sistema.
// Nunca captura senha, token, credencial ou dado de autenticação.
import { moduleForPath, PLAN_MODULES } from '@/lib/planModules';
import { MODULES } from '@/lib/permissions';
import { APP_VERSION } from '@/lib/supportConstants';

export function captureBrowserContext() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  let browser = 'Navegador';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\//.test(ua)) browser = 'Opera';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua)) browser = 'Safari';
  let os = 'Sistema';
  if (/Windows/.test(ua)) os = 'Windows';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad/.test(ua)) os = 'iOS';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  return `${browser} · ${os}`;
}

// Rótulo do módulo em que o usuário estava (ex: Simulador de Preços).
export function moduleLabelForPath(path) {
  const key = moduleForPath(path);
  if (key) return PLAN_MODULES.find((m) => m.key === key)?.label || key;
  const m = MODULES.find((x) => x.path === path);
  return m ? m.label : 'Suporte';
}

// Contexto completo de abertura do chamado, pronto para o backend.
export function captureSupportContext(pagePath) {
  return {
    module: moduleLabelForPath(pagePath),
    page_context: pagePath,
    browser_context: captureBrowserContext(),
    app_version: APP_VERSION,
    source: pagePath === '/suporte/novo' ? 'IN_APP' : 'ERROR_REPORT',
  };
}